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
├── r2-gateway/           # ✅ R2 스토리지 Gateway
│   └── src/index.ts      # 퍼블릭/내부 R2 접근 제어
│
├── terminal-gateway/     # ✅ Terminal WebSocket Gateway
│   ├── src/index.ts      # WebSocket 터미널 프록시
│   └── wrangler.toml
│
├── db-api/               # 📋 DB API (템플릿)
│   └── wrangler.toml.tpl
│
└── migrations/           # D1 마이그레이션 파일들
```

## 🚀 Workers 목록

| Worker | 도메인 | 역할 | 상태 |
|--------|--------|------|------|
| **blog-api-gateway** | `api.nodove.com` | 통합 API (D1, R2, KV, Cron) + 백엔드 프록시 | ✅ Active |
| **r2-gateway** | (Service Binding) | R2 접근 제어 | ✅ Active |
| **terminal-gateway** | `terminal.nodove.com` | WebSocket 터미널 | ✅ Active |

## 📦 배포

### blog-api-gateway (메인)
```bash
cd workers/api-gateway
npm install
npm run deploy:prod
```

### r2-gateway
```bash
cd workers/r2-gateway
npm install
npx wrangler deploy --env production
```

### terminal-gateway
```bash
cd workers/terminal-gateway
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
npx wrangler secret put ADMIN_EMAIL --env production
npx wrangler secret put RESEND_API_KEY --env production
```

### terminal-gateway Secrets
```bash
cd workers/terminal-gateway
npx wrangler secret put JWT_SECRET --env production
npx wrangler secret put ORIGIN_SECRET_KEY --env production
```

### r2-gateway Secrets
```bash
cd workers/r2-gateway
npx wrangler secret put INTERNAL_CALLER_KEY --env production
```

## 📋 GitHub Actions

| Workflow | 설명 |
|----------|------|
| `deploy-api-gateway.yml` | ✅ 메인 API Gateway 배포 |
| `deploy-workers.yml` | ❌ DEPRECATED |

## 🔗 관련 문서

- [API Gateway README](./api-gateway/README.md)
- [R2 Gateway README](./r2-gateway/README.md)
