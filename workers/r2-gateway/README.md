# R2 Gateway

> 참고: 이 문서의 공개 호스트명과 운영 주소 예시는 모두 비식별 placeholder입니다.

## Service Overview

`workers/r2-gateway/`는 R2 object access worker입니다.

- worker name: `r2-gateway`
- runtime: Cloudflare Workers
- entrypoint: `workers/r2-gateway/src/index.ts`
- binding: `MY_BUCKET`
- compatibility flag: `nodejs_compat`

역할은 두 가지로 나뉩니다.

- public prefixes에 대한 read-only asset serving
- `/internal/*` 경로에 대한 authenticated object CRUD

## Public Path Contract

파일: `workers/r2-gateway/src/index.ts`

공개 prefix:

```text
ai-chat/
images/
posts/
assets/
```

확인된 동작:

- root path `/` -> `{ ok: true, service: "r2-gateway" }`
- `OPTIONS` -> `204` preflight
- public path는 `GET`, `HEAD`만 허용
- `assets/` prefix는 legacy path로 처리되며 실제 key lookup 전 prefix를 제거
- object가 없으면 `404 Object not found`
- `If-None-Match`가 `httpEtag`와 일치하면 `304 Not Modified`

public response headers:

- `ETag`
- `Cache-Control: public, max-age=31536000, immutable`
- `Accept-Ranges: bytes`
- R2 metadata 기반 `Content-Type` 등

## Internal API Contract

경로 형식:

```text
/internal/{resource}/{userId}/{id?}
```

인증:

- `X-Internal-Key` 헤더가 secret `INTERNAL_KEY`와 정확히 일치해야 함
- 불일치 시 `403 { ok: false, error: "Forbidden" }`

확인된 method contract:

- `GET /internal/{resource}/{userId}`
  - query: `cursor`, `limit`
  - `limit`는 최대 `100`
  - response: `{ ok, cursor, truncated, objects, delimitedPrefixes }`
- `GET /internal/{resource}/{userId}/{id}`
  - raw object body 반환
  - 없으면 `404`
- `HEAD /internal/{resource}/{userId}/{id}`
  - metadata headers만 반환
- `PUT /internal/{resource}/{userId}/{id}`
  - request body를 그대로 저장
  - stored content type: `application/json`
  - create 시 `201`, update 시 `200`
  - response: `{ ok: true, etag }`
- `DELETE /internal/{resource}/{userId}/{id}`
  - 성공 시 `204`

경계 조건:

- list endpoint에 `id`가 없는데 `GET`이 아닌 경우 `400 Invalid request`
- `resource` 또는 `userId`가 비면 `400 Invalid path`
- unsupported method는 `405`

## Concurrency And Caching Rules

### ETag handling

- list/object response의 ETag는 quote를 제거한 sanitized 값으로 JSON에 포함되거나 header에 설정됩니다.
- public asset path는 weak ETag prefix `W/`를 제거한 값으로 `If-None-Match` 비교를 수행합니다.

### Optimistic locking

- `PUT`와 `DELETE`는 `If-Match`를 지원합니다.
- existing object가 있고 ETag가 불일치하면 `412 ETag mismatch`
- `If-Match`가 있는데 기존 object가 없으면 `412 Missing resource`

이 전제 때문에 internal writer는 read-after-write가 아닌 ETag 기반 갱신 전략을 써야 충돌을 줄일 수 있습니다.

## CORS Boundary

파일: `workers/r2-gateway/src/index.ts`, `workers/r2-gateway/wrangler.toml`

- `ALLOWED_ORIGINS` 기본값은 dev에서 `*`
- prod는 명시된 host 목록 사용
- 허용 시 다음 header를 추가합니다.
  - `Access-Control-Allow-Origin`
  - `Access-Control-Allow-Methods: GET, HEAD, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type, If-None-Match`
  - `Access-Control-Max-Age: 86400`

문서상 주의:

- internal auth용 `X-Internal-Key`는 CORS allow headers에 포함되지 않습니다.
- 따라서 browser-origin public access와 server-to-server internal access는 다른 호출 모델을 전제로 합니다.

## Config And Deployment

파일: `workers/r2-gateway/wrangler.toml`

- binding: `MY_BUCKET -> blog`
- secret: `INTERNAL_KEY`
- observability enabled
- production은 `workers_dev = true`
- custom route는 주석 처리되어 있으며 현재 파일 기준 활성화되지 않음

배포 예시:

```bash
cd workers/r2-gateway
wrangler deploy --env production
wrangler secret put INTERNAL_KEY --env production
```

## Operations

### Quick checks

```bash
curl https://assets.example.com/
curl -I https://assets.example.com/images/example.png
curl -H 'If-None-Match: "etag"' https://assets.example.com/images/example.png
curl -H 'X-Internal-Key: <key>' https://assets.example.com/internal/memories/user1/
```

### Failure modes

- missing object -> `404`
- bad internal key -> `403`
- stale `If-Match` -> `412`
- wrong method on public path -> `405`
- misconfigured CORS origin list -> browser access blocked despite worker health being normal
