# Workers Deployment Status

최종 업데이트: 2025-10-03 02:14 KST

## ✅ 완료된 작업

### 1. Cloudflare Workers 배포
- **Dev Worker**: `https://blog-api.immuddelo.workers.dev` 
  - Version: `31704315-6858-4ce5-b6af-66e774e5ee0c`
  - CORS: ✅ `noblog.nodove.com` 허용
  
- **Production Worker**: `https://blog-api-prod.immuddelo.workers.dev`
  - Version: `034a50b5-9094-426d-b2d3-ad5b5b6bacb8`
  - CORS: ✅ `noblog.nodove.com` 허용

### 2. D1 Database
- **Dev**: `blog-db` (65661464-f6e2-4cdf-8da8-dd63a482fd29)
  - 마이그레이션: ✅ 완료
  - 테이블: users, posts, comments, tags, post_tags, attachments, settings
  
- **Production**: `blog-db-prod` (e547f944-71a0-42b6-8af1-abc50f29df80)
  - 마이그레이션: ✅ 완료
  - 테이블: users, posts, comments, tags, post_tags, attachments, settings

### 3. Secrets 설정
- **GEMINI_API_KEY**: ✅ Production에 설정 완료
- **JWT_SECRET**: ✅ Production에 설정 완료 (`DtRlOC1noMuWlWTZw2e3Ob58zx1j7av5vJuv0RPz3GY=`)

### 4. GitHub Actions
- **Workflow**: `.github/workflows/deploy-workers.yml`
- **업데이트**: ✅ Secret 자동 주입 설정 완료
- **Required Secrets**:
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_API_TOKEN`
  - `GEMINI_API_KEY` (AI 기능용)
  - `JWT_SECRET` (인증용)

### 5. GitHub Pages 연동
- **Frontend URL**: `https://noblog.nodove.com`
- **API Base URL**: `https://blog-api.immuddelo.workers.dev` (Dev)
- **연동 상태**: ✅ CORS 설정 완료, API 호출 성공

## 📊 API 엔드포인트 검증

| Endpoint | Dev | Production | Status |
|----------|-----|------------|--------|
| `/healthz` | ✅ | ✅ | 정상 |
| `/public/config` | ✅ | ✅ | 정상 |
| `/api/v1/posts` | ✅ | ✅ | 정상 (데이터 없음) |
| `/api/v1/comments` | ✅ | ✅ | 정상 |
| `/api/v1/ai/*` | ⚠️ | ⚠️ | Secret 테스트 필요 |

## ⚠️ AI 기능 403 에러 해결

현재 AI 엔드포인트가 403 에러를 반환합니다:
```
"PERMISSION_DENIED": Method doesn't allow unregistered callers
```

### 원인
Gemini API Key가 잘못 설정되었거나 유효하지 않을 가능성이 있습니다.

### 해결 방법

#### 1. GitHub Secret 확인
GitHub Repository → Settings → Secrets and variables → Actions에서:
- `GEMINI_API_KEY` 값이 올바른 Gemini API 키인지 확인
- https://aistudio.google.com/app/apikey 에서 발급한 키인지 확인

#### 2. 로컬에서 Secret 재설정
```bash
cd workers

# GitHub Secret에서 사용한 것과 동일한 키로 설정
npx wrangler secret put GEMINI_API_KEY --env production
# 프롬프트에서 API 키 입력 (AIza로 시작하는 키)
```

#### 3. Workers 재배포
```bash
npx wrangler deploy --env production
```

#### 4. 테스트
```bash
curl -X POST https://blog-api-prod.immuddelo.workers.dev/api/v1/ai/sketch \
  -H "Content-Type: application/json" \
  -d '{"paragraph":"테스트 문단","postTitle":"테스트"}' \
  | jq .
```

성공 응답 예시:
```json
{
  "ok": true,
  "data": {
    "mood": "curious",
    "bullets": ["...", "...", "..."]
  }
}
```

## 🔧 댓글 기능 사용법

### 댓글 조회
```bash
curl "https://blog-api.immuddelo.workers.dev/api/v1/comments?postId=YOUR_POST_SLUG"
```

### 댓글 작성
```bash
curl -X POST https://blog-api.immuddelo.workers.dev/api/v1/comments \
  -H "Content-Type: application/json" \
  -H "Origin: https://noblog.nodove.com" \
  -d '{
    "postId": "YOUR_POST_SLUG",
    "author": "Your Name",
    "content": "Your comment",
    "email": "your@email.com"
  }'
```

## 📝 Git Commits

```bash
commit 03e87fb: fix: Add noblog.nodove.com to CORS allowed origins
commit 4a61caa: docs: Add Gemini API secret configuration instructions
commit 8cb14c9: ci: Configure GitHub Secrets for Workers deployment
```

## 🎯 다음 단계

### 즉시 필요
1. [ ] **Gemini API Key 검증** - GitHub Secret 값이 유효한지 확인
2. [ ] **AI 엔드포인트 재테스트** - 403 에러 해결 확인

### 선택 사항
3. [ ] **블로그 포스트 작성** - D1에 실제 콘텐츠 추가
4. [ ] **댓글 기능 실사용 테스트** - 실제 포스트에서 댓글 작성/읽기
5. [ ] **Production URL로 전환** - `VITE_API_BASE_URL` GitHub Secret을 prod URL로 업데이트

## 📚 참고 문서

- **설정 가이드**: `workers/SETUP.md`
- **API 문서**: `workers/README.md`
- **워크플로우**: `.github/workflows/deploy-workers.yml`
- **Migration Guide**: `docs/MIGRATION-GUIDE.md`
