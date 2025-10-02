# Workers Setup Guide

이 가이드는 블로그 Workers API를 완전히 설정하고 댓글 및 AI 기능을 활성화하는 방법을 안내합니다.

## 1. Cloudflare Workers 배포 완료 ✅

현재 상태:
- **Dev**: `https://blog-api.immuddelo.workers.dev` ✅ 배포됨
- **Production**: `https://blog-api-prod.immuddelo.workers.dev` ✅ 배포됨
- **D1 Database**: Dev/Prod 모두 마이그레이션 완료 ✅
- **CORS**: `noblog.nodove.com` 허용 설정 완료 ✅

## 2. GitHub Pages 연동 확인 ✅

프론트엔드가 Workers API를 정상적으로 호출하고 있습니다:
- API Base URL: `https://blog-api.immuddelo.workers.dev`
- Health check: ✅ 정상
- Public config: ✅ 정상
- Posts API: ✅ 정상

## 3. 댓글 기능 상태

### 현재 상태
댓글 API 엔드포인트는 **정상 작동** 중입니다:
- `GET /api/v1/comments?postId=xxx` ✅
- `POST /api/v1/comments` ✅

### 동작 방식
프론트엔드 (`CommentSection.tsx`)는 다음과 같이 작동합니다:
1. `getApiBaseUrl()`로 Workers URL 확인
2. `/api/v1/comments?postId=xxx`로 댓글 목록 가져오기
3. 새 댓글 작성 시 `POST /api/v1/comments`로 전송

### 테스트 필요
실제 블로그 포스트에서 댓글 기능을 테스트해야 합니다:
```bash
# 댓글 목록 조회 (postId는 실제 포스트 ID 또는 slug)
curl "https://blog-api.immuddelo.workers.dev/api/v1/comments?postId=test-post"

# 댓글 작성
curl -X POST https://blog-api.immuddelo.workers.dev/api/v1/comments \
  -H "Content-Type: application/json" \
  -H "Origin: https://noblog.nodove.com" \
  -d '{"postId":"test-post","author":"Test User","content":"Test comment"}'
```

## 4. AI 메모 기능 설정 ⚠️

### 현재 상태
AI 엔드포인트가 구현되어 있지만 **Gemini API Secret**이 설정되지 않았습니다.

### 설정 방법

#### 4.1. Gemini API Key 발급
1. https://aistudio.google.com/app/apikey 방문
2. API Key 생성
3. 키 복사

#### 4.2. Workers Secret 설정

**Development 환경:**
```bash
cd workers
echo 'GEMINI_API_KEY="your-api-key-here"' >> .dev.vars
echo 'JWT_SECRET="your-jwt-secret-here"' >> .dev.vars
```

**Production 환경:**
```bash
cd workers
npx wrangler secret put GEMINI_API_KEY --env production
# 프롬프트에서 API key 입력

npx wrangler secret put JWT_SECRET --env production
# 프롬프트에서 JWT secret 입력
```

#### 4.3. Workers 재배포
Secret 설정 후 재배포:
```bash
# Dev
npx wrangler deploy

# Production
npx wrangler deploy --env production
```

### AI 엔드포인트
설정 완료 후 다음 엔드포인트를 사용할 수 있습니다:
- `POST /api/v1/ai/sketch` - 감정적 스케치 생성
- `POST /api/v1/ai/prism` - 아이디어 측면 생성
- `POST /api/v1/ai/chain` - 후속 질문 생성
- `POST /api/v1/ai/generate` - 일반 AI 생성

### 프론트엔드 설정
프론트엔드는 자동으로 Workers API를 사용하도록 구현되어 있습니다:
- `src/services/ai.ts`는 `getApiBaseUrl()`을 통해 Workers를 먼저 시도
- Workers API 실패 시 브라우저에서 직접 Gemini API 호출 (fallback)
- Fallback을 위해 `localStorage.setItem('aiMemo.apiKey', '"your-key"')` 설정 가능

## 5. 관리자 계정 설정 (선택)

관리자 기능(포스트 작성/삭제)을 사용하려면:

```bash
cd workers

# Admin username 설정
npx wrangler secret put ADMIN_USERNAME --env production
# 입력: admin

# Admin password 설정 (bcrypt hash)
# 먼저 bcrypt hash 생성:
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"

npx wrangler secret put ADMIN_PASSWORD --env production
# 생성된 hash 입력
```

## 6. 검증 체크리스트

### 완료된 항목 ✅
- [x] Workers Dev 배포
- [x] Workers Production 배포
- [x] D1 Database 마이그레이션
- [x] CORS 설정
- [x] GitHub Pages 연동
- [x] 댓글 API 엔드포인트

### 필요한 항목 ⚠️
- [ ] Gemini API Secret 설정 (Dev)
- [ ] Gemini API Secret 설정 (Production)
- [ ] Workers 재배포 (Secret 적용)
- [ ] 실제 포스트에서 댓글 기능 테스트
- [ ] AI 기능 테스트
- [ ] Admin 계정 설정 (선택)

## 7. 트러블슈팅

### 댓글이 표시되지 않을 때
1. 브라우저 콘솔에서 API 호출 확인
2. `getApiBaseUrl()`이 올바른 URL 반환하는지 확인
4. D1 데이터베이스에 댓글 데이터가 있는지 확인:
   ```bash
   npx wrangler d1 execute blog-db --remote --command "SELECT * FROM comments LIMIT 10;"
   ```

### GitHub Secret 설정 완료

**GEMINI_API_KEY가 GitHub Secret으로 설정되었고 Workers에 적용되었습니다!**

### 현재 상태
- GitHub Secret 설정 완료 (Production)
- Workers 재배포 완료 (Version: 034a50b5-9094-426d-b2d3-ad5b5b6bacb8)
- GitHub Actions 워크플로우 업데이스트 완료

### 추가 작업 필요

AI 기능이 403 에러를 반환하는 경우, Gemini API Key가 유효한지 확인하세요:Workers 재배포 확인
3. API 응답 확인:
   ```bash
   curl -X POST https://blog-api.immuddelo.workers.dev/api/v1/ai/sketch \
     -H "Content-Type: application/json" \
     -d '{"paragraph":"Test paragraph","postTitle":"Test"}'

### CORS 에러
- `wrangler.toml`의 `ALLOWED_ORIGINS`에 프론트엔드 도메인이 포함되어 있는지 확인
- 현재 설정: `noblog.nodove.com`, `blog.nodove.com`

## 8. 다음 단계

1. **Gemini API Key 설정** - AI 기능 활성화
2. **실제 포스트 작성** - D1에 포스트 데이터 추가
3. **댓글 기능 테스트** - 실제 블로그에서 댓글 작성/읽기
4. **Production으로 전환** (선택):
   - GitHub Actions Secret 업데이트: `VITE_API_BASE_URL=https://blog-api-prod.immuddelo.workers.dev`
   - 프론트엔드 재배포

## 참고 문서

- Workers README: `workers/README.md`
- API 엔드포인트: `workers/README.md#api-endpoints`
- Migration Guide: `docs/MIGRATION-GUIDE.md`
- PRD: `docs/PRD-serverless-migration.md`
