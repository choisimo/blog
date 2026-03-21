# Terminal Gateway

> 참고: 이 문서의 공개 호스트명과 운영 주소 예시는 모두 비식별 placeholder입니다.

## Service Overview

`workers/terminal-gateway/`는 terminal origin으로 들어가는 WebSocket gateway입니다.

- worker name: `terminal-gateway`
- production worker name in Wrangler: `terminal-gateway-prod`
- runtime: Cloudflare Workers
- entrypoint: `workers/terminal-gateway/src/index.ts`
- compatibility flag: `nodejs_compat`
- state dependency: KV

역할은 terminal 연결 자체를 처리하는 것이 아니라, origin 연결 전에 인증과 admission control을 수행하는 것입니다.

## Request Boundary

파일: `workers/terminal-gateway/src/index.ts`

확인된 endpoint:

- `GET /health` -> `{ status: "ok", env }`
- `/terminal` 또는 `/terminal/`만 terminal path로 허용
- 그 외 path는 `404 Not Found`

terminal path contract:

1. `Upgrade: websocket` 필요, 없으면 `426`
2. JWT token 추출 및 검증 필요, 실패 시 `401`
3. IP 기준 rate limit 검사, 초과 시 `429`
4. user 기준 active session 검사, 있으면 `409`
5. blocked country면 `403`
6. session 생성 후 origin으로 프록시 시도
7. origin fetch 실패 시 session 정리 후 `502`

## Authentication Contract

파일: `workers/terminal-gateway/src/auth.ts`

token 추출 순서:

1. `Authorization: Bearer <token>`
2. `terminal_token` cookie
3. `?token=` query parameter

JWT 검증 규칙:

- token 형식은 3-part JWT 여야 함
- `exp`가 현재 시각보다 과거면 거부
- `env.JWT_SECRET`으로 HMAC SHA-256 signature 검증
- 검증 실패 시 `null` 반환 후 요청은 `401`

문서상 경계:

- query param token은 코드 주석상 last resort입니다.
- payload에서 실제로 사용하는 식별자는 `sub`, `email`입니다.

## Rate Limit And Session Rules

파일: `workers/terminal-gateway/src/ratelimit.ts`

- rate limit window: 60초
- rate limit max: IP당 5회 연결 시도
- 초과 시 응답 header:
  - `Retry-After`
  - `X-RateLimit-Remaining: 0`
  - `X-RateLimit-Reset`
- session key: `session:{userId}`
- session TTL: 15분
- active session 판단 기준: 마지막 활동 시각이 5분 이내면 active

중요한 구현 관찰:

- `updateSessionActivity()` helper는 존재하지만 현재 gateway entrypoint에서 호출되지 않습니다.
- 따라서 세션은 origin 연결이 오래 살아 있어도 gateway 기준으로는 마지막 생성 시각 이후 5분이 지나면 stale cleanup 대상이 됩니다.

## Origin Proxy Contract

파일: `workers/terminal-gateway/src/index.ts`, `workers/terminal-gateway/wrangler.toml`

- origin URL: `${TERMINAL_ORIGIN}/terminal`
- injected headers:
  - `X-Backend-Key`
  - `X-User-ID`
  - `X-User-Email`
  - `X-Client-IP`
  - `X-Request-ID`
- origin 응답이 `>= 400`이면 session을 삭제
- fetch exception도 session 삭제 후 `502 Bad Gateway`

숨은 전제:

- terminal origin은 `X-Backend-Key`를 신뢰하는 내부 서비스여야 합니다.
- user identity는 JWT payload를 그대로 origin header로 전달합니다.

## Geo Blocking

파일: `workers/terminal-gateway/src/index.ts`

현재 차단 국가 목록:

```text
CN
RU
KP
```

이 정책은 코드 상수에 고정되어 있으며 runtime config에서 동적으로 읽지 않습니다.

## Config And Bindings

파일: `workers/terminal-gateway/wrangler.toml`

- dev vars:
  - `ENV = "development"`
  - `TERMINAL_ORIGIN = "https://terminal-origin.nodove.com"`
- prod vars:
  - `ENV = "production"`
  - `TERMINAL_ORIGIN = "https://terminal-origin.nodove.com"`
- KV binding: `KV`
- documented secrets:
  - `BACKEND_KEY`
  - `JWT_SECRET`

문서상 주의:

- 이 Wrangler 파일에는 custom route가 선언되어 있지 않습니다.
- 외부 hostname 연결은 다른 인프라 계층에서 관리될 수 있으므로, 배포 후 실제 public route는 별도 확인이 필요합니다.

## Operations

### Quick checks

```bash
curl https://terminal.example.com/health
```

### Failure modes

- missing or invalid JWT -> `401`
- non-websocket request on `/terminal` -> `426`
- too many connection attempts from one IP -> `429`
- duplicate live session by same user -> `409`
- blocked country -> `403`
- origin unavailable -> `502`
