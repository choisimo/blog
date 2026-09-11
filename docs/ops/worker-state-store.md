# Worker state on Kubernetes SQLite

## Storage and request path

With `STATE_STORE_BACKEND=origin`, the API Gateway Worker replaces its D1 binding
with signed HTTP requests to the backend's `/internal/state-db/query`. The route
requires both the backend key and a verified gateway signature. The adapter does
not fall back to D1 or automatically replay a timed-out write.

The API owns `/app/.data/worker-state.db`, selected by
`WORKER_STATE_SQLITE_PATH`. It is separate from the existing backend
`/app/.data/blog.db` and its `schema_migrations` ledger. Worker state retains
`d1_migrations`; do not run the legacy backend migration loader against it.

The API Deployment has one replica, uses `Recreate`, and mounts the 5Gi
`api-sqlite` PVC at `/app/.data`. The two AI-worker replicas do not mount that
SQLite volume. Any shared Worker-state access must go through the API. PostgreSQL
continues to serve its existing analytics/logging database.

The inspected storage is `local-path` on `k3d-blog-server-0`, backed by a Docker
volume, with PV reclaim policy `Delete`. A backup beside the database protects
against a failed migration, not node or volume loss. Keep encrypted off-host
copies and verify restores; no scheduled cluster backup was found in the
2026-09-12 operational inspection.

## Initial import and source consistency

The first authenticated export imported on 2026-09-12 contained **72 tables,
83,055 rows and 43 migration entries**. This includes `sqlite_sequence`; the
read-only source-count comparison covers 71 non-internal tables. Integrity check
passed and foreign-key check returned zero violations. All 41 repository
migrations through `0041_translation_execution.sql` were present, together with
two retained historical entries: `0038_edge_rate_limits.sql` and
`0039_auth_ephemeral_records.sql`.

These are initial snapshot counts, not assertions about the current live database.
The original D1 database was not modified or deleted by the export/import work.
The exported SQL was authenticated and checked before import; public logs and
artifacts must not contain SQL, rows, credentials or signed download URLs.

D1 export provides a consistent snapshot and blocks queries while exporting;
it does not keep writers stopped afterwards. Pre-export translation/image quota
failures do not prove that all later writes were blocked. Final export run
`34632509298` decrypted to the same 40,309,145 bytes and SHA-256 as the first export:
`19dbb52aff57be1a35fc651d11014d05cd056792147dd92501169431ca023fef`.
The snapshots were byte-identical, so the validated SQLite file was retained
without a second restore. This establishes equality of the two exported snapshots,
not a write freeze after the final snapshot. For future cutovers, compare the
final source snapshot privately before enabling consumers; if it differs,
refresh the import while consumers are still stopped. Never replace the file
under running SQLite connections. Equal table counts alone do not prove equal
row contents.

See [Cloudflare export behavior](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/export/).

## Migration CLI

The image copies `backend/src` to `/app/backend/src` and `workers/migrations` to
`/app/workers/migrations`. The CLI defaults to that image's SQL directory, derived
from its own location, rather than the independently synchronized `/workers`
mount. No additional package is required: it uses the existing `better-sqlite3`.

Inspect without applying changes:

```sh
ssh blog 'kubectl -n blog exec deployment/api -- node /app/backend/src/scripts/migrate-worker-state.js --check'
```

During a planned maintenance window, pause requests and background writers that
depend on this store, ensure the intended image is running, and apply:

```sh
ssh blog 'kubectl -n blog exec deployment/api -- node /app/backend/src/scripts/migrate-worker-state.js'
```

`WORKER_STATE_SQLITE_PATH` must identify an existing nonempty imported database.
The CLI refuses a missing database, an empty file, a missing/empty/duplicate D1
ledger, or a ledger without application tables. It never initializes a new store.
Overrides are `--db PATH`, `--migrations-dir DIRECTORY`, and
`--backup-dir DIRECTORY`. The default backup directory is
`worker-state-backups` beside the database. `--check` uses a read-only connection.

Pending files are sorted by filename and selected using `d1_migrations.name`.
Historical ledger entries not present in the image are preserved and reported.
Never edit an applied migration; add a new uniquely named SQL file. This ledger
tracks filenames, not content hashes.

For pending changes the CLI acquires `BEGIN IMMEDIATE`, rereads the ledger, then
creates and integrity-checks a private SQLite backup before executing migration
SQL. A separate read connection captures committed WAL pages. All pending schema
changes, data changes and ledger inserts commit in one transaction after ledger,
integrity and foreign-key validation. A failure rolls back the entire batch and
retains the backup. A repeat run with no pending files makes no backup or writes.
Lock acquisition waits up to five seconds; concurrent requests can fail while
the migration holds the writer lock.

Migration SQL must be transaction-compatible. The runner owns transaction control
and foreign-key settings; explicit transaction commands, `PRAGMA`, `ATTACH`,
`VACUUM` and file/extension operations are rejected. Ordinary triggers and CASE
expressions are supported. Previously applied files are not executed again.

The CLI emits JSON with filenames, paths, applied/pending lists and ledger count;
failures emit error codes without SQL or row values and exit nonzero. Record the
backup path and verify the state-store readiness check before resuming traffic.

## Recovery

For a migration that failed before commit, confirm the rollback and fix the new
migration before retrying. If a committed migration must be reversed before any
new writes, stop all consumers, preserve the current database using SQLite's
backup API, restore the validated pre-migration backup with no connections open,
then reopen using compatible code. Do not copy only a live `.db` file while WAL
contains uncheckpointed changes, or leave unrelated WAL/SHM files beside a
replacement database.

After new application writes, rolling back code must retain the current SQLite
state. Prefer a compatible previous image or a forward schema fix. Restoring an
old snapshot or switching back to the stale D1 binding would lose those writes;
such recovery first requires capturing and reconciling the changes. Keep D1 and
encrypted import artifacts until retention and rollback requirements are met.

Source evidence: `backend/src/services/worker-state-store.service.js`,
`backend/src/routes/workerState.js`, `workers/api-gateway/src/lib/backend-state-db.ts`,
`backend/src/scripts/migrate-worker-state.js`, `backend/Dockerfile`, `k3s/api.yaml`,
and `backend/test/migrate-worker-state.test.js`.
