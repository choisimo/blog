# API Integration Fix

## 문제점
프론트엔드에서 Cloudflare Workers API로의 모든 요청이 404 에러 발생

### 원인
1. `getApiBaseUrl()`이 `null`을 반환하여 API URL이 설정되지 않음
2. `VITE_API_BASE_URL` 환경 변수가 설정되지 않음
3. Runtime config가 주입되지 않음

## 해결 방법

### 1. 기본 API URL 설정
`frontend/src/utils/apiBase.ts`에 기본 URL 추가:
```typescript
const DEFAULT_API_URL = 'https://blog-api.immuddelo.workers.dev';

export function getApiBaseUrl(): string {
  // 1) Runtime config
  // 2) Vite env
  // 3) localStorage
  // 4) Default production URL
  return DEFAULT_API_URL;
}
```

### 2. 반환 타입 변경
- Before: `string | null`
- After: `string` (항상 유효한 URL 반환)

### 3. Null 체크 제거
`CommentSection.tsx`에서 불필요한 null 체크 제거:
```typescript
// Before
const apiBase = getApiBaseUrl();
if (!apiBase) {
  throw new Error('Backend not configured');
}

// After
const base = getApiBaseUrl().replace(/\/$/, '');
```

## 수정된 파일

1. **frontend/src/utils/apiBase.ts**
   - 기본 API URL 추가
   - 반환 타입을 `string`으로 변경

2. **frontend/src/components/features/blog/CommentSection.tsx**
   - null 체크 제거
   - 오류 메시지 제거

## 검증

### API 엔드포인트 테스트
```bash
# Posts
curl -s "https://blog-api.immuddelo.workers.dev/api/v1/posts?limit=1" | jq .

# Comments
curl -s "https://blog-api.immuddelo.workers.dev/api/v1/comments?postId=test" | jq .

# Health
curl -s "https://blog-api.immuddelo.workers.dev/healthz" | jq .
```

모든 엔드포인트 정상 응답 확인 ✅

## 배포

```bash
git commit -m "fix: Set default API URL and remove null checks"
git push
```

GitHub Actions가 자동으로 배포합니다 (2-3분 소요).

## 최종 상태

### API Base URL 우선순위
1. `window.APP_CONFIG.apiBaseUrl` (Runtime injection)
2. `import.meta.env.VITE_API_BASE_URL` (Build time)
3. `localStorage.getItem('aiMemo.backendUrl')` (Developer convenience)
4. **`https://blog-api.immuddelo.workers.dev`** (Default) ✅

### 결과
- ✅ 댓글 로딩 정상 작동
- ✅ 댓글 작성 정상 작동
- ✅ AI 메모 기능 정상 작동
- ✅ 모든 API 호출에 유효한 URL 사용

## 추가 설정 (선택사항)

환경별로 다른 API URL을 사용하려면 GitHub Secret 설정:
```
Repository → Settings → Secrets → Actions
VITE_API_BASE_URL = https://your-custom-api.workers.dev
```

그러나 현재 기본값으로도 충분히 작동합니다.
