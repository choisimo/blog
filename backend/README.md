# Backend API Server (Blog)

블로그의 API 서버입니다. 게시글 Markdown 관리(CRUD), 통합/연도별 매니페스트 생성, 이미지 업로드/관리 등을 제공합니다.

- 런타임: Node.js 20+
- 프레임워크: Express 4
- 포트: `5080` (기본)
- 주요 경로: `/api/v1/*`

## 콘텐츠 경로(중요)
코드는 리포지토리 루트를 기준으로 정적 자산 디렉터리를 계산합니다.

- 리포지토리 루트: `repoRoot = path.resolve(process.cwd(), '..')` (기본적으로 `backend/` 한 단계 위)
- 정적 루트: `frontend/public`
- 게시글 디렉터리: `frontend/public/posts`
- 이미지 디렉터리: `frontend/public/images`

도커 컨테이너에서 실행 시 위 경로가 컨테이너 내부에도 존재해야 합니다. 운영·개발 모두에서 변경 사항을 호스트에 보존하려면 컨테이너에 `../frontend/public -> /frontend/public` 바인드 마운트를 권장합니다. 자세한 내용은 아래 Docker 섹션 참고.

## 주요 기능
- Posts API
  - `GET /api/v1/posts?year=YYYY&includeDrafts=true|false`
  - `GET /api/v1/posts/:year/:slug`
  - `POST /api/v1/posts` (admin)
  - `PUT /api/v1/posts/:year/:slug` (admin)
  - `DELETE /api/v1/posts/:year/:slug` (admin)
  - `POST /api/v1/posts/regenerate-manifests` (admin)
- Images API
  - `POST /api/v1/images/upload` (admin, multipart form, 필드명 `files`)
  - `GET /api/v1/images?year=YYYY&slug=slug` 또는 `?dir=sub/dir`
  - `DELETE /api/v1/images/:year/:slug/:filename` (admin)
- 공용
  - `GET /api/v1/healthz` (헬스체크)
  - `GET /api/v1/public/config` (프론트에서 필요한 공개설정)

## 환경 변수
`backend/.env.example`를 복사해 `.env`를 구성하세요.

- 서버/네트워킹
  - `APP_ENV` (`development|staging|production`) 기본 `development`
  - `HOST` 기본 `0.0.0.0`
  - `PORT` 기본 `5080`
  - `TRUST_PROXY` 프록시 홉 수. 기본 `1`
  - `ALLOWED_ORIGINS` CORS 허용 원본(콤마 구분)
  - `API_BASE_URL`, `SITE_BASE_URL`
  - 레이트 리밋: `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`
- 인증
  - `ADMIN_BEARER_TOKEN` 관리자 보호 라우트 토큰. 미설정 시 로컬 개발 편의를 위해 보호가 비활성화됩니다(운영에서는 반드시 설정!).
- 통합(옵션)
  - Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL`
  - Firebase: `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIREBASE_PROJECT_ID`
  - GitHub(PR 생성용): `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `GIT_USER_NAME`, `GIT_USER_EMAIL`

## 로컬(네이티브) 실행
사전 준비: Node.js 20+, npm 10+, `frontend/public` 존재(없으면 자동 생성되지만, 리포지토리 구조를 유지하는 것이 좋습니다)

```bash
cd backend
cp -n .env.example .env
# 필요 시 ADMIN_BEARER_TOKEN 설정
npm ci
npm run dev
# http://localhost:5080/api/v1/healthz 확인
```

## Docker로 실행
### 1) docker compose (리버스 프록시 포함)
`backend/docker-compose.yml`은 API와 nginx를 올립니다.

```bash
cd backend
cp -n .env.example .env
# 호스트의 정적 자산(프론트 빌드 소스)을 컨테이너에 마운트해 변경사항을 보존
# docker-compose.override.yml 생성(권장):
cat > docker-compose.override.yml <<'YAML'
services:
  api:
    volumes:
      - ../frontend/public:/frontend/public
  nginx:
    ports:
      - "8091:80"
YAML

docker compose up --build
# nginx 프록시 경유:    http://localhost:8091/api/v1/healthz
# 백엔드에 직결(포트): http://localhost:5080/api/v1/healthz
```

주의: 기본 `nginx.conf`는 `client_max_body_size 2m`입니다. 이미지 업로드 시 413이 난다면 `25m` 등으로 늘리세요.

```nginx
# backend/nginx.conf
server {
  client_max_body_size 25m; # 필요 시 조정
  ...
}
```

### 2) 단일 docker run (에페메럴/테스트)
`frontend/public` 대신 임시 디렉터리를 마운트하여 안전하게 실험할 수 있습니다.

```bash
TMP=$(mktemp -d)
# 임시 디렉터리에 posts/images가 생성됩니다
docker run --rm -it \
  -p 5080:5080 \
  --env-file backend/.env \
  -v "$TMP:/frontend/public" \
  -w /app \
  node:20-alpine sh -lc '
    apk add --no-cache nodejs npm && \
    cd /app && \
    mkdir -p /app && \
    # 애플리케이션 이미지 사용을 권장. 예시는 이해를 위한 baseline.
    exit 0
  '
# 권장: 프로젝트 이미지로 빌드/실행
# docker build -t blog-backend:local backend
# docker run --rm -p 5080:5080 --env-file backend/.env -v "$TMP:/frontend/public" blog-backend:local
```

## 매니페스트 생성/정합성
- 게시글 작성/수정/삭제 시:
  - 연도별 `frontend/public/posts/<year>/manifest.json` 갱신
  - 통합 `frontend/public/posts-manifest.json` 및 `frontend/public/posts/posts-manifest.json` 갱신
- 프론트의 `scripts/generate-manifests.js`와 구조 호환(필드: `title`, `slug`, `date`, `tags`, `readingTime`, `coverImage`, ...)

## 엔드포인트 요약
- Health: `GET /api/v1/healthz`
- Public config: `GET /api/v1/public/config`
- Posts
  - List: `GET /api/v1/posts?year=&includeDrafts=`
  - Get: `GET /api/v1/posts/:year/:slug`
  - Create: `POST /api/v1/posts` (admin)
  - Update: `PUT /api/v1/posts/:year/:slug` (admin)
  - Delete: `DELETE /api/v1/posts/:year/:slug` (admin)
  - Regenerate manifests: `POST /api/v1/posts/regenerate-manifests` (admin)
- Images
  - Upload: `POST /api/v1/images/upload` (admin, multipart: `files=@...` 여러개 허용)
  - List: `GET /api/v1/images?year=YYYY&slug=slug` 또는 `GET /api/v1/images?dir=covers`
  - Delete: `DELETE /api/v1/images/:year/:slug/:filename` (admin)

## 보안 & 운영 팁
- 운영 환경에서는 반드시 `ADMIN_BEARER_TOKEN`을 설정하여 쓰기 라우트를 보호하세요.
- CORS는 `ALLOWED_ORIGINS`에서 엄격히 제한하세요.
- 리버스 프록시(Nginx/Cloud) 앞에서는 `TRUST_PROXY`를 올바르게 설정하세요.
- 업로드 용량 제한은 프록시(Nginx)와 Express 양쪽에서 고려하세요.
- Docker로 실행 시 볼륨 마운트로 `frontend/public`을 호스트에 보존하는 구성을 권장합니다.

## 트러블슈팅
- 401 Unauthorized: `Authorization: Bearer <token>` 헤더 확인, 토큰 값 일치 여부 확인
- 413 Payload Too Large: Nginx `client_max_body_size` 증가, Express `express.json({ limit })` 조정 검토
- CORS 오류: `ALLOWED_ORIGINS`에 호출 원본 추가
- 매니페스트가 갱신되지 않음: 쓰기 연산 후 에러 로그 확인, 파일 권한/볼륨 마운트 경로 확인
