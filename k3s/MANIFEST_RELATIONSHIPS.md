# k3s 매니페스트 연관관계 레퍼런스

> 참고: 이 문서의 공개 호스트명, 레지스트리 좌표, 저장소 URL, 이메일 예시는 모두 비식별 placeholder입니다.

## Scope

This document explains every YAML file currently present under `k3s/`, the fields used in each resource, and the runtime relationships between services, workloads, secrets, config, ports, selectors, and storage.

In this document, "column" means a YAML field path such as `spec.selector.app` or `spec.template.metadata.labels.app`.

## File Inventory

| File | Included by `kustomization.yaml` | Resource types | Purpose |
| --- | --- | --- | --- |
| `namespace.yaml` | Yes | `Namespace` | Creates the `blog` namespace |
| `configmap.yaml` | Yes | `ConfigMap` | Non-secret runtime configuration shared across workloads |
| `postgres.yaml` | Yes | `Service`, `StatefulSet` | PostgreSQL database and its headless service |
| `redis.yaml` | Yes | `Service`, `StatefulSet` | Redis cache and its headless service |
| `chromadb.yaml` | Yes | `Service`, `StatefulSet` | Chroma vector DB and its headless service |
| `surrealdb.yaml` | Yes | `Service`, `StatefulSet` | SurrealDB for Open Notebook |
| `open-notebook.yaml` | Yes | `Service`, `Deployment` | Open Notebook app |
| `api.yaml` | Yes | `PersistentVolumeClaim`, `Service`, `Deployment` | Main backend API |
| `ingress.yaml` | Yes | `Ingress` | Public routing for `origin.example.com` |
| `middleware.yaml` | Yes | `Middleware` | Traefik HTTPS redirect middleware |
| `terminal-optional.yaml` | No | `Service`, `Deployment` | Optional terminal runtime using DinD |
| `terminal-ingress-optional.yaml` | No | `Ingress` | Optional terminal public routing |
| `secret-example.yaml` | No | `Secret` | Example app secret values |
| `registry-secret.example.yaml` | No | `Secret` | Example GHCR pull secret |
| `kustomization.yaml` | Entry point | `Kustomization` | Base apply set definition |

## Base vs Optional Apply Set

### Base set

The base set is what `kubectl apply -k k3s` will include:

- `namespace.yaml`
- `configmap.yaml`
- `postgres.yaml`
- `redis.yaml`
- `chromadb.yaml`
- `surrealdb.yaml`
- `open-notebook.yaml`
- `api.yaml`
- `ingress.yaml`
- `middleware.yaml`

### Optional set

The following files are not included in the base set and must be applied explicitly if needed:

- `terminal-optional.yaml`
- `terminal-ingress-optional.yaml`
- `secret-example.yaml`
- `registry-secret.example.yaml`

## High-Level Runtime Graph

```text
Internet / Cloudflare
  -> Ingress blog-backend
    -> Service api
      -> Deployment api
        -> ConfigMap blog-app-config
        -> Secret blog-app-secrets
        -> PVC api-sqlite
        -> initContainer sync-repo
          -> repo-data emptyDir
        -> mounted repo views:
           /frontend
           /workers
           /backend

api
  -> postgres Service -> postgres StatefulSet -> PVC(data)
  -> redis Service -> redis StatefulSet -> PVC(data)
  -> chromadb Service -> chromadb StatefulSet -> PVC(data)
  -> open-notebook Service -> open-notebook Deployment

open-notebook
  -> surrealdb Service -> surrealdb StatefulSet -> PVC(data)
  -> Secret blog-app-secrets
  -> ConfigMap blog-app-config

Optional:
Ingress terminal-origin
  -> Service terminal-server
    -> Deployment terminal-server
      -> dind sidecar
      -> Secret blog-app-secrets
      -> ConfigMap blog-app-config
```

## Kubernetes Field Primer

These are the recurring fields used across the manifests.

| Field path | Meaning |
| --- | --- |
| `apiVersion` | API group + version for the resource kind |
| `kind` | Kubernetes resource type |
| `metadata.name` | Resource name inside the namespace |
| `metadata.namespace` | Target namespace |
| `spec.selector` | Label-based selection condition |
| `spec.selector.matchLabels` | Equality-based selector for workloads |
| `spec.template.metadata.labels` | Labels attached to Pods created by the workload |
| `spec.ports[].port` | Service-facing port |
| `spec.ports[].targetPort` | Container port or named port that Service forwards to |
| `spec.serviceName` | Governing service for a StatefulSet |
| `spec.clusterIP: None` | Headless Service |
| `env` | Explicit environment variables |
| `envFrom` | Import all keys from `ConfigMap` or `Secret` |
| `configMapKeyRef` | Pull one named key from a ConfigMap |
| `secretKeyRef` | Pull one named key from a Secret |
| `volumeMounts` | Mount named volumes into the container filesystem |
| `volumes` | Pod-scoped volumes |
| `volumeClaimTemplates` | Per-pod PVC templates for StatefulSets |
| `persistentVolumeClaim.claimName` | Reference an existing PVC by name |
| `imagePullSecrets` | Secret used to pull private container images |
| `initContainers` | Containers that must finish before app containers start |
| `readinessProbe` | Marks Pod ready for traffic |
| `livenessProbe` | Detects stuck or dead container |
| `ingressClassName` | Which ingress controller should handle the Ingress |
| `spec.rules` | Host/path routing rules in an Ingress |
| `spec.tls` | TLS host list and backing secret |
| `metadata.annotations` | Controller-specific metadata, here mainly for Traefik |

## Label and Selector Model

The current manifests use a simple single-label convention:

- `app: api`
- `app: postgres`
- `app: redis`
- `app: chromadb`
- `app: surrealdb`
- `app: open-notebook`
- `app: terminal-server`

Think of this as a `WHERE app = '...'` condition, not a database primary key.

### How it works in the current files

| Resource type | Selector location | Label location | Result |
| --- | --- | --- | --- |
| `Service` | `spec.selector.app` | Pod labels | Traffic is sent to matching Pods |
| `Deployment` | `spec.selector.matchLabels.app` | `spec.template.metadata.labels.app` | Deployment manages matching Pods and stamps the same label on new Pods |
| `StatefulSet` | `spec.selector.matchLabels.app` | `spec.template.metadata.labels.app` | StatefulSet manages matching Pods and stamps the same label on new Pods |

### Current concrete mappings

| Service/workload | Selector | Pod label source | Effect |
| --- | --- | --- | --- |
| `api` Service | `app=api` | `api` Deployment template | Requests go to backend API Pods |
| `postgres` Service | `app=postgres` | `postgres` StatefulSet template | DB DNS name reaches PostgreSQL Pods |
| `redis` Service | `app=redis` | `redis` StatefulSet template | Redis DNS name reaches Redis Pods |
| `chromadb` Service | `app=chromadb` | `chromadb` StatefulSet template | Chroma DNS name reaches Chroma Pods |
| `surrealdb` Service | `app=surrealdb` | `surrealdb` StatefulSet template | Surreal DNS name reaches SurrealDB Pods |
| `open-notebook` Service | `app=open-notebook` | `open-notebook` Deployment template | Internal notebook service discovery |
| `terminal-server` Service | `app=terminal-server` | `terminal-server` Deployment template | Optional terminal routing |

## Kustomization

File: `kustomization.yaml`

### Field breakdown

| Path | Value | Meaning |
| --- | --- | --- |
| `apiVersion` | `kustomize.config.k8s.io/v1beta1` | Kustomize API version |
| `kind` | `Kustomization` | Declares this file as the apply entry point |
| `resources[]` | list of filenames | Base set to render and apply together |

### Relationship

- This file controls what the base deployment means.
- It currently includes `middleware.yaml` and `ingress.yaml`, so the HTTPS redirect middleware is part of the base set.
- It does not include terminal-related optional files or example secrets.

## Namespace

File: `namespace.yaml`

### Field breakdown

| Path | Value | Meaning |
| --- | --- | --- |
| `kind` | `Namespace` | Namespace resource |
| `metadata.name` | `blog` | All resources use this namespace |

### Relationship

- Every manifest in the base set uses `namespace: blog`.
- If this namespace does not exist, the other resources cannot be created into it.

## Middleware

File: `middleware.yaml`

### Field breakdown

| Path | Value | Meaning |
| --- | --- | --- |
| `apiVersion` | `traefik.io/v1alpha1` | Traefik CRD group |
| `kind` | `Middleware` | Traefik middleware resource |
| `metadata.name` | `redirect-https` | Middleware name |
| `spec.redirectScheme.scheme` | `https` | Redirect target scheme |
| `spec.redirectScheme.permanent` | `true` | Permanent redirect |

### Relationship

- `ingress.yaml` references this middleware with `traefik.ingress.kubernetes.io/router.middlewares: blog-redirect-https@kubernetescrd`.
- The effective reference name is `<namespace>-<middlewareName>@kubernetescrd`, so `blog-redirect-https@kubernetescrd` points to `redirect-https` in the `blog` namespace.

## ConfigMap

File: `configmap.yaml`

Resource name: `blog-app-config`

### Key inventory

| Key | Value | Main consumers | Purpose |
| --- | --- | --- | --- |
| `APP_ENV` | `production` | `api` | App environment |
| `HOST` | `0.0.0.0` | `api` | Bind host |
| `PORT` | `5080` | `api` | API listen port |
| `TRUST_PROXY` | `1` | `api` | Proxy trust depth |
| `LOG_LEVEL` | `info` | `api` | Log verbosity |
| `SITE_BASE_URL` | `https://blog.example.com` | `api` | Public site URL |
| `API_BASE_URL` | `https://api.example.com` | `api` | Public API base URL |
| `ALLOWED_ORIGINS` | `https://blog.example.com,http://localhost:5173` | `api` | CORS allow list |
| `RATE_LIMIT_MAX` | `60` | `api` | Request limit |
| `RATE_LIMIT_WINDOW_MS` | `60000` | `api` | Rate limit window |
| `AI_DEFAULT_MODEL` | `gpt-4.1` | `api`, `open-notebook` | Default LLM model |
| `AI_ASYNC_MODE` | `false` | `api` | Async AI toggle |
| `AI_EMBED_MODEL` | `text-embedding-3-small` | `api`, `open-notebook` | Embedding model |
| `CHROMA_URL` | `http://chromadb:8000` | `api` | Internal Chroma endpoint |
| `CHROMA_COLLECTION` | `blog-posts__all-MiniLM-L6-v2` | `api` | Chroma collection name |
| `SQLITE_PATH` | `/app/.data/blog.db` | `api` | SQLite file path |
| `SQLITE_MIGRATIONS_DIR` | `/workers/migrations` | `api` | Migration directory |
| `CONTENT_PUBLIC_DIR` | `/frontend/public` | `api` | Content root |
| `CONTENT_POSTS_DIR` | `/frontend/public/posts` | `api` | Posts directory |
| `CONTENT_IMAGES_DIR` | `/frontend/public/images` | `api` | Images directory |
| `POSTS_SOURCE` | `filesystem` | `api` | Post source type |
| `OPEN_NOTEBOOK_URL` | `http://open-notebook:8501` | `api` | Internal notebook endpoint |
| `OPEN_NOTEBOOK_ENABLED` | `true` | `api` | Notebook feature flag |
| `TERMINAL_SERVER_URL` | `http://terminal-server:8080` | `api` | Internal terminal endpoint |
| `TERMINAL_GATEWAY_URL` | `https://terminal.example.com` | `api` | Public terminal gateway URL |
| `FEATURE_AI_ENABLED` | `true` | `api` | AI feature flag |
| `FEATURE_RAG_ENABLED` | `true` | `api` | RAG feature flag |
| `FEATURE_TERMINAL_ENABLED` | `false` | `api` | Terminal feature flag |
| `FEATURE_AI_INLINE` | `true` | `api` | Inline AI feature flag |
| `FEATURE_COMMENTS_ENABLED` | `true` | `api` | Comments feature flag |
| `USE_CONSUL` | `false` | `api` | Disable Consul runtime overlay |
| `POSTGRES_DB` | `bloganalytics` | `postgres` | DB name for PostgreSQL |
| `POSTGRES_USER` | `bloguser` | `postgres` | DB user for PostgreSQL |
| `CONTENT_GIT_REPO` | `https://github.com/example-org/blog.git` | `api.initContainer` | Repo URL for repo sync |
| `CONTENT_GIT_REF` | `main` | `api.initContainer` | Branch or ref to clone |
| `SANDBOX_IMAGE` | `alpine:latest` | `terminal-server` optional | Default terminal sandbox image |

### Relationship

- `api` imports the whole ConfigMap with `envFrom`.
- `open-notebook` pulls selected keys with `configMapKeyRef`.
- `postgres` uses `POSTGRES_DB` and `POSTGRES_USER`.
- Optional `terminal-server` uses `SANDBOX_IMAGE`.

## App Secret Example

File: `secret-example.yaml`

Resource name: `blog-app-secrets`

This file is an example and is not applied automatically.

### Key inventory

| Key | Main consumers | Purpose |
| --- | --- | --- |
| `BACKEND_KEY` | `api`, optional `terminal-server` | Internal shared auth key |
| `AI_SERVER_URL` | `api`, `open-notebook` | OpenAI-compatible base URL |
| `AI_API_KEY` | `api`, `open-notebook` | Primary AI key |
| `AI_EMBEDDING_URL` | `api`, `open-notebook` | Embedding endpoint |
| `AI_EMBEDDING_API_KEY` | `api`, `open-notebook` | Embedding key |
| `DATABASE_URL` | `api` | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | `postgres`, indirectly `api` if embedded in `DATABASE_URL` | DB password |
| `REDIS_URL` | `api` | Redis connection string |
| `REDIS_PASSWORD` | `redis` | Optional Redis auth |
| `JWT_SECRET` | `api` | JWT signing key |
| `ADMIN_BEARER_TOKEN` | `api` | Admin bearer token |
| `TOTP_SECRET` | `api` | OTP/TOTP secret |
| `ADMIN_ALLOWED_EMAILS` | `api` | Allowed admin email list |
| `GITHUB_TOKEN` | `api` | GitHub automation access |
| `GITHUB_REPO_OWNER` | `api` | Repo owner |
| `GITHUB_REPO_NAME` | `api` | Repo name |
| `GIT_USER_NAME` | `api` | Git commit display name |
| `GIT_USER_EMAIL` | `api` | Git commit email |
| `GITHUB_CLIENT_ID` | `api` | GitHub OAuth client id |
| `GITHUB_CLIENT_SECRET` | `api` | GitHub OAuth client secret |
| `GOOGLE_CLIENT_ID` | `api` | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | `api` | Google OAuth client secret |
| `OAUTH_REDIRECT_BASE_URL` | `api` | OAuth callback base URL |
| `VERCEL_DEPLOY_HOOK_URL` | `api` | Vercel deploy hook |
| `PERPLEXITY_API_KEY` | `api` | Search provider key |
| `TAVILY_API_KEY` | `api` | Search provider key |
| `BRAVE_SEARCH_API_KEY` | `api` | Search provider key |
| `SERPER_API_KEY` | `api` | Search provider key |
| `SURREALDB_ROOT_PASSWORD` | `surrealdb`, `open-notebook` | SurrealDB root password |
| `CONTENT_GIT_REPO_AUTH` | `api.initContainer` | Authenticated Git URL override |

### Relationship

- `api` imports the whole Secret with `envFrom`.
- `open-notebook`, `postgres`, `redis`, `surrealdb`, and optional `terminal-server` read selected keys from this Secret.
- Since this is only an example file, a real secret with the same name must be created before deployment.

## Registry Secret Example

File: `registry-secret.example.yaml`

### Field breakdown

| Path | Meaning |
| --- | --- |
| `kind: Secret` | Secret resource |
| `type: kubernetes.io/dockerconfigjson` | Secret format for image pull auth |
| `metadata.name: ghcr-creds` | Secret name expected by `imagePullSecrets` |
| `stringData[".dockerconfigjson"]` | Docker auth JSON payload |

### Relationship

- `api` and optional `terminal-server` use `imagePullSecrets: ghcr-creds`.
- If GHCR images are private, a real secret with this name must exist.

## API Manifest

File: `api.yaml`

This file defines three resources.

### Resource 1: `PersistentVolumeClaim api-sqlite`

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `metadata.name` | `api-sqlite` | PVC name | Referenced by `Deployment api` |
| `spec.accessModes[0]` | `ReadWriteOnce` | Single-node writer mode | Matches local-path usage |
| `spec.storageClassName` | `local-path` | k3s default local storage | Backs SQLite data |
| `spec.resources.requests.storage` | `5Gi` | Requested disk size | SQLite capacity |

### Resource 2: `Service api`

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `spec.selector.app` | `api` | Select Pods with `app=api` | Must match Deployment Pod labels |
| `spec.ports[0].port` | `5080` | Service port | Ingress points here |
| `spec.ports[0].targetPort` | `http` | Named container port | Resolves to Deployment container port `http` |

### Resource 3: `Deployment api`

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `spec.replicas` | `1` | Single replica | Needed because SQLite is local |
| `spec.strategy.type` | `Recreate` | Do not overlap old and new Pods | Avoid multi-writer PVC issues |
| `spec.selector.matchLabels.app` | `api` | Deployment-owned Pod selector | Must match template labels |
| `spec.template.metadata.labels.app` | `api` | Label stamped on Pods | Must match Service selector and Deployment selector |
| `spec.imagePullSecrets[0].name` | `ghcr-creds` | Pull auth for GHCR image | Needs real secret if image is private |
| `initContainers[0].name` | `sync-repo` | Pre-start repo sync | Populates repo content into `emptyDir` |
| `initContainers[0].image` | `alpine/git:2.47.2` | Git client image | Used only before app starts |
| `initContainers[0].command` | shell clone script | Clones repo ref | Uses `CONTENT_GIT_REPO(_AUTH)` and `CONTENT_GIT_REF` |
| `initContainers[0].envFrom` | ConfigMap + Secret | Imports repo sync values | Reads git config from app config/secret |
| `initContainers[0].volumeMounts[0]` | `/repo` | Mount target for clone | Backed by `repo-data` |
| `containers[0].image` | `ghcr.io/example-org/blog-api:latest` | Backend image | Main app container |
| `containers[0].ports[0].name` | `http` | Named container port | Referenced by Service targetPort |
| `containers[0].ports[0].containerPort` | `5080` | Backend listen port | Service forwards here |
| `containers[0].envFrom` | ConfigMap + Secret | Imports runtime env | Main config source for API |
| `volumeMounts[name=sqlite-data]` | `/app/.data` | SQLite data path | Backed by PVC `api-sqlite` |
| `volumeMounts[name=repo-data][subPath=frontend]` | `/frontend` | Frontend content mount | Gives API filesystem content access |
| `volumeMounts[name=repo-data][subPath=workers]` | `/workers` | Workers config/migrations mount | Gives API worker file visibility |
| `volumeMounts[name=repo-data][subPath=backend]` | `/backend` | Backend repo view | Keeps repo-relative paths available |
| `readinessProbe.httpGet.path` | `/api/v1/healthz` | Ready check endpoint | Service sends traffic only after success |
| `livenessProbe.httpGet.path` | `/api/v1/healthz` | Liveness endpoint | Restarts unhealthy container |
| `resources.requests/limits` | CPU/memory values | Scheduling and cap | Container resource policy |
| `volumes[name=sqlite-data].persistentVolumeClaim.claimName` | `api-sqlite` | Connects PVC to Pod | Storage link |
| `volumes[name=repo-data].emptyDir` | `{}` | Ephemeral shared volume | Shared between initContainer and app container |

### API relationships

- `Ingress blog-backend` routes `/api` traffic to `Service api`.
- `Service api` targets Pods labeled `app=api`.
- `Deployment api` creates Pods labeled `app=api`.
- `Deployment api` consumes both `blog-app-config` and `blog-app-secrets`.
- `Deployment api` mounts `api-sqlite` PVC and uses repo sync to expose `/frontend`, `/workers`, and `/backend`.

## PostgreSQL Manifest

File: `postgres.yaml`

### Resource 1: `Service postgres`

| Path | Value | Meaning |
| --- | --- | --- |
| `spec.clusterIP` | `None` | Headless Service |
| `spec.selector.app` | `postgres` | Select PostgreSQL Pods |
| `spec.ports[0].port` | `5432` | Service port |
| `spec.ports[0].targetPort` | `postgres` | Named container port |

### Resource 2: `StatefulSet postgres`

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `spec.serviceName` | `postgres` | Governing service | Must align with headless Service |
| `spec.replicas` | `1` | Single DB replica | Current topology |
| `spec.selector.matchLabels.app` | `postgres` | Pod ownership selector | Must match template label |
| `spec.template.metadata.labels.app` | `postgres` | Pod label | Must match Service selector |
| `containers[0].image` | `postgres:16-alpine` | DB image | Main DB runtime |
| `env[POSTGRES_DB]` | from ConfigMap | Database name | Uses `blog-app-config` |
| `env[POSTGRES_USER]` | from ConfigMap | Database user | Uses `blog-app-config` |
| `env[POSTGRES_PASSWORD]` | from Secret | Database password | Uses `blog-app-secrets` |
| `volumeMounts[0].mountPath` | `/var/lib/postgresql/data` | Data directory | Backed by StatefulSet PVC |
| `readinessProbe.exec` | `pg_isready ...` | Ready probe | Confirms DB accepts connections |
| `livenessProbe.exec` | `pg_isready ...` | Liveness probe | Restarts broken DB container |
| `volumeClaimTemplates[0].metadata.name` | `data` | PVC template name | Mounted as `data` |
| `volumeClaimTemplates[0].spec.resources.requests.storage` | `20Gi` | Requested storage | DB capacity |

### PostgreSQL relationships

- `api` connects using `DATABASE_URL` from Secret.
- The service DNS name is `postgres`.
- Because the Service is headless and the StatefulSet is named `postgres`, stable network identity is available.

## Redis Manifest

File: `redis.yaml`

### Resource 1: `Service redis`

| Path | Value | Meaning |
| --- | --- | --- |
| `spec.clusterIP` | `None` | Headless Service |
| `spec.selector.app` | `redis` | Select Redis Pods |
| `spec.ports[0].port` | `6379` | Service port |
| `spec.ports[0].targetPort` | `redis` | Named container port |

### Resource 2: `StatefulSet redis`

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `spec.serviceName` | `redis` | Governing service | Must align with headless Service |
| `spec.selector.matchLabels.app` | `redis` | Pod ownership selector | Must match template label |
| `spec.template.metadata.labels.app` | `redis` | Pod label | Must match Service selector |
| `containers[0].image` | `redis:7-alpine` | Redis image | Main cache runtime |
| `containers[0].command` | shell script | Starts Redis with or without password | Reads `REDIS_PASSWORD` |
| `env[REDIS_PASSWORD]` | optional Secret value | Optional auth | Comes from `blog-app-secrets` |
| `volumeMounts[0].mountPath` | `/data` | Redis persistence directory | Backed by PVC |
| `readinessProbe.tcpSocket.port` | `redis` | Ready probe | TCP readiness |
| `livenessProbe.tcpSocket.port` | `redis` | Liveness probe | TCP health |
| `volumeClaimTemplates[0].metadata.name` | `data` | PVC template name | Mounted as `data` |
| `volumeClaimTemplates[0].spec.resources.requests.storage` | `4Gi` | Requested storage | Cache persistence capacity |

### Redis relationships

- `api` reads `REDIS_URL` from Secret and uses service DNS `redis`.
- Password is optional; Redis boot command branches based on whether `REDIS_PASSWORD` is set.

## ChromaDB Manifest

File: `chromadb.yaml`

### Resource 1: `Service chromadb`

| Path | Value | Meaning |
| --- | --- | --- |
| `spec.clusterIP` | `None` | Headless Service |
| `spec.selector.app` | `chromadb` | Select Chroma Pods |
| `spec.ports[0].port` | `8000` | Service port |
| `spec.ports[0].targetPort` | `http` | Named container port |

### Resource 2: `StatefulSet chromadb`

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `spec.serviceName` | `chromadb` | Governing service | Must align with headless Service |
| `spec.selector.matchLabels.app` | `chromadb` | Pod ownership selector | Must match template label |
| `spec.template.metadata.labels.app` | `chromadb` | Pod label | Must match Service selector |
| `containers[0].image` | `chromadb/chroma:latest` | Chroma image | Main vector DB runtime |
| `env[ANONYMIZED_TELEMETRY]` | `false` | Disable telemetry | Chroma setting |
| `env[ALLOW_RESET]` | `false` | Disallow destructive reset | Chroma safety setting |
| `volumeMounts[0].mountPath` | `/chroma/chroma` | Data directory | Backed by PVC |
| `readinessProbe.httpGet.path` | `/api/v2/heartbeat` | Ready endpoint | HTTP readiness |
| `livenessProbe.httpGet.path` | `/api/v2/heartbeat` | Liveness endpoint | HTTP health |
| `volumeClaimTemplates[0].metadata.name` | `data` | PVC template name | Mounted as `data` |
| `volumeClaimTemplates[0].spec.resources.requests.storage` | `20Gi` | Requested storage | Vector store capacity |

### Chroma relationships

- `api` uses `CHROMA_URL=http://chromadb:8000`.
- The Chroma service name is hard-coded into the ConfigMap and consumed by the API via `envFrom`.

## SurrealDB Manifest

File: `surrealdb.yaml`

### Resource 1: `Service surrealdb`

| Path | Value | Meaning |
| --- | --- | --- |
| `spec.clusterIP` | `None` | Headless Service |
| `spec.selector.app` | `surrealdb` | Select SurrealDB Pods |
| `spec.ports[0].port` | `8000` | Service port |
| `spec.ports[0].targetPort` | `http` | Named container port |

### Resource 2: `StatefulSet surrealdb`

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `spec.serviceName` | `surrealdb` | Governing service | Must align with headless Service |
| `spec.selector.matchLabels.app` | `surrealdb` | Pod ownership selector | Must match template label |
| `spec.template.metadata.labels.app` | `surrealdb` | Pod label | Must match Service selector |
| `containers[0].image` | `surrealdb/surrealdb:v2` | SurrealDB image | Main DB runtime |
| `containers[0].command` | `/surreal start ... rocksdb:///data/database.db` | Start command | Uses local RocksDB storage |
| `env[SURREAL_PASS]` | Secret value | Root password | From `blog-app-secrets` |
| `env[SURREAL_USER]` | `root` | Root user | Static |
| `volumeMounts[0].mountPath` | `/data` | Data directory | Backed by PVC |
| `readinessProbe.tcpSocket.port` | `http` | Ready probe | TCP readiness |
| `livenessProbe.tcpSocket.port` | `http` | Liveness probe | TCP health |
| `volumeClaimTemplates[0].metadata.name` | `data` | PVC template name | Mounted as `data` |
| `volumeClaimTemplates[0].spec.resources.requests.storage` | `10Gi` | Requested storage | Surreal capacity |

### Surreal relationships

- `open-notebook` connects to `ws://surrealdb:8000/rpc`.
- `open-notebook` waits for this service in an initContainer before starting.

## Open Notebook Manifest

File: `open-notebook.yaml`

This file defines two resources.

### Resource 1: `Service open-notebook`

| Path | Value | Meaning |
| --- | --- | --- |
| `spec.selector.app` | `open-notebook` | Select notebook Pods |
| `spec.ports[0].port` | `8501` | Service port |
| `spec.ports[0].targetPort` | `web` | Named container port |

### Resource 2: `Deployment open-notebook`

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `spec.replicas` | `1` | Single notebook instance | Current topology |
| `spec.selector.matchLabels.app` | `open-notebook` | Pod ownership selector | Must match template label |
| `spec.template.metadata.labels.app` | `open-notebook` | Pod label | Must match Service selector |
| `initContainers[0].name` | `wait-for-surrealdb` | Pre-start wait step | Blocks notebook until SurrealDB is reachable |
| `initContainers[0].command` | `until nc -zw2 surrealdb 8000 ...` | Wait loop | Uses service DNS `surrealdb` |
| `containers[0].image` | `lfnovo/open_notebook:v1-latest` | Notebook image | Main notebook runtime |
| `ports[name=web]` | `8501` | App port | Exposed by Service |
| `ports[name=health]` | `5055` | Health port | Used by probes |
| `env[SURREAL_URL]` | `ws://surrealdb:8000/rpc` | DB endpoint | Connects to SurrealDB Service |
| `env[SURREAL_USER]` | `root` | DB user | Static |
| `env[SURREAL_PASSWORD]` | Secret value | DB password | From `blog-app-secrets` |
| `env[SURREAL_NAMESPACE]` | `open_notebook` | Surreal namespace | Notebook config |
| `env[SURREAL_DATABASE]` | `open_notebook` | Surreal database | Notebook config |
| `env[DEFAULT_CHAT_MODEL]` | ConfigMap value | Chat model | From `AI_DEFAULT_MODEL` |
| `env[DEFAULT_TRANSFORMATION_MODEL]` | ConfigMap value | Transform model | From `AI_DEFAULT_MODEL` |
| `env[OPENAI_API_KEY]` | Secret value | AI key | From `AI_API_KEY` |
| `env[OPENAI_COMPATIBLE_BASE_URL]` | Secret value | OpenAI-compatible base URL | From `AI_SERVER_URL` |
| `env[OPENAI_COMPATIBLE_API_KEY]` | Secret value | Compatible API key | From `AI_API_KEY` |
| `env[OPENAI_COMPATIBLE_BASE_URL_LLM]` | Secret value | LLM endpoint | From `AI_SERVER_URL` |
| `env[OPENAI_COMPATIBLE_API_KEY_LLM]` | Secret value | LLM key | From `AI_API_KEY` |
| `env[OPENAI_COMPATIBLE_BASE_URL_EMBEDDING]` | Secret value | Embedding endpoint | From `AI_EMBEDDING_URL` |
| `env[OPENAI_COMPATIBLE_API_KEY_EMBEDDING]` | Secret value | Embedding key | From `AI_EMBEDDING_API_KEY` |
| `env[OPENAI_API_BASE]` | Secret value | Base API URL | From `AI_SERVER_URL` |
| `env[DEFAULT_EMBEDDING_MODEL]` | ConfigMap value | Embedding model | From `AI_EMBED_MODEL` |
| `env[EMBEDDING_API_KEY]` | Secret value | Embedding API key | From `AI_EMBEDDING_API_KEY` |
| `env[EMBEDDING_API_BASE]` | Secret value | Embedding API base | From `AI_EMBEDDING_URL` |
| `readinessProbe.httpGet.path` | `/health` | Ready endpoint | Uses `health` named port |
| `livenessProbe.httpGet.path` | `/health` | Liveness endpoint | Uses `health` named port |

### Open Notebook relationships

- `api` may call it through `OPEN_NOTEBOOK_URL=http://open-notebook:8501`.
- It depends on `surrealdb` service availability.
- It consumes both ConfigMap and Secret values but only through explicit key refs, not `envFrom`.

## Ingress Manifest

File: `ingress.yaml`

### Field breakdown

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `metadata.name` | `blog-backend` | Ingress resource name | Public HTTP entry |
| `metadata.annotations["traefik.ingress.kubernetes.io/router.entrypoints"]` | `web,websecure` | Traefik listens on both HTTP and HTTPS entrypoints | Controller behavior |
| `metadata.annotations["traefik.ingress.kubernetes.io/router.tls"]` | `true` | Enable TLS routing | Works with `spec.tls` |
| `metadata.annotations["traefik.ingress.kubernetes.io/router.middlewares"]` | `blog-redirect-https@kubernetescrd` | Attach redirect middleware | Refers to `middleware.yaml` |
| `spec.ingressClassName` | `traefik` | Ingress controller | Must exist in cluster |
| `spec.tls[0].secretName` | `blog-origin-tls` | TLS secret | Must be created separately |
| `spec.tls[0].hosts[0]` | `origin.example.com` | TLS host | Covered by secret |
| `spec.rules[0].host` | `origin.example.com` | Host routing | Public hostname |
| `spec.rules[0].http.paths[0].path` | `/api` | Prefix route | Only API paths are exposed |
| `spec.rules[0].http.paths[0].backend.service.name` | `api` | Target Service | Sends traffic to `Service api` |
| `spec.rules[0].http.paths[0].backend.service.port.name` | `http` | Target service port | Resolves to `api` service port |

### Ingress relationships

- Host `origin.example.com` + path `/api` goes to `Service api`.
- Redirect middleware is attached via annotation.
- TLS requires a real `blog-origin-tls` secret.

## Optional Terminal Runtime

File: `terminal-optional.yaml`

This file defines two optional resources and is not part of the base kustomization.

### Resource 1: `Service terminal-server`

| Path | Value | Meaning |
| --- | --- | --- |
| `spec.selector.app` | `terminal-server` | Select terminal Pods |
| `spec.ports[0].port` | `8080` | Service port |
| `spec.ports[0].targetPort` | `http` | Named container port |

### Resource 2: `Deployment terminal-server`

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `spec.replicas` | `1` | Single terminal runtime | Current topology |
| `spec.selector.matchLabels.app` | `terminal-server` | Pod ownership selector | Must match template label |
| `spec.template.metadata.labels.app` | `terminal-server` | Pod label | Must match Service selector |
| `spec.imagePullSecrets[0].name` | `ghcr-creds` | GHCR pull auth | Needed if image is private |
| `containers[0].name` | `dind` | Docker-in-Docker sidecar | Provides Docker socket to app |
| `containers[0].image` | `docker:27-dind` | DinD image | Runs nested Docker daemon |
| `containers[0].args[0]` | `--host=unix:///var/run/docker.sock` | Exposes local Unix socket | Shared via volume |
| `containers[0].env[DOCKER_TLS_CERTDIR]` | empty string | Disables TLS cert dir | Simplifies local socket use |
| `containers[0].securityContext.privileged` | `true` | Required for DinD | Security-sensitive |
| `containers[0].volumeMounts` | `/var/run`, `/var/lib/docker` | Socket and graph storage | Backed by `emptyDir` volumes |
| `containers[0].startupProbe.exec` | `docker info ...` | DinD readiness | Wait until Docker daemon is alive |
| `containers[1].name` | `terminal-server` | App container | Main terminal server |
| `containers[1].image` | `ghcr.io/example-org/blog-terminal:latest` | Terminal image | App workload |
| `ports[name=http]` | `8080` | App port | Exposed by Service |
| `env[BACKEND_KEY]` | Secret value | Internal auth key | From `blog-app-secrets` |
| `env[SANDBOX_IMAGE]` | ConfigMap value | Per-session sandbox image | From `blog-app-config` |
| `env[DOCKER_HOST]` | `unix:///var/run/docker.sock` | Docker socket path | Targets DinD sidecar |
| `volumeMounts[0].mountPath` | `/var/run` | Socket mount | Shared with DinD |
| `startupProbe.exec` | `test -S /var/run/docker.sock` | Wait for socket file | App startup gate |
| `readinessProbe.httpGet.path` | `/health` | Ready endpoint | Optional service health |
| `livenessProbe.httpGet.path` | `/health` | Liveness endpoint | Restarts broken app |
| `volumes[docker-sock]` | `emptyDir` | Shared Unix socket volume | Between DinD and app |
| `volumes[docker-graph]` | `emptyDir` | DinD image/container storage | Ephemeral nested Docker data |

### Terminal relationships

- Optional `terminal-ingress-optional.yaml` routes public traffic here.
- Terminal app reads `BACKEND_KEY` from Secret and `SANDBOX_IMAGE` from ConfigMap.
- This workload is intentionally optional because it requires privileged DinD.

## Optional Terminal Ingress

File: `terminal-ingress-optional.yaml`

### Field breakdown

| Path | Value | Meaning | Related resource |
| --- | --- | --- | --- |
| `metadata.name` | `terminal-origin` | Ingress name | Optional public terminal entry |
| `spec.ingressClassName` | `traefik` | Ingress controller | Must exist in cluster |
| `spec.tls[0].secretName` | `blog-origin-tls` | TLS secret | Shared TLS source |
| `spec.tls[0].hosts[0]` | `terminal-origin.example.com` | TLS host | Terminal origin host |
| `spec.rules[0].host` | `terminal-origin.example.com` | Host routing | Public hostname |
| `spec.rules[0].http.paths[0].path` | `/terminal` | Prefix route | WebSocket/terminal route |
| `spec.rules[0].http.paths[0].backend.service.name` | `terminal-server` | Target Service | Routes to optional terminal service |
| `spec.rules[0].http.paths[0].backend.service.port.name` | `http` | Target Service port | Resolves to Service port |

## Port Mapping Matrix

| Public or internal entry | Resource | Port | Backing workload/container port |
| --- | --- | --- | --- |
| `origin.example.com/api` | `Ingress blog-backend` | HTTPS | `Service api:5080` -> `Deployment api containerPort 5080` |
| `api` internal DNS | `Service api` | `5080` | `api` container `http` |
| `postgres` internal DNS | `Service postgres` | `5432` | `postgres` container `postgres` |
| `redis` internal DNS | `Service redis` | `6379` | `redis` container `redis` |
| `chromadb` internal DNS | `Service chromadb` | `8000` | `chromadb` container `http` |
| `surrealdb` internal DNS | `Service surrealdb` | `8000` | `surrealdb` container `http` |
| `open-notebook` internal DNS | `Service open-notebook` | `8501` | `open-notebook` container `web` |
| `terminal-origin.example.com/terminal` | optional Ingress | HTTPS | `Service terminal-server:8080` -> `terminal-server` container `8080` |

## Storage Matrix

| Workload | Storage mechanism | Mount path | Persistence |
| --- | --- | --- | --- |
| `api` | PVC `api-sqlite` | `/app/.data` | Persistent |
| `api` repo sync | `emptyDir repo-data` | `/repo` in initContainer, then `/frontend`, `/workers`, `/backend` in app | Ephemeral per Pod |
| `postgres` | `volumeClaimTemplates:data` | `/var/lib/postgresql/data` | Persistent |
| `redis` | `volumeClaimTemplates:data` | `/data` | Persistent |
| `chromadb` | `volumeClaimTemplates:data` | `/chroma/chroma` | Persistent |
| `surrealdb` | `volumeClaimTemplates:data` | `/data` | Persistent |
| optional `terminal-server` DinD | `emptyDir docker-sock` | `/var/run` | Ephemeral |
| optional `terminal-server` DinD | `emptyDir docker-graph` | `/var/lib/docker` | Ephemeral |

## Config Consumption Matrix

| Consumer | ConfigMap usage | Secret usage |
| --- | --- | --- |
| `api.initContainer sync-repo` | full `envFrom` import | full `envFrom` import |
| `api` main container | full `envFrom` import | full `envFrom` import |
| `postgres` | `POSTGRES_DB`, `POSTGRES_USER` | `POSTGRES_PASSWORD` |
| `redis` | none | `REDIS_PASSWORD` optional |
| `chromadb` | none | none |
| `surrealdb` | none | `SURREALDB_ROOT_PASSWORD` |
| `open-notebook` | `AI_DEFAULT_MODEL`, `AI_EMBED_MODEL` | AI URL/key set + `SURREALDB_ROOT_PASSWORD` |
| optional `terminal-server` | `SANDBOX_IMAGE` | `BACKEND_KEY` |

## Service Discovery Rules Used by the Current Templates

- `api` expects:
  - `postgres` via `DATABASE_URL`
  - `redis` via `REDIS_URL`
  - `chromadb` via `CHROMA_URL`
  - `open-notebook` via `OPEN_NOTEBOOK_URL`
  - optional `terminal-server` via `TERMINAL_SERVER_URL`

- `open-notebook` expects:
  - `surrealdb` via `SURREAL_URL=ws://surrealdb:8000/rpc`

- optional `terminal-server` expects:
  - nested Docker daemon via `DOCKER_HOST=unix:///var/run/docker.sock`

## Operational Notes from the Current Design

1. `api` is intentionally single-replica because it keeps SQLite on a PVC and also uses `Recreate`.
2. Stateful services use headless Services because they are paired with StatefulSets.
3. The repo-sync model is ephemeral because it relies on `emptyDir`.
4. Example Secrets are documentation only and are not part of `kubectl apply -k k3s`.
5. Optional terminal manifests are separate because they change the security profile of the cluster.
6. HTTPS redirect behavior depends on Traefik CRDs being installed and the `Middleware` resource being accepted.

## If You Need to Trace One Request

### Public API request

```text
Client
  -> Ingress blog-backend
  -> Service api
  -> Pod label app=api
  -> Deployment api container
```

### API request that needs Chroma

```text
api container
  -> CHROMA_URL=http://chromadb:8000
  -> Service chromadb
  -> Pod label app=chromadb
  -> StatefulSet chromadb container
```

### Notebook startup

```text
Deployment open-notebook
  -> initContainer wait-for-surrealdb
  -> Service surrealdb
  -> StatefulSet surrealdb
  -> open-notebook main container starts
```

### Optional terminal request

```text
Client
  -> Ingress terminal-origin
  -> Service terminal-server
  -> terminal-server container
  -> DOCKER_HOST unix socket
  -> dind sidecar
```
