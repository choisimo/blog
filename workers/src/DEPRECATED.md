# ⚠️ DEPRECATED - Blog API (Legacy)

## 이 폴더는 더 이상 사용되지 않습니다

모든 기능이 `workers/api-gateway/`로 통합되었습니다.

## 마이그레이션 정보

| 이전 | 이후 |
|------|------|
| `workers/src/*` | `workers/api-gateway/src/*` |
| `workers/wrangler.toml` | `workers/api-gateway/wrangler.toml` |
| Worker 이름: `blog-api` / `blog-api-prod` | Worker 이름: `blog-api-gateway` |

## 변경 사항

- **엔드포인트**: 동일 (`api.nodove.com/*`)
- **기능**: 모두 유지 (D1, R2, KV, Cron, 모든 라우트)
- **추가**: 백엔드 프록시 기능 통합

## 삭제 예정

이 폴더와 `workers/wrangler.toml`은 마이그레이션 완료 후 삭제될 예정입니다.

```bash
# 삭제 명령 (마이그레이션 완료 후)
rm -rf workers/src
rm workers/wrangler.toml
```

## 배포

새 배포는 `workers/api-gateway/`에서 진행하세요:

```bash
cd workers/api-gateway
npm install
npm run deploy:prod
```
