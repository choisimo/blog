# Service Boundaries

이 문서는 edge worker, backend, proxy-only 경계를 명시합니다.

## Boundary classes

- **worker-owned**: Cloudflare Worker가 비즈니스 로직과 데이터 접근을 직접 책임집니다.
- **backend-owned**: Backend가 source of truth이며, Worker는 진입점이더라도 origin 프록시 역할만 수행합니다.
- **proxy-only**: 운영/호환성 경로로서 worker가 단순 중계합니다.
- **compatibility**: 양쪽에서 제공하지만 API 계약은 동일하게 유지해야 하는 경로입니다.

## Enforcement points

- `shared/src/contracts/service-boundaries.js`
- `backend/src/routes/registry.js`
- `workers/api-gateway/src/routes/registry.ts`

## Operational headers

모든 boundary-aware 응답은 아래 헤더를 포함합니다.

- `X-Route-Boundary-Id`
- `X-Route-Owner`
- `X-Route-Responder`
- `X-Route-Edge-Mode`
- `X-Route-Origin-Mode`
