# noblog Admin Flutter

Flutter로 작성한 `blog-main` 관리자 전용 콘솔입니다. React 관리자 화면과 backend/worker 관리자 API를 기준으로 관리자 기능만 구현했습니다.

## 포함된 관리자 기능

- TOTP setup/login, refresh token, logout
- Health: backend, RAG, agent, AI providers
- RAG: health, collections, status, search, embed, index, delete
- Analytics: trending, realtime, refresh stats, editor picks, post stats, visit detail
- Logs: paged logs, SSE stream
- Content: Home AI CTA block read/write
- AI: providers, models, routes, playground, usage, traces, prompts, prompt templates, config export
- Env config: categories, current config, validate, export, save `.env`, schema
- Secrets: categories, CRUD, reveal, generate, audit, overview, health, export/import
- Workers: list, config, deploy, secret/vars update, D1/KV/R2 resources, tail request
- New Post: PR creation, image upload, AI image generation, Markdown preview
- Admin Ops: proposed version PR, archive comments, backend outbox, outbox flush

## 실행

```bash
flutter pub get
flutter run -d linux
```

API Base URL의 기본값은 프로덕션 Worker/API Gateway인 `https://api.nodove.com`입니다. 이 gateway가 `ssh blog` 서버의 backend origin인 `https://blog-b.nodove.com`으로 서명된 요청을 전달합니다. 직접 `https://blog-b.nodove.com`을 앱 base로 사용하면 gateway signature 검증 때문에 관리자 인증/API가 실패합니다.

다른 환경을 빌드해야 할 때만 build-time define으로 바꿉니다. 토큰이 임의 origin으로 전송되지 않도록 production origin 외 HTTPS 주소는 `ADMIN_API_ALLOWED_ORIGINS`에 명시해야 하며, origin을 변경하면 기존 세션은 즉시 삭제됩니다. 쉼표로 여러 주소를 지정할 수 있습니다. HTTP는 localhost/loopback 개발 환경에서만 허용됩니다.

```bash
flutter build linux --release \
  --dart-define=ADMIN_API_BASE_URL=https://staging-api.nodove.com \
  --dart-define=ADMIN_API_ALLOWED_ORIGINS=https://staging-api.nodove.com
```

## 인증 흐름

1. 앱 시작 시 `/api/v1/auth/totp/status`를 호출합니다.
2. TOTP가 미설정이면 `ADMIN_SETUP_TOKEN`을 입력해 `/api/v1/auth/totp/setup`을 호출합니다.
3. 서버가 반환하는 `otpauthUri`를 authenticator 앱으로 열거나 manual secret을 등록하고 `/api/v1/auth/totp/setup/verify`로 확인합니다. 호환 서버가 data-URL QR을 제공하는 경우 앱 내부에서도 표시합니다.
4. 로그인은 `/api/v1/auth/totp/challenge` → `/api/v1/auth/totp/verify` 순서로 진행합니다.
5. access token 만료 전 `/api/v1/auth/refresh`를 사용합니다. 동시 요청은 하나의 refresh 회전으로 합쳐지며, 일시적인 네트워크 실패는 로컬 세션을 폐기하지 않습니다. 진행 중인 refresh 저장보다 logout과 API origin 변경이 항상 우선합니다.

## 주의

- 실제 secret 값 reveal/export/import 기능이 포함되어 있으므로 프로덕션 사용 시 HTTPS와 관리자 권한 검증을 전제로 사용해야 합니다.
- finite HTTP 요청에는 timeout이 적용되며, 파괴적 관리 작업은 실행 전 확인 대화상자를 거칩니다.
- CI는 format, analyze, 전체 Flutter 테스트, Linux release build를 필수 검증합니다.
- Flutter SDK가 없는 환경에서도 소스 전체를 검토할 수 있도록 build 산출물은 포함하지 않았습니다.
