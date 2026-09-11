> Local integration update: [2026-09-10 integration report](docs/implementation-plan/INTEGRATION-20260910.md). The record below describes the supplied archive; current checks and retained local sources are documented in that report.

# Integrated source — A02 continuation / 2026-09-10

Base: `blog-integrated-r07-1-20260910.zip` (2,031 input files).
This continuation implements shared durable translation admission/execution, safe read-only observation,
checkpoint recovery, execution fencing, bounded admission and backend dispatch. Existing Reader/A01/R07-1 changes are preserved.

- Current PR tasks: [tasks.md](tasks.md)
- Implementation and limits: [IMPLEMENTATION.ko.md](docs/translation-a02/IMPLEMENTATION.ko.md)
- Migration and deployment gates: [DEPLOYMENT.ko.md](docs/translation-a02/DEPLOYMENT.ko.md)
- Isolated tests: `npm run verify:translation` (97 passed; not a full runtime suite)
- Evidence: [verification/translation-a02](verification/translation-a02/)

Not deployed. Translation execution, optional warming and reader image flags remain off.
Apply 0041 only after stopping old translation consumers and validating backups/migration in staging.
New code is not a guarantee of uninterrupted provider execution: unknown submitted results are not automatically regenerated.

A01 runtime/staging, R07-1 real browser/auth integration and A02 locked-dependency Worker/React/Zod/runtime validation remain open.
The supplied input lacks `workers/api-gateway/src/routes/secrets`, `workers/api-gateway/src/lib/secrets` and blog Markdown originals.
No replacement secrets module or fabricated article was added. Do not run frontend prebuild/generate-manifests without the originals.
Long articles (>30,000 characters) are rejected before generation until A04 adds complete block translation.
