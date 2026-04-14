# k3s Deployment Notes

> Note: Public hostnames, registry coordinates, and repo URLs in this document use sanitized placeholders.

## Scope

`k3s/`는 origin-side services를 위한 Kubernetes manifests를 담고 있습니다. 현재 base apply set은 `kubectl apply -k k3s`로 정의됩니다.

## Base Set

파일: `k3s/kustomization.yaml`

base resources:

- `namespace.yaml`
- `limitrange.yaml`
- `resourcequota.yaml`
- `configmap.yaml`
- `postgres.yaml`
- `redis.yaml`
- `chromadb.yaml`
- `surrealdb.yaml`
- `open-notebook.yaml`
- `api.yaml`
- `ingress.yaml`
- `middleware.yaml`
- `piston.yaml`

중요한 점은 `middleware.yaml`도 base set이라는 것입니다. 따라서 HTTPS redirect middleware는 optional이 아니라 기본 배포 범위에 포함됩니다.

## Why The API Deployment Is Single-Replica

파일: `k3s/api.yaml`

`api` Deployment는 다음 제약을 코드로 고정합니다.

- `replicas: 1`
- `strategy.type: Recreate`
- `PersistentVolumeClaim api-sqlite`

의미:

- backend가 local SQLite state를 사용하므로 동시에 여러 replica를 두는 구성이 기본값이 아닙니다.
- `Recreate`는 old/new pod 동시 기동을 피합니다.
- `api-sqlite` PVC가 `/app/.data`에 mount 됩니다.

## Repo Sync Design

같은 `api.yaml`에는 `sync-repo` init container가 있습니다.

- image: `alpine/git:2.47.2`
- source URL: `CONTENT_GIT_REPO_AUTH` 또는 `CONTENT_GIT_REPO`
- ref: `CONTENT_GIT_REF`
- target: `/repo`

그 후 main `api` container는 `emptyDir` volume을 read-only subPath로 mount 합니다.

- `/frontend`
- `/workers`
- `/backend`

이 설계가 필요한 이유:

- backend는 content, migrations, 일부 worker config를 로컬 파일시스템 경로로 읽습니다.
- Kubernetes에서도 repo checkout view를 제공하기 위해 init-container clone 방식을 사용합니다.

Trade-off:

- 장점: container image 안에 repo 전체를 baked-in 하지 않아도 됩니다.
- 단점: pod start 시 git clone 성공 여부에 의존하고, runtime write 작업에는 적합하지 않습니다.

## Runtime Config

파일: `k3s/configmap.yaml`

확인된 주요 값:

- `SITE_BASE_URL`
- `API_BASE_URL`
- `ALLOWED_ORIGINS`
- `AI_DEFAULT_MODEL`
- `CHROMA_URL`
- `SQLITE_PATH`
- `SQLITE_MIGRATIONS_DIR=/workers/migrations`
- `CONTENT_PUBLIC_DIR=/frontend/public`
- `CONTENT_POSTS_DIR=/frontend/public/posts`
- `CONTENT_IMAGES_DIR=/frontend/public/images`
- `OPEN_NOTEBOOK_URL`
- `TERMINAL_SERVER_URL`
- `TERMINAL_GATEWAY_URL`
- `FEATURE_AI_ENABLED`
- `FEATURE_RAG_ENABLED`
- `FEATURE_TERMINAL_ENABLED=false`
- `FEATURE_AI_INLINE`
- `FEATURE_COMMENTS_ENABLED`
- `CONTENT_GIT_REPO`
- `CONTENT_GIT_REF`
- `SANDBOX_IMAGE`

운영상 의미:

- terminal 관련 값은 존재하지만 base set만 적용한 상태에서는 feature flag 기본값이 비활성화입니다.
- migration path와 content path가 repo-sync mount 구조에 직접 결합됩니다.

## Optional Terminal Runtime

파일:

- `k3s/optional/terminal/configmap-patch.yaml`
- `k3s/optional/terminal/terminal-optional.yaml`
- `k3s/optional/terminal/terminal-ingress-optional.yaml`

확인된 구조:

- `terminal-server` Deployment는 `docker:27-dind` sidecar를 포함합니다.
- DinD container는 `securityContext.privileged: true`입니다.
- app container는 `DOCKER_HOST=unix:///var/run/docker.sock`를 사용합니다.
- terminal ingress host는 `terminal.nodove.com`
- published path는 `/terminal`

Trade-off:

- 장점: 기존 terminal-server의 Docker shelling model을 크게 바꾸지 않고 유지할 수 있습니다.
- 단점: privileged DinD sidecar가 필요하므로 base set보다 보안 위험과 운영 복잡도가 큽니다.
- 결과: optional terminal manifests는 `k3s/optional/terminal/` add-on kustomization으로 분리되며, base render에 terminal이 섞이지 않고 optional render에서만 feature flag가 다시 활성화됩니다.
- PR에서는 `.github/workflows/validate-k3s.yml`가 base/optional render와 schema validation을 수행합니다.

## Resource Guardrails

파일:

- `k3s/limitrange.yaml`
- `k3s/resourcequota.yaml`

base set에는 namespace-level 기본 예산도 포함됩니다.

- `LimitRange`는 container 기본 CPU, memory, ephemeral-storage request/limit를 제공합니다.
- `ResourceQuota`는 pod 수, PVC 수, aggregate CPU/memory/storage budget을 제한합니다.
- 목적은 manifest에 누락된 자원 필드가 cluster-wide 무제한으로 퍼지는 것을 막는 것입니다.

## Storage Assumption

현재 PVC들은 여전히 `storageClassName: local-path`를 사용합니다.

- 이것은 single-node 또는 node-local persistence 전제에는 맞습니다.
- 다만 node 장애 시 다른 node로 자동 이전되는 HA storage가 아닙니다.
- 저장소에 다른 storage class 정보가 없으므로, 이 refactor는 local-path를 문서화하고 유지합니다.

## Image Pinning Gap

현재 저장소에는 production digest pinning 입력값이 없습니다.

- `postgres`, `redis`, `busybox`, `alpine/git`처럼 explicit tag가 있는 이미지는 유지했습니다.
- `ghcr.io/choisimo/blog-api:latest`, `chromadb/chroma:latest` 같은 mutable tag는 아직 남아 있습니다.
- `ghcr.io/engineer-man/piston`은 GHCR public package page에서 확인한 digest `sha256:2f66b7456189c4d713aa986d98eccd0b6ee16d26c7ec5f21b30e942756fd127a`로 pin 했습니다.
- production rollout 전에는 GHCR publish 결과나 upstream release digest를 확인해 immutable digest로 교체하는 것이 안전합니다.

## Piston Sandbox Posture

`k3s/piston.yaml`의 Piston container는 현재 `securityContext.privileged: true`를 유지합니다.

- upstream Piston README는 containerized install 예시를 `docker run --privileged ... ghcr.io/engineer-man/piston`로 문서화합니다.
- upstream isolate 문서는 containerized use를 권장하지 않으며, containers 안에서 실행하려면 privileged가 필요할 수 있다고 설명합니다.
- 따라서 이 저장소는 upstream이 문서화한 실행 모델을 유지하고, 별도 검증 없는 non-privileged profile은 experimental로 취급합니다.

운영상 의미:

- Piston은 optional terminal DinD와 달리 base set에 포함되지만, privileged exception이 필요한 별도 sandbox workload입니다.
- Kubernetes Pod Security `Restricted` 정책과는 직접 호환되지 않으므로 namespace/policy 설계 시 예외 처리가 필요합니다.
- 현재 Piston image는 verified digest로 고정했고, privilege model 변경은 별도 검증 후 진행하는 것이 안전합니다.

## Networking

base ingress는 `origin.example.com`용 backend 노출을 담당하고, optional ingress는 terminal origin path를 별도로 노출합니다.

`k3s/MANIFEST_RELATIONSHIPS.md` 기준으로 base ingress는 Traefik middleware `blog-redirect-https@kubernetescrd`를 참조합니다.

## Secrets And Prerequisites

base set을 적용하기 전에 문서와 manifest가 전제하는 항목:

- namespace: `blog`
- app secret: `blog-app-secrets`
- image pull secret: `ghcr-creds`
- TLS secret: `blog-origin-tls`

또한 local-path storage class와 기본 Traefik ingress controller 존재를 가정합니다.

## Rollout Model

현재 문서와 workflow evidence를 종합하면, 이 디렉토리는 compose-era watchtower 대체가 아니라 선언적 rollout 전환을 목표로 합니다.

## Validation

- base render:
  - `kubectl kustomize k3s`
- optional terminal render:
  - `kubectl kustomize k3s/optional/terminal`
- CI:
  - `.github/workflows/validate-k3s.yml`가 두 렌더 결과를 `kubeconform -strict`로 검증합니다.

- backend images는 GitHub Actions에서 GHCR로 build/push 가능
- cluster apply는 GitOps 도구가 담당하도록 정리하는 편이 안전함
- 현재 저장소 evidence만으로는 k3s 자동 apply workflow는 확인되지 않음

## GitOps Bootstrap

`k3s/argocd` 는 Argo CD와 Argo CD Image Updater를 pinning 해서 bootstrap 하는 경로입니다.

권장 설치 순서:

1. `kubectl apply --server-side --force-conflicts -k k3s/argocd/install`
2. `kubectl apply -k k3s/argocd/image-updater`
3. `kubectl apply -k k3s/argocd/bootstrap`

설치 후 기대 동작:

- Argo CD가 `https://github.com/choisimo/blog.git` 의 `k3s` 경로를 감시
- `blog-api`, `blog-terminal` 은 immutable SHA tag를 추적
- `piston`, `open-notebook` 처럼 mutable tag를 써야 하는 third-party 이미지는 digest 전략으로 drift를 감지

## Operations

### Verify rendered base set

```bash
kubectl kustomize k3s
kubectl apply -k k3s
```

### Check the API deployment assumptions

```bash
kubectl -n blog get deploy api
kubectl -n blog get pvc api-sqlite
kubectl -n blog logs deploy/api -c api
kubectl -n blog logs deploy/api -c sync-repo
```

### When enabling terminal runtime

```bash
kubectl apply -k k3s/optional/terminal
```

검토 포인트:

- privileged DinD 허용 여부
- `SANDBOX_IMAGE` 적절성
- `blog-app-secrets`에 `BACKEND_KEY` 존재 여부

## Optional Cloudflare Tunnel

파일:

- `k3s/optional/cloudflared/kustomization.yaml`
- `k3s/optional/cloudflared/cloudflared.yaml`
- `k3s/optional/cloudflared/secret.example.yaml`

이 optional set은 remotely-managed Cloudflare Tunnel 패턴을 위한 `cloudflared` Deployment를 제공합니다.

- `replicas: 2`로 구성해 replica loss 시 단일 connector outage를 줄입니다.
- tunnel route는 Cloudflare dashboard에서 별도로 설정해야 합니다.
- 같은 namespace 안에서는 origin service target을 `http://api:5080`처럼 둘 수 있습니다.
- `secret.example.yaml`은 reference only입니다. placeholder 값을 가진 예시 파일을 그대로 apply하면 안 됩니다.

적용 예시:

```bash
kubectl -n blog create secret generic cloudflared-tunnel-token \
  --from-literal=token='<real-cloudflare-tunnel-token>'
kubectl apply -k k3s/optional/cloudflared
```

이미 Secret이 있다면 `kubectl -n blog delete secret cloudflared-tunnel-token` 후 다시 만들거나, 별도 secret manifest를 로컬에서 작성해 적용하는 편이 안전합니다.

## Residual Risk

- repo clone 실패 시 `api` pod는 content/migration 경로를 갖지 못합니다.
- SQLite single-writer 전제 때문에 horizontal scaling 여지가 제한됩니다.
- optional terminal runtime은 privileged container 의존이 가장 큰 운영 리스크입니다.
- `blog-api`, `chromadb` 등 일부 mutable tag 리스크는 여전히 남아 있습니다.
