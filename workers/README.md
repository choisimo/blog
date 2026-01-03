# Cloudflare Workers - Blog Platform

통합된 블로그 플랫폼 Workers 구조입니다.

## 📁 구조

```
workers/
├── api-gateway/          # ✅ 메인 API Gateway (통합됨)
│   ├── src/
│   │   ├── index.ts      # 엔트리포인트 (Hono + 백엔드 프록시)
│   │   ├── routes/       # API 라우트들
│   │   ├── lib/          # 유틸리티
│   │   ├── middleware/   # 미들웨어
│   │   └── types.ts      # 타입 정의
│   ├── wrangler.toml     # D1, R2, KV, Cron 설정
│   └── package.json
│
├── blog-ai-gateway/      # ✅ AI 서비스 Gateway
│   ├── src/index.ts      # AI 프록시 + R2 저장소
│   └── wrangler.toml     # AI Agent 서버 설정
│
├── r2-gateway/           # ✅ R2 스토리지 Gateway
│   └── src/index.ts      # 퍼블릭/내부 R2 접근 제어
│
├── terminal-gateway/     # ⚠️ 폐기 검토 중
│   ├── src/index.ts      # WebSocket 터미널 프록시
│   └── DEPRECATED.md     # 폐기 조건 문서
│
├── src/                  # ❌ DEPRECATED (api-gateway로 이동됨)
│   └── DEPRECATED.md
│
└── migrations/           # D1 마이그레이션 파일들
```

## 🚀 Workers 목록

| Worker | 도메인 | 역할 | 상태 |
|--------|--------|------|------|
| **blog-api-gateway** | `api.nodove.com` | 통합 API (D1, R2, KV, Cron) + 백엔드 프록시 | ✅ Active |
| **blog-ai-gateway** | `blog-ai.nodove.com`, `ai-check.nodove.com` | AI 서비스 라우팅 + R2 저장소 | ✅ Active |
| **r2-gateway** | (Service Binding) | R2 접근 제어 | ✅ Active |
| **terminal-gateway** | `terminal.nodove.com` | WebSocket 터미널 | ⚠️ 폐기 검토 |
| ~~blog-api-prod~~ | ~~workers.dev~~ | ~~레거시 API~~ | ❌ Deprecated |

## 📦 배포

### blog-api-gateway (메인)
```bash
cd workers/api-gateway
npm install
npm run deploy:prod
```

### blog-ai-gateway
```bash
cd workers/blog-ai-gateway
npm install
npx wrangler deploy --env production
```

## 🔧 설정

### blog-api-gateway Secrets
```bash
cd workers/api-gateway
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put BACKEND_ORIGIN --env production
npx wrangler secret put BACKEND_SECRET_KEY --env production
npx wrangler secret put ADMIN_USERNAME --env production
npx wrangler secret put ADMIN_PASSWORD --env production
```

### blog-ai-gateway 환경변수
`wrangler.toml`에서 AI Agent 서버 설정:
```toml
[env.production.vars]
AI_AGENT_PRIMARY_HOST = "ai-serve.nodove.com"
AI_AGENT_FALLBACK_HOST = ""  # 옵션: 백업 서버
AI_AGENT_TIMEOUT_MS = "30000"
AI_AGENT_RETRY_COUNT = "2"
```

또는 JSON 배열로 여러 서버 설정:
```toml
AI_AGENTS = '[{"name":"primary","host":"ai-serve.nodove.com","priority":1},{"name":"backup","host":"ai-backup.nodove.com","priority":2}]'
```

## 🔄 마이그레이션 가이드

### 기존 blog-api → blog-api-gateway
1. 모든 기능이 `workers/api-gateway/`로 통합됨
2. 엔드포인트 동일: `api.nodove.com/*`
3. GitHub Actions: `deploy-api-gateway.yml` 사용

### 기존 ai-check-gateway → blog-ai-gateway
1. 폴더 이름 변경: `ai-check-gateway` → `blog-ai-gateway`
2. Worker 이름 변경: `ai-check-gateway` → `blog-ai-gateway`
3. 새 도메인: `blog-ai.nodove.com` (기존 `ai-check.nodove.com`도 유지)
4. AI Agent 서버 설정 옵션 추가

## 📋 GitHub Actions

| Workflow | 설명 |
|----------|------|
| `deploy-api-gateway.yml` | ✅ 메인 API Gateway 배포 |
| `deploy-blog-ai-gateway.yml` | ✅ AI Gateway 배포 |
| `deploy-workers.yml` | ❌ DEPRECATED |

## 🔗 관련 문서

- [API Gateway README](./api-gateway/README.md)
- [R2 Gateway README](./r2-gateway/README.md)
- [Terminal Gateway 폐기 계획](./terminal-gateway/DEPRECATED.md)
