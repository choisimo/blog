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

다른 환경을 빌드해야 할 때만 build-time define으로 바꿉니다.

```bash
flutter build linux --release --dart-define=ADMIN_API_BASE_URL=https://api.nodove.com
```

## 인증 흐름

1. 앱 시작 시 `/api/v1/auth/totp/status`를 호출합니다.
2. TOTP가 미설정이면 `ADMIN_SETUP_TOKEN`을 입력해 `/api/v1/auth/totp/setup`을 호출합니다.
3. QR/manual secret으로 TOTP를 등록하고 `/api/v1/auth/totp/setup/verify`로 확인합니다.
4. 로그인은 `/api/v1/auth/totp/challenge` → `/api/v1/auth/totp/verify` 순서로 진행합니다.
5. access token 만료 전 `/api/v1/auth/refresh`를 사용합니다.

## 주의

- 실제 secret 값 reveal/export/import 기능이 포함되어 있으므로 프로덕션 사용 시 HTTPS와 관리자 권한 검증을 전제로 사용해야 합니다.
- Flutter SDK가 없는 환경에서도 소스 전체를 검토할 수 있도록 build 산출물은 포함하지 않았습니다.
