# k3s 매니페스트 연관관계 레퍼런스

> 참고: 이 문서의 공개 호스트명, 레지스트리 좌표, 저장소 URL, 이메일 예시는 모두 비식별 placeholder입니다.

## 범위

이 문서는 현재 `k3s/` 아래에 있는 모든 YAML 파일을 기준으로, 각 리소스에서 사용한 필드와 서비스, 워크로드, 시크릿, 설정, 포트, 셀렉터, 스토리지 사이의 런타임 연관관계를 설명합니다.

이 문서에서 "컬럼"이라는 표현은 `spec.selector.app`, `spec.template.metadata.labels.app` 같은 YAML 필드 경로를 뜻합니다.

## 파일 목록

| 파일 | `kustomization.yaml` 포함 여부 | 리소스 타입 | 용도 |
| --- | --- | --- | --- |
| `namespace.yaml` | 포함 | `Namespace` | `blog` 네임스페이스 생성 |
| `limitrange.yaml` | 포함 | `LimitRange` | namespace 기본 container/PVC 자원 가드레일 |
| `resourcequota.yaml` | 포함 | `ResourceQuota` | namespace 총량 예산 제한 |
| `configmap.yaml` | 포함 | `ConfigMap` | 워크로드 간 공유되는 비시크릿 런타임 설정 |
| `postgres.yaml` | 포함 | `Service`, `StatefulSet` | PostgreSQL DB와 headless service |
| `redis.yaml` | 포함 | `Service`, `StatefulSet` | Redis 캐시와 headless service |
| `chromadb.yaml` | 포함 | `Service`, `StatefulSet` | Chroma 벡터 DB와 headless service |
| `surrealdb.yaml` | 포함 | `Service`, `StatefulSet` | Open Notebook용 SurrealDB |
| `open-notebook.yaml` | 포함 | `Service`, `Deployment` | Open Notebook 애플리케이션 |
| `api.yaml` | 포함 | `PersistentVolumeClaim`, `Service`, `Deployment` | 메인 backend API |
| `ingress.yaml` | 포함 | `Ingress` | `origin.example.com` 공개 라우팅 |
| `middleware.yaml` | 포함 | `Middleware` | Traefik HTTPS 리다이렉트 미들웨어 |
| `piston.yaml` | 포함 | `PersistentVolumeClaim`, `Service`, `Deployment` | backend execute API용 code execution engine |
| `optional/terminal/terminal-optional.yaml` | 미포함 | `Service`, `Deployment` | DinD 기반 optional terminal runtime |
| `optional/terminal/terminal-ingress-optional.yaml` | 미포함 | `Ingress` | optional terminal 공개 라우팅 |
| `optional/terminal/kustomization.yaml` | 미포함 | `Kustomization` | terminal optional apply 진입점 |
| `optional/cloudflared/cloudflared.yaml` | 미포함 | `Deployment` | optional Cloudflare Tunnel connector |
| `optional/cloudflared/secret.example.yaml` | 미포함 | `Secret` | Cloudflare Tunnel token 예시 |
| `optional/cloudflared/kustomization.yaml` | 미포함 | `Kustomization` | cloudflared optional apply 진입점 |
| `secret-example.yaml` | 미포함 | `Secret` | 애플리케이션 시크릿 예시 |
| `registry-secret.example.yaml` | 미포함 | `Secret` | GHCR pull secret 예시 |
| `kustomization.yaml` | 진입점 | `Kustomization` | 기본 apply 세트 정의 |

## 기본 세트와 선택 세트

### 기본 세트

`kubectl apply -k k3s`에 포함되는 리소스는 다음입니다.

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

### 선택 세트

다음 파일은 base 세트에 포함되지 않으며 필요 시 별도로 적용해야 합니다.

- `optional/terminal/terminal-optional.yaml`
- `optional/terminal/terminal-ingress-optional.yaml`
- `optional/terminal/kustomization.yaml`
- `optional/cloudflared/cloudflared.yaml`
- `optional/cloudflared/secret.example.yaml`
- `optional/cloudflared/kustomization.yaml`
- `secret-example.yaml`
- `registry-secret.example.yaml`

## 상위 런타임 구조

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

선택:
Ingress terminal-origin
  -> Service terminal-server
    -> Deployment terminal-server
      -> dind sidecar
      -> Secret blog-app-secrets
      -> ConfigMap blog-app-config
```

## 자주 나오는 Kubernetes 필드

현재 매니페스트 전반에서 반복적으로 등장하는 필드는 다음과 같습니다.

| 필드 경로 | 의미 |
| --- | --- |
| `apiVersion` | 리소스 kind가 속한 API 그룹과 버전 |
| `kind` | Kubernetes 리소스 타입 |
| `metadata.name` | 네임스페이스 내부 리소스 이름 |
| `metadata.namespace` | 대상 네임스페이스 |
| `spec.selector` | 라벨 기반 선택 조건 |
| `spec.selector.matchLabels` | 워크로드용 동등 비교 셀렉터 |
| `spec.template.metadata.labels` | 워크로드가 생성하는 Pod에 붙는 라벨 |
| `spec.ports[].port` | Service가 노출하는 포트 |
| `spec.ports[].targetPort` | Service가 전달할 컨테이너 포트 또는 named port |
| `spec.serviceName` | StatefulSet의 governing service |
| `spec.clusterIP: None` | Headless Service |
| `env` | 명시적인 환경변수 |
| `envFrom` | `ConfigMap` 또는 `Secret`의 모든 키를 환경변수로 주입 |
| `configMapKeyRef` | ConfigMap의 특정 키 하나를 참조 |
| `secretKeyRef` | Secret의 특정 키 하나를 참조 |
| `volumeMounts` | 컨테이너 내부 파일시스템에 named volume 마운트 |
| `volumes` | Pod 단위 volume 정의 |
| `volumeClaimTemplates` | StatefulSet Pod별 PVC 템플릿 |
| `persistentVolumeClaim.claimName` | 기존 PVC 이름 참조 |
| `imagePullSecrets` | private image pull 용 secret |
| `initContainers` | 앱 컨테이너 시작 전 먼저 완료되어야 하는 컨테이너 |
| `readinessProbe` | 트래픽 수신 가능 상태 판단 |
| `livenessProbe` | 컨테이너 고장 여부 판단 |
| `ingressClassName` | 어떤 ingress controller가 이 Ingress를 처리할지 지정 |
| `spec.rules` | Ingress host/path 라우팅 규칙 |
| `spec.tls` | TLS 대상 host와 secret |
| `metadata.annotations` | 컨트롤러별 확장 메타데이터, 여기서는 주로 Traefik 설정 |

## 라벨과 셀렉터 모델

현재 매니페스트는 단순한 단일 라벨 규칙을 사용합니다.

- `app: api`
- `app: postgres`
- `app: redis`
- `app: chromadb`
- `app: surrealdb`
- `app: open-notebook`
- `app: terminal-server`

이건 데이터베이스의 기본키라기보다 `WHERE app = '...'` 형태의 조건에 가깝습니다.

### 현재 파일들에서의 동작 방식

| 리소스 타입 | selector 위치 | label 위치 | 결과 |
| --- | --- | --- | --- |
| `Service` | `spec.selector.app` | Pod labels | 일치하는 Pod로 트래픽 전달 |
| `Deployment` | `spec.selector.matchLabels.app` | `spec.template.metadata.labels.app` | Deployment가 관리할 Pod를 식별하고, 새 Pod에도 동일 라벨 부여 |
| `StatefulSet` | `spec.selector.matchLabels.app` | `spec.template.metadata.labels.app` | StatefulSet이 관리할 Pod를 식별하고, 새 Pod에도 동일 라벨 부여 |

### 현재 구체적인 매핑

| Service/워크로드 | Selector | Pod 라벨 공급원 | 효과 |
| --- | --- | --- | --- |
| `api` Service | `app=api` | `api` Deployment template | backend API Pod로 요청 전달 |
| `postgres` Service | `app=postgres` | `postgres` StatefulSet template | PostgreSQL Pod로 DNS 연결 |
| `redis` Service | `app=redis` | `redis` StatefulSet template | Redis Pod로 DNS 연결 |
| `chromadb` Service | `app=chromadb` | `chromadb` StatefulSet template | Chroma Pod로 DNS 연결 |
| `surrealdb` Service | `app=surrealdb` | `surrealdb` StatefulSet template | SurrealDB Pod로 DNS 연결 |
| `open-notebook` Service | `app=open-notebook` | `open-notebook` Deployment template | notebook 내부 서비스 디스커버리 |
| `terminal-server` Service | `app=terminal-server` | `terminal-server` Deployment template | optional terminal 라우팅 |

## Kustomization 리소스

파일: `kustomization.yaml`

### 필드 설명

| 경로 | 값 | 의미 |
| --- | --- | --- |
| `apiVersion` | `kustomize.config.k8s.io/v1beta1` | Kustomize API 버전 |
| `kind` | `Kustomization` | 이 파일이 apply 진입점임을 선언 |
| `resources[]` | 파일 목록 | 같이 렌더링하고 적용할 base 리소스 목록 |

### 연관관계

- 이 파일이 base 배포의 범위를 결정합니다.
- 현재 `middleware.yaml`과 `ingress.yaml`을 함께 포함하므로 HTTPS 리다이렉트 미들웨어도 base 세트입니다.
- terminal 관련 optional 파일과 example secret은 포함하지 않습니다.

## Namespace 리소스

파일: `namespace.yaml`

### 필드 설명

| 경로 | 값 | 의미 |
| --- | --- | --- |
| `kind` | `Namespace` | 네임스페이스 리소스 |
| `metadata.name` | `blog` | 모든 리소스가 사용하는 네임스페이스 |

### 연관관계

- base 세트의 모든 매니페스트는 `namespace: blog`를 사용합니다.
- 이 네임스페이스가 없으면 다른 리소스를 해당 네임스페이스에 생성할 수 없습니다.

## Middleware 리소스

파일: `middleware.yaml`

### 필드 설명

| 경로 | 값 | 의미 |
| --- | --- | --- |
| `apiVersion` | `traefik.io/v1alpha1` | Traefik CRD API 그룹 |
| `kind` | `Middleware` | Traefik 미들웨어 리소스 |
| `metadata.name` | `redirect-https` | 미들웨어 이름 |
| `spec.redirectScheme.scheme` | `https` | 리다이렉트 대상 스킴 |
| `spec.redirectScheme.permanent` | `true` | 영구 리다이렉트 |

### 연관관계

- `ingress.yaml`은 `traefik.ingress.kubernetes.io/router.middlewares: blog-redirect-https@kubernetescrd`로 이 미들웨어를 참조합니다.
- 실제 참조 형식은 `<namespace>-<middlewareName>@kubernetescrd`이므로 `blog-redirect-https@kubernetescrd`는 `blog` 네임스페이스의 `redirect-https`를 가리킵니다.

## ConfigMap

파일: `configmap.yaml`

리소스 이름: `blog-app-config`

### 키 목록

| 키 | 값 | 주요 소비자 | 용도 |
| --- | --- | --- | --- |
| `APP_ENV` | `production` | `api` | 애플리케이션 환경 |
| `HOST` | `0.0.0.0` | `api` | 바인드 호스트 |
| `PORT` | `5080` | `api` | API listen 포트 |
| `TRUST_PROXY` | `1` | `api` | 프록시 신뢰 단계 |
| `LOG_LEVEL` | `info` | `api` | 로그 레벨 |
| `SITE_BASE_URL` | `https://blog.example.com` | `api` | 공개 사이트 URL |
| `API_BASE_URL` | `https://api.example.com` | `api` | 공개 API base URL |
| `ALLOWED_ORIGINS` | `https://blog.example.com,http://localhost:5173` | `api` | CORS 허용 origin |
| `RATE_LIMIT_MAX` | `60` | `api` | 요청 제한 수 |
| `RATE_LIMIT_WINDOW_MS` | `60000` | `api` | rate limit window |
| `AI_DEFAULT_MODEL` | `gpt-4.1` | `api`, `open-notebook` | 기본 LLM 모델 |
| `AI_ASYNC_MODE` | `false` | `api` | async AI 토글 |
| `AI_EMBED_MODEL` | `text-embedding-3-small` | `api`, `open-notebook` | 임베딩 모델 |
| `CHROMA_URL` | `http://chromadb:8000` | `api` | 내부 Chroma endpoint |
| `CHROMA_COLLECTION` | `blog-posts__all-MiniLM-L6-v2` | `api` | Chroma collection 이름 |
| `SQLITE_PATH` | `/app/.data/blog.db` | `api` | SQLite 파일 경로 |
| `SQLITE_MIGRATIONS_DIR` | `/workers/migrations` | `api` | migration 디렉터리 |
| `CONTENT_PUBLIC_DIR` | `/frontend/public` | `api` | 콘텐츠 루트 |
| `CONTENT_POSTS_DIR` | `/frontend/public/posts` | `api` | 게시글 디렉터리 |
| `CONTENT_IMAGES_DIR` | `/frontend/public/images` | `api` | 이미지 디렉터리 |
| `POSTS_SOURCE` | `filesystem` | `api` | 게시글 소스 타입 |
| `OPEN_NOTEBOOK_URL` | `http://open-notebook:8501` | `api` | 내부 notebook endpoint |
| `OPEN_NOTEBOOK_ENABLED` | `true` | `api` | notebook 기능 플래그 |
| `TERMINAL_SERVER_URL` | `http://terminal-server:8080` | `api` | 내부 terminal endpoint |
| `TERMINAL_GATEWAY_URL` | `https://terminal.example.com` | `api` | 공개 terminal gateway URL |
| `FEATURE_AI_ENABLED` | `true` | `api` | AI 기능 플래그 |
| `FEATURE_RAG_ENABLED` | `true` | `api` | RAG 기능 플래그 |
| `FEATURE_TERMINAL_ENABLED` | `false` | `api` | terminal 기능 플래그 |
| `FEATURE_AI_INLINE` | `true` | `api` | inline AI 기능 플래그 |
| `FEATURE_COMMENTS_ENABLED` | `true` | `api` | comments 기능 플래그 |
| `USE_CONSUL` | `false` | `api` | Consul runtime overlay 비활성화 |
| `POSTGRES_DB` | `bloganalytics` | `postgres` | PostgreSQL DB 이름 |
| `POSTGRES_USER` | `bloguser` | `postgres` | PostgreSQL 사용자 |
| `CONTENT_GIT_REPO` | `https://github.com/example-org/blog.git` | `api.initContainer` | repo sync 용 Git URL |
| `CONTENT_GIT_REF` | `main` | `api.initContainer` | clone할 branch/ref |
| `SANDBOX_IMAGE` | `alpine:3.20` | `terminal-server` optional | terminal sandbox 기본 이미지 |

### 연관관계

- `api`는 `envFrom`으로 ConfigMap 전체를 가져갑니다.
- `open-notebook`은 `configMapKeyRef`로 일부 키만 참조합니다.
- `postgres`는 `POSTGRES_DB`, `POSTGRES_USER`를 참조합니다.
- optional `terminal-server`는 `SANDBOX_IMAGE`를 참조합니다.

## App Secret 예시

파일: `secret-example.yaml`

리소스 이름: `blog-app-secrets`

이 파일은 예시이며 자동 적용되지 않습니다.

### 키 목록

| 키 | 주요 소비자 | 용도 |
| --- | --- | --- |
| `BACKEND_KEY` | `api`, optional `terminal-server` | 내부 shared auth key |
| `AI_SERVER_URL` | `api`, `open-notebook` | OpenAI-compatible base URL |
| `AI_API_KEY` | `api`, `open-notebook` | 기본 AI key |
| `AI_EMBEDDING_URL` | `api`, `open-notebook` | embedding endpoint |
| `AI_EMBEDDING_API_KEY` | `api`, `open-notebook` | embedding key |
| `DATABASE_URL` | `api` | PostgreSQL connection string |
| `POSTGRES_PASSWORD` | `postgres`, 간접적으로 `api` | DB 비밀번호 |
| `REDIS_URL` | `api` | Redis connection string |
| `REDIS_PASSWORD` | `redis` | optional Redis 인증 |
| `JWT_SECRET` | `api` | JWT 서명 키 |
| `ADMIN_BEARER_TOKEN` | `api` | admin bearer token |
| `TOTP_SECRET` | `api` | OTP/TOTP secret |
| `ADMIN_ALLOWED_EMAILS` | `api` | admin 허용 이메일 목록 |
| `GITHUB_TOKEN` | `api` | GitHub 자동화 토큰 |
| `GITHUB_REPO_OWNER` | `api` | 저장소 owner |
| `GITHUB_REPO_NAME` | `api` | 저장소 이름 |
| `GIT_USER_NAME` | `api` | Git commit 표시 이름 |
| `GIT_USER_EMAIL` | `api` | Git commit 이메일 |
| `GITHUB_CLIENT_ID` | `api` | GitHub OAuth client id |
| `GITHUB_CLIENT_SECRET` | `api` | GitHub OAuth client secret |
| `GOOGLE_CLIENT_ID` | `api` | Google OAuth client id |
| `GOOGLE_CLIENT_SECRET` | `api` | Google OAuth client secret |
| `OAUTH_REDIRECT_BASE_URL` | `api` | OAuth callback base URL |
| `VERCEL_DEPLOY_HOOK_URL` | `api` | Vercel deploy hook |
| `PERPLEXITY_API_KEY` | `api` | search provider key |
| `TAVILY_API_KEY` | `api` | search provider key |
| `BRAVE_SEARCH_API_KEY` | `api` | search provider key |
| `SERPER_API_KEY` | `api` | search provider key |
| `SURREALDB_ROOT_PASSWORD` | `surrealdb`, `open-notebook` | SurrealDB root 비밀번호 |
| `CONTENT_GIT_REPO_AUTH` | `api.initContainer` | 인증 포함 Git URL override |

### 연관관계

- `api`는 `envFrom`으로 Secret 전체를 가져갑니다.
- `open-notebook`, `postgres`, `redis`, `surrealdb`, optional `terminal-server`는 이 Secret의 일부 키만 참조합니다.
- 이 파일은 예시이므로, 실제 배포 전에 같은 이름의 real secret을 따로 생성해야 합니다.

## Registry Secret 예시

파일: `registry-secret.example.yaml`

### 필드 설명

| 경로 | 의미 |
| --- | --- |
| `kind: Secret` | Secret 리소스 |
| `type: kubernetes.io/dockerconfigjson` | image pull auth용 secret 형식 |
| `metadata.name: ghcr-creds` | `imagePullSecrets`가 기대하는 secret 이름 |
| `stringData[".dockerconfigjson"]` | Docker auth JSON payload |

### 연관관계

- `api`와 optional `terminal-server`는 `imagePullSecrets: ghcr-creds`를 사용합니다.
- GHCR 이미지가 private이면 동일 이름의 real secret이 존재해야 합니다.

## API 매니페스트

파일: `api.yaml`

이 파일은 3개의 리소스를 정의합니다.

### 리소스 1: `PersistentVolumeClaim api-sqlite`

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `metadata.name` | `api-sqlite` | PVC 이름 | `Deployment api`가 참조 |
| `spec.accessModes[0]` | `ReadWriteOnce` | 단일 노드 write 모드 | local-path 사용에 적합 |
| `spec.storageClassName` | `local-path` | k3s 기본 로컬 스토리지 클래스 | SQLite 데이터 저장 |
| `spec.resources.requests.storage` | `5Gi` | 요청 스토리지 크기 | SQLite 용량 |

### 리소스 2: `Service api`

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `spec.selector.app` | `api` | `app=api` Pod 선택 | Deployment Pod 라벨과 일치해야 함 |
| `spec.ports[0].port` | `5080` | Service 포트 | Ingress가 여기로 전달 |
| `spec.ports[0].targetPort` | `http` | named container port | Deployment의 `http` port로 연결 |

### 리소스 3: `Deployment api`

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `spec.replicas` | `1` | 단일 replica | SQLite 때문에 현재 1개 유지 |
| `spec.strategy.type` | `Recreate` | 구버전/신버전 Pod 동시 실행 방지 | multi-writer PVC 문제 회피 |
| `spec.selector.matchLabels.app` | `api` | Deployment가 관리할 Pod selector | template label과 같아야 함 |
| `spec.template.metadata.labels.app` | `api` | 생성되는 Pod 라벨 | Service selector와 Deployment selector와 같아야 함 |
| `spec.imagePullSecrets[0].name` | `ghcr-creds` | GHCR pull auth | private image면 필요 |
| `initContainers[0].name` | `sync-repo` | 사전 repo sync 컨테이너 | `emptyDir`에 repo를 채움 |
| `initContainers[0].image` | `alpine/git:2.47.2` | Git client 이미지 | 앱 시작 전용 |
| `initContainers[0].command` | shell clone script | repo clone 수행 | `CONTENT_GIT_REPO(_AUTH)`, `CONTENT_GIT_REF` 사용 |
| `initContainers[0].envFrom` | ConfigMap + Secret | repo sync 관련 환경변수 주입 | app config/secret 사용 |
| `initContainers[0].volumeMounts[0]` | `/repo` | clone 대상 경로 | `repo-data` volume 사용 |
| `containers[0].image` | `ghcr.io/example-org/blog-api:latest` | backend 이미지 | 메인 앱 컨테이너 |
| `containers[0].ports[0].name` | `http` | named container port | Service targetPort가 참조 |
| `containers[0].ports[0].containerPort` | `5080` | backend listen 포트 | Service가 이 포트로 전달 |
| `containers[0].envFrom` | ConfigMap + Secret | 런타임 env 전체 주입 | API의 주요 설정 소스 |
| `volumeMounts[name=sqlite-data]` | `/app/.data` | SQLite 데이터 경로 | PVC `api-sqlite` 사용 |
| `volumeMounts[name=repo-data][subPath=frontend]` | `/frontend` | frontend content mount | API가 파일시스템 콘텐츠에 접근 |
| `volumeMounts[name=repo-data][subPath=workers]` | `/workers` | workers config/migrations mount | worker 관련 파일 접근 |
| `volumeMounts[name=repo-data][subPath=backend]` | `/backend` | backend repo view | repo-relative path 유지 |
| `readinessProbe.httpGet.path` | `/api/v1/healthz` | readiness endpoint | 성공 전까지 Service 트래픽 차단 |
| `livenessProbe.httpGet.path` | `/api/v1/healthz` | liveness endpoint | 비정상 시 재시작 |
| `resources.requests/limits` | CPU/memory 값 | 스케줄링과 리소스 상한 | 컨테이너 자원 정책 |
| `volumes[name=sqlite-data].persistentVolumeClaim.claimName` | `api-sqlite` | PVC를 Pod에 연결 | 스토리지 연결 |
| `volumes[name=repo-data].emptyDir` | `{}` | Pod 생명주기 동안 유지되는 임시 volume | initContainer와 app container 공유 |

### API 연관관계

- `Ingress blog-backend`는 `/api` 트래픽을 `Service api`로 전달합니다.
- `Service api`는 `app=api` 라벨이 붙은 Pod를 선택합니다.
- `Deployment api`는 `app=api` 라벨이 붙은 Pod를 생성합니다.
- `Deployment api`는 `blog-app-config`, `blog-app-secrets`를 모두 소비합니다.
- `Deployment api`는 `api-sqlite` PVC를 마운트하고 repo sync를 통해 `/frontend`, `/workers`, `/backend`를 노출합니다.

## PostgreSQL 매니페스트

파일: `postgres.yaml`

### 리소스 1: `Service postgres`

| 경로 | 값 | 의미 |
| --- | --- | --- |
| `spec.clusterIP` | `None` | Headless Service |
| `spec.selector.app` | `postgres` | PostgreSQL Pod 선택 |
| `spec.ports[0].port` | `5432` | Service 포트 |
| `spec.ports[0].targetPort` | `postgres` | named container port |

### 리소스 2: `StatefulSet postgres`

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `spec.serviceName` | `postgres` | governing service 이름 | headless Service와 맞아야 함 |
| `spec.replicas` | `1` | 단일 DB replica | 현재 topology |
| `spec.selector.matchLabels.app` | `postgres` | Pod ownership selector | template label과 같아야 함 |
| `spec.template.metadata.labels.app` | `postgres` | Pod 라벨 | Service selector와 같아야 함 |
| `containers[0].image` | `postgres:16-alpine` | DB 이미지 | 메인 DB 런타임 |
| `env[POSTGRES_DB]` | ConfigMap 값 | DB 이름 | `blog-app-config` 사용 |
| `env[POSTGRES_USER]` | ConfigMap 값 | DB 사용자 | `blog-app-config` 사용 |
| `env[POSTGRES_PASSWORD]` | Secret 값 | DB 비밀번호 | `blog-app-secrets` 사용 |
| `volumeMounts[0].mountPath` | `/var/lib/postgresql/data` | 데이터 디렉터리 | StatefulSet PVC 사용 |
| `readinessProbe.exec` | `pg_isready ...` | readiness probe | 연결 가능 여부 확인 |
| `livenessProbe.exec` | `pg_isready ...` | liveness probe | 비정상 컨테이너 재시작 |
| `volumeClaimTemplates[0].metadata.name` | `data` | PVC 템플릿 이름 | `data`로 마운트 |
| `volumeClaimTemplates[0].spec.resources.requests.storage` | `20Gi` | 요청 스토리지 크기 | DB 용량 |

### PostgreSQL 연관관계

- `api`는 Secret의 `DATABASE_URL`을 사용해 여기에 연결합니다.
- Service DNS 이름은 `postgres`입니다.
- Service가 headless이고 StatefulSet 이름도 `postgres`이므로 안정적인 네트워크 identity를 가질 수 있습니다.

## Redis 매니페스트

파일: `redis.yaml`

### 리소스 1: `Service redis`

| 경로 | 값 | 의미 |
| --- | --- | --- |
| `spec.clusterIP` | `None` | Headless Service |
| `spec.selector.app` | `redis` | Redis Pod 선택 |
| `spec.ports[0].port` | `6379` | Service 포트 |
| `spec.ports[0].targetPort` | `redis` | named container port |

### 리소스 2: `StatefulSet redis`

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `spec.serviceName` | `redis` | governing service 이름 | headless Service와 맞아야 함 |
| `spec.selector.matchLabels.app` | `redis` | Pod ownership selector | template label과 같아야 함 |
| `spec.template.metadata.labels.app` | `redis` | Pod 라벨 | Service selector와 같아야 함 |
| `containers[0].image` | `redis:7-alpine` | Redis 이미지 | 메인 캐시 런타임 |
| `containers[0].command` | shell script | 비밀번호 유무에 따라 Redis 시작 | `REDIS_PASSWORD` 사용 |
| `env[REDIS_PASSWORD]` | optional Secret 값 | optional 인증 | `blog-app-secrets` 사용 |
| `volumeMounts[0].mountPath` | `/data` | Redis persistence 경로 | PVC 사용 |
| `readinessProbe.tcpSocket.port` | `redis` | readiness probe | TCP readiness |
| `livenessProbe.tcpSocket.port` | `redis` | liveness probe | TCP health |
| `volumeClaimTemplates[0].metadata.name` | `data` | PVC 템플릿 이름 | `data`로 마운트 |
| `volumeClaimTemplates[0].spec.resources.requests.storage` | `4Gi` | 요청 스토리지 크기 | 캐시 persistence 용량 |

### Redis 연관관계

- `api`는 Secret의 `REDIS_URL`을 읽고 service DNS `redis`를 사용합니다.
- 비밀번호는 optional이며, Redis 시작 커맨드는 `REDIS_PASSWORD` 존재 여부에 따라 분기합니다.

## ChromaDB 매니페스트

파일: `chromadb.yaml`

### 리소스 1: `Service chromadb`

| 경로 | 값 | 의미 |
| --- | --- | --- |
| `spec.clusterIP` | `None` | Headless Service |
| `spec.selector.app` | `chromadb` | Chroma Pod 선택 |
| `spec.ports[0].port` | `8000` | Service 포트 |
| `spec.ports[0].targetPort` | `http` | named container port |

### 리소스 2: `StatefulSet chromadb`

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `spec.serviceName` | `chromadb` | governing service 이름 | headless Service와 맞아야 함 |
| `spec.selector.matchLabels.app` | `chromadb` | Pod ownership selector | template label과 같아야 함 |
| `spec.template.metadata.labels.app` | `chromadb` | Pod 라벨 | Service selector와 같아야 함 |
| `containers[0].image` | `chromadb/chroma:latest` | Chroma 이미지 | 메인 벡터 DB 런타임 |
| `env[ANONYMIZED_TELEMETRY]` | `false` | telemetry 비활성화 | Chroma 설정 |
| `env[ALLOW_RESET]` | `false` | destructive reset 비활성화 | Chroma 안전 설정 |
| `volumeMounts[0].mountPath` | `/chroma/chroma` | 데이터 디렉터리 | PVC 사용 |
| `readinessProbe.httpGet.path` | `/api/v2/heartbeat` | readiness endpoint | HTTP readiness |
| `livenessProbe.httpGet.path` | `/api/v2/heartbeat` | liveness endpoint | HTTP health |
| `volumeClaimTemplates[0].metadata.name` | `data` | PVC 템플릿 이름 | `data`로 마운트 |
| `volumeClaimTemplates[0].spec.resources.requests.storage` | `20Gi` | 요청 스토리지 크기 | 벡터 저장소 용량 |

### Chroma 연관관계

- `api`는 `CHROMA_URL=http://chromadb:8000`을 사용합니다.
- Chroma service 이름은 ConfigMap에 하드코딩되어 있으며 API가 `envFrom`으로 이를 소비합니다.

## SurrealDB 매니페스트

파일: `surrealdb.yaml`

### 리소스 1: `Service surrealdb`

| 경로 | 값 | 의미 |
| --- | --- | --- |
| `spec.clusterIP` | `None` | Headless Service |
| `spec.selector.app` | `surrealdb` | SurrealDB Pod 선택 |
| `spec.ports[0].port` | `8000` | Service 포트 |
| `spec.ports[0].targetPort` | `http` | named container port |

### 리소스 2: `StatefulSet surrealdb`

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `spec.serviceName` | `surrealdb` | governing service 이름 | headless Service와 맞아야 함 |
| `spec.selector.matchLabels.app` | `surrealdb` | Pod ownership selector | template label과 같아야 함 |
| `spec.template.metadata.labels.app` | `surrealdb` | Pod 라벨 | Service selector와 같아야 함 |
| `containers[0].image` | `surrealdb/surrealdb:v2` | SurrealDB 이미지 | 메인 DB 런타임 |
| `containers[0].command` | `/surreal start ... rocksdb:///data/database.db` | 시작 명령 | 로컬 RocksDB 사용 |
| `env[SURREAL_PASS]` | Secret 값 | root 비밀번호 | `blog-app-secrets` 사용 |
| `env[SURREAL_USER]` | `root` | root 사용자 | 정적 값 |
| `volumeMounts[0].mountPath` | `/data` | 데이터 디렉터리 | PVC 사용 |
| `readinessProbe.tcpSocket.port` | `http` | readiness probe | TCP readiness |
| `livenessProbe.tcpSocket.port` | `http` | liveness probe | TCP health |
| `volumeClaimTemplates[0].metadata.name` | `data` | PVC 템플릿 이름 | `data`로 마운트 |
| `volumeClaimTemplates[0].spec.resources.requests.storage` | `10Gi` | 요청 스토리지 크기 | Surreal 용량 |

### Surreal 연관관계

- `open-notebook`은 `ws://surrealdb:8000/rpc`로 여기에 연결합니다.
- `open-notebook`은 initContainer에서 이 service가 준비될 때까지 기다립니다.

## Open Notebook 매니페스트

파일: `open-notebook.yaml`

이 파일은 2개의 리소스를 정의합니다.

### 리소스 1: `Service open-notebook`

| 경로 | 값 | 의미 |
| --- | --- | --- |
| `spec.selector.app` | `open-notebook` | notebook Pod 선택 |
| `spec.ports[0].port` | `8501` | Service 포트 |
| `spec.ports[0].targetPort` | `web` | named container port |

### 리소스 2: `Deployment open-notebook`

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `spec.replicas` | `1` | 단일 notebook 인스턴스 | 현재 topology |
| `spec.selector.matchLabels.app` | `open-notebook` | Pod ownership selector | template label과 같아야 함 |
| `spec.template.metadata.labels.app` | `open-notebook` | Pod 라벨 | Service selector와 같아야 함 |
| `initContainers[0].name` | `wait-for-surrealdb` | 사전 대기 컨테이너 | SurrealDB가 reachable해질 때까지 블록 |
| `initContainers[0].command` | `until nc -zw2 surrealdb 8000 ...` | wait loop | service DNS `surrealdb` 사용 |
| `containers[0].image` | `lfnovo/open_notebook:v1-latest` | notebook 이미지 | 메인 notebook 런타임 |
| `ports[name=web]` | `8501` | 앱 포트 | Service가 노출 |
| `ports[name=health]` | `5055` | health 포트 | probe가 사용 |
| `env[SURREAL_URL]` | `ws://surrealdb:8000/rpc` | DB endpoint | SurrealDB Service로 연결 |
| `env[SURREAL_USER]` | `root` | DB 사용자 | 정적 값 |
| `env[SURREAL_PASSWORD]` | Secret 값 | DB 비밀번호 | `blog-app-secrets` 사용 |
| `env[SURREAL_NAMESPACE]` | `open_notebook` | Surreal namespace | notebook 설정 |
| `env[SURREAL_DATABASE]` | `open_notebook` | Surreal database | notebook 설정 |
| `env[DEFAULT_CHAT_MODEL]` | ConfigMap 값 | chat 모델 | `AI_DEFAULT_MODEL` 사용 |
| `env[DEFAULT_TRANSFORMATION_MODEL]` | ConfigMap 값 | transform 모델 | `AI_DEFAULT_MODEL` 사용 |
| `env[OPENAI_API_KEY]` | Secret 값 | AI key | `AI_API_KEY` 사용 |
| `env[OPENAI_COMPATIBLE_BASE_URL]` | Secret 값 | OpenAI-compatible base URL | `AI_SERVER_URL` 사용 |
| `env[OPENAI_COMPATIBLE_API_KEY]` | Secret 값 | compatible API key | `AI_API_KEY` 사용 |
| `env[OPENAI_COMPATIBLE_BASE_URL_LLM]` | Secret 값 | LLM endpoint | `AI_SERVER_URL` 사용 |
| `env[OPENAI_COMPATIBLE_API_KEY_LLM]` | Secret 값 | LLM key | `AI_API_KEY` 사용 |
| `env[OPENAI_COMPATIBLE_BASE_URL_EMBEDDING]` | Secret 값 | embedding endpoint | `AI_EMBEDDING_URL` 사용 |
| `env[OPENAI_COMPATIBLE_API_KEY_EMBEDDING]` | Secret 값 | embedding key | `AI_EMBEDDING_API_KEY` 사용 |
| `env[OPENAI_API_BASE]` | Secret 값 | base API URL | `AI_SERVER_URL` 사용 |
| `env[DEFAULT_EMBEDDING_MODEL]` | ConfigMap 값 | embedding 모델 | `AI_EMBED_MODEL` 사용 |
| `env[EMBEDDING_API_KEY]` | Secret 값 | embedding API key | `AI_EMBEDDING_API_KEY` 사용 |
| `env[EMBEDDING_API_BASE]` | Secret 값 | embedding API base | `AI_EMBEDDING_URL` 사용 |
| `readinessProbe.httpGet.path` | `/health` | readiness endpoint | `health` named port 사용 |
| `livenessProbe.httpGet.path` | `/health` | liveness endpoint | `health` named port 사용 |

### Open Notebook 연관관계

- `api`는 `OPEN_NOTEBOOK_URL=http://open-notebook:8501`로 여기에 접근할 수 있습니다.
- 이 워크로드는 `surrealdb` service 가용성에 의존합니다.
- ConfigMap과 Secret 모두 소비하지만 `envFrom`이 아니라 명시적 key ref 방식으로 가져옵니다.

## Ingress 매니페스트

파일: `ingress.yaml`

### 필드 설명

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `metadata.name` | `blog-backend` | Ingress 이름 | 공개 HTTP 진입점 |
| `metadata.annotations["traefik.ingress.kubernetes.io/router.entrypoints"]` | `web,websecure` | Traefik이 HTTP/HTTPS 둘 다 수신 | controller 동작 |
| `metadata.annotations["traefik.ingress.kubernetes.io/router.tls"]` | `true` | TLS 라우팅 활성화 | `spec.tls`와 함께 동작 |
| `metadata.annotations["traefik.ingress.kubernetes.io/router.middlewares"]` | `blog-redirect-https@kubernetescrd` | redirect middleware 연결 | `middleware.yaml` 참조 |
| `spec.ingressClassName` | `traefik` | 사용할 ingress controller | cluster에 존재해야 함 |
| `spec.tls[0].secretName` | `blog-origin-tls` | TLS secret | 별도로 생성 필요 |
| `spec.tls[0].hosts[0]` | `origin.example.com` | TLS host | secret에 포함되어야 함 |
| `spec.rules[0].host` | `origin.example.com` | host 라우팅 | 공개 hostname |
| `spec.rules[0].http.paths[0].path` | `/api` | prefix route | API 경로만 공개 |
| `spec.rules[0].http.paths[0].backend.service.name` | `api` | 대상 Service | `Service api`로 전달 |
| `spec.rules[0].http.paths[0].backend.service.port.name` | `http` | 대상 Service 포트 | `api` service port로 해석 |

### Ingress 연관관계

- host `origin.example.com` + path `/api`는 `Service api`로 전달됩니다.
- redirect middleware가 annotation으로 연결되어 있습니다.
- TLS를 쓰려면 실제 `blog-origin-tls` secret이 필요합니다.

## 선택 Terminal 런타임

파일: `optional/terminal/terminal-optional.yaml`

이 파일은 optional 리소스 2개를 정의하며 base kustomization에는 포함되지 않습니다.

### 리소스 1: `Service terminal-server`

| 경로 | 값 | 의미 |
| --- | --- | --- |
| `spec.selector.app` | `terminal-server` | terminal Pod 선택 |
| `spec.ports[0].port` | `8080` | Service 포트 |
| `spec.ports[0].targetPort` | `http` | named container port |

### 리소스 2: `Deployment terminal-server`

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `spec.replicas` | `1` | 단일 terminal runtime | 현재 topology |
| `spec.selector.matchLabels.app` | `terminal-server` | Pod ownership selector | template label과 같아야 함 |
| `spec.template.metadata.labels.app` | `terminal-server` | Pod 라벨 | Service selector와 같아야 함 |
| `spec.imagePullSecrets[0].name` | `ghcr-creds` | GHCR pull auth | private image면 필요 |
| `containers[0].name` | `dind` | Docker-in-Docker sidecar | app에 Docker socket 제공 |
| `containers[0].image` | `docker:27-dind` | DinD 이미지 | nested Docker daemon 실행 |
| `containers[0].args[0]` | `--host=unix:///var/run/docker.sock` | local Unix socket 노출 | shared volume 사용 |
| `containers[0].env[DOCKER_TLS_CERTDIR]` | empty string | TLS cert dir 비활성화 | local socket 단순화 |
| `containers[0].securityContext.privileged` | `true` | DinD 필수 조건 | 보안 민감 설정 |
| `containers[0].volumeMounts` | `/var/run`, `/var/lib/docker` | socket와 graph storage | `emptyDir` volume 사용 |
| `containers[0].startupProbe.exec` | `docker info ...` | DinD readiness | Docker daemon이 살아날 때까지 대기 |
| `containers[1].name` | `terminal-server` | 앱 컨테이너 | 메인 terminal server |
| `containers[1].image` | `ghcr.io/example-org/blog-terminal:latest` | terminal 이미지 | 앱 워크로드 |
| `ports[name=http]` | `8080` | 앱 포트 | Service가 노출 |
| `env[BACKEND_KEY]` | Secret 값 | 내부 auth key | `blog-app-secrets` 사용 |
| `env[SANDBOX_IMAGE]` | ConfigMap 값 | 세션별 sandbox 이미지 | `blog-app-config` 사용 |
| `env[DOCKER_HOST]` | `unix:///var/run/docker.sock` | Docker socket 경로 | DinD sidecar를 가리킴 |
| `volumeMounts[0].mountPath` | `/var/run` | socket mount | DinD와 공유 |
| `startupProbe.exec` | `test -S /var/run/docker.sock` | socket 파일 대기 | 앱 startup gate |
| `readinessProbe.httpGet.path` | `/health` | readiness endpoint | optional service health |
| `livenessProbe.httpGet.path` | `/health` | liveness endpoint | 비정상 앱 재시작 |
| `volumes[docker-sock]` | `emptyDir` | shared Unix socket volume | DinD와 app 사이 공유 |
| `volumes[docker-graph]` | `emptyDir` | DinD image/container storage | 일시적 nested Docker 데이터 |

### Terminal 연관관계

- optional `optional/terminal/terminal-ingress-optional.yaml`이 public 트래픽을 여기로 보냅니다.
- terminal app은 Secret의 `BACKEND_KEY`, ConfigMap의 `SANDBOX_IMAGE`를 사용합니다.
- 이 워크로드는 privileged DinD가 필요하므로 의도적으로 optional로 분리되어 있습니다.

## 선택 Terminal Ingress

파일: `optional/terminal/terminal-ingress-optional.yaml`

### 필드 설명

| 경로 | 값 | 의미 | 관련 리소스 |
| --- | --- | --- | --- |
| `metadata.name` | `terminal-origin` | Ingress 이름 | optional public terminal 진입점 |
| `spec.ingressClassName` | `traefik` | ingress controller | cluster에 존재해야 함 |
| `spec.tls[0].secretName` | `blog-origin-tls` | TLS secret | 동일한 TLS 소스 사용 |
| `spec.tls[0].hosts[0]` | `terminal-origin.example.com` | TLS host | terminal origin host |
| `spec.rules[0].host` | `terminal-origin.example.com` | host 라우팅 | 공개 hostname |
| `spec.rules[0].http.paths[0].path` | `/terminal` | prefix route | WebSocket/terminal 경로 |
| `spec.rules[0].http.paths[0].backend.service.name` | `terminal-server` | 대상 Service | optional terminal service로 전달 |
| `spec.rules[0].http.paths[0].backend.service.port.name` | `http` | 대상 Service 포트 | Service port로 해석 |

## 포트 매핑 표

| 공개 또는 내부 진입점 | 리소스 | 포트 | 실제 워크로드/컨테이너 포트 |
| --- | --- | --- | --- |
| `origin.example.com/api` | `Ingress blog-backend` | HTTPS | `Service api:5080` -> `Deployment api containerPort 5080` |
| `api` 내부 DNS | `Service api` | `5080` | `api` 컨테이너 `http` |
| `postgres` 내부 DNS | `Service postgres` | `5432` | `postgres` 컨테이너 `postgres` |
| `redis` 내부 DNS | `Service redis` | `6379` | `redis` 컨테이너 `redis` |
| `chromadb` 내부 DNS | `Service chromadb` | `8000` | `chromadb` 컨테이너 `http` |
| `surrealdb` 내부 DNS | `Service surrealdb` | `8000` | `surrealdb` 컨테이너 `http` |
| `open-notebook` 내부 DNS | `Service open-notebook` | `8501` | `open-notebook` 컨테이너 `web` |
| `terminal-origin.example.com/terminal` | optional Ingress | HTTPS | `Service terminal-server:8080` -> `terminal-server` 컨테이너 `8080` |

## 스토리지 매핑 표

| 워크로드 | 스토리지 방식 | 마운트 경로 | 영속성 |
| --- | --- | --- | --- |
| `api` | PVC `api-sqlite` | `/app/.data` | 영속 |
| `api` repo sync | `emptyDir repo-data` | initContainer에서는 `/repo`, 앱에서는 `/frontend`, `/workers`, `/backend` | Pod 단위 임시 |
| `postgres` | `volumeClaimTemplates:data` | `/var/lib/postgresql/data` | 영속 |
| `redis` | `volumeClaimTemplates:data` | `/data` | 영속 |
| `chromadb` | `volumeClaimTemplates:data` | `/chroma/chroma` | 영속 |
| `surrealdb` | `volumeClaimTemplates:data` | `/data` | 영속 |
| optional `terminal-server` DinD | `emptyDir docker-sock` | `/var/run` | 임시 |
| optional `terminal-server` DinD | `emptyDir docker-graph` | `/var/lib/docker` | 임시 |

## 설정 소비 표

| 소비자 | ConfigMap 사용 | Secret 사용 |
| --- | --- | --- |
| `api.initContainer sync-repo` | `envFrom` 전체 import | `envFrom` 전체 import |
| `api` main container | `envFrom` 전체 import | `envFrom` 전체 import |
| `postgres` | `POSTGRES_DB`, `POSTGRES_USER` | `POSTGRES_PASSWORD` |
| `redis` | 없음 | `REDIS_PASSWORD` optional |
| `chromadb` | 없음 | 없음 |
| `surrealdb` | 없음 | `SURREALDB_ROOT_PASSWORD` |
| `open-notebook` | `AI_DEFAULT_MODEL`, `AI_EMBED_MODEL` | AI URL/key 세트 + `SURREALDB_ROOT_PASSWORD` |
| optional `terminal-server` | `SANDBOX_IMAGE` | `BACKEND_KEY` |

## 현재 템플릿이 사용하는 서비스 디스커버리 규칙

- `api`가 기대하는 대상:
  - `postgres` via `DATABASE_URL`
  - `redis` via `REDIS_URL`
  - `chromadb` via `CHROMA_URL`
  - `open-notebook` via `OPEN_NOTEBOOK_URL`
  - optional `terminal-server` via `TERMINAL_SERVER_URL`

- `open-notebook`이 기대하는 대상:
  - `surrealdb` via `SURREAL_URL=ws://surrealdb:8000/rpc`

- optional `terminal-server`가 기대하는 대상:
  - nested Docker daemon via `DOCKER_HOST=unix:///var/run/docker.sock`

## 현재 설계 기준 운영 메모

1. `api`는 SQLite PVC를 사용하고 `Recreate` 전략을 쓰기 때문에 의도적으로 단일 replica입니다.
2. stateful 서비스들은 StatefulSet과 짝을 맞추기 위해 headless Service를 사용합니다.
3. repo-sync 모델은 `emptyDir`에 의존하므로 Pod 단위 임시 데이터입니다.
4. example Secret 파일들은 문서용이며 `kubectl apply -k k3s`에 포함되지 않습니다.
5. optional terminal 매니페스트는 cluster 보안 프로파일을 바꾸기 때문에 분리돼 있습니다.
6. HTTPS redirect 동작은 Traefik CRD가 설치되어 있고 `Middleware` 리소스를 controller가 받아들여야 합니다.

## 요청 흐름 추적 예시

### 공개 API 요청

```text
Client
  -> Ingress blog-backend
  -> Service api
  -> Pod label app=api
  -> Deployment api container
```

### API가 Chroma를 사용하는 요청

```text
api container
  -> CHROMA_URL=http://chromadb:8000
  -> Service chromadb
  -> Pod label app=chromadb
  -> StatefulSet chromadb container
```

### Notebook 시작 흐름

```text
Deployment open-notebook
  -> initContainer wait-for-surrealdb
  -> Service surrealdb
  -> StatefulSet surrealdb
  -> open-notebook main container starts
```

### 선택 terminal 요청

```text
Client
  -> Ingress terminal-origin
  -> Service terminal-server
  -> terminal-server container
  -> DOCKER_HOST unix socket
  -> dind sidecar
```
