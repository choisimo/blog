# ⚠️ Terminal Gateway - Deprecation Notice

## 현재 상태: 폐기 검토 중

이 Worker는 폐기 예정이지만, 아래 보안 기능들이 다른 곳에서 구현되어야 합니다.

## 이 Worker의 역할

1. **JWT 인증**: WebSocket 연결 전 사용자 토큰 검증
2. **Rate Limiting**: IP 기반 연결 제한 (KV 사용)
3. **Single Session**: 사용자당 1개 세션만 허용 (KV 사용)
4. **Geo-blocking**: 특정 국가에서의 접근 차단
5. **Secret Key Injection**: `X-Origin-Secret` 헤더 주입

## 폐기 조건

다음 중 하나가 충족되면 이 Worker를 폐기할 수 있습니다:

### Option 1: blog-api-gateway에 통합
- `blog-api-gateway`의 `/terminal/*` 라우트에서 JWT 인증 + rate limiting 구현
- 프론트엔드가 `wss://api.nodove.com/terminal` 사용하도록 변경

### Option 2: terminal-server에서 직접 인증
- `terminal-server`에 JWT 검증 로직 추가
- Rate limiting을 Redis로 구현
- nginx에서 직접 `/terminal/` 라우팅

### Option 3: Cloudflare Access 사용
- Cloudflare Access로 `terminal.nodove.com` 보호
- JWT 검증을 Cloudflare Access에 위임

## 마이그레이션 순서

1. 새 인증 방식 구현 및 테스트
2. 프론트엔드 URL 변경 (`terminal.nodove.com` → `api.nodove.com/terminal`)
3. DNS/Route 변경
4. 이 Worker 삭제

## 관련 파일

- Frontend: `frontend/src/services/terminal.ts`
- Backend: `backend/terminal-server/src/index.ts`
- Nginx: `backend/nginx/nginx.conf` (`/terminal/` route)
