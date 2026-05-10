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
flutter run -d chrome
```

첫 화면에서 API Base URL을 입력합니다. 로컬 backend 기준 예시는 `http://localhost:5080`입니다. 배포 환경에서는 Worker/API Gateway base URL을 입력합니다.

## 인증 흐름

1. 앱 시작 시 `/api/v1/auth/totp/status`를 호출합니다.
2. TOTP가 미설정이면 `ADMIN_SETUP_TOKEN`을 입력해 `/api/v1/auth/totp/setup`을 호출합니다.
3. QR/manual secret으로 TOTP를 등록하고 `/api/v1/auth/totp/setup/verify`로 확인합니다.
4. 로그인은 `/api/v1/auth/totp/challenge` → `/api/v1/auth/totp/verify` 순서로 진행합니다.
5. access token 만료 전 `/api/v1/auth/refresh`를 사용합니다.

## 주의

- 실제 secret 값 reveal/export/import 기능이 포함되어 있으므로 프로덕션 사용 시 HTTPS와 관리자 권한 검증을 전제로 사용해야 합니다.
- Flutter SDK가 없는 환경에서도 소스 전체를 검토할 수 있도록 build 산출물은 포함하지 않았습니다.
