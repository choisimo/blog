# Shared Contract Rollout

작성일: 2026-03-23

이 문서는 `@blog/shared` 패키지로 공통 request/response/error 계약을 옮길 때의
우선순위를 고정한다.

## Phase 1 Domains

다음 도메인을 먼저 shared contract로 통합한다.

1. translation
2. notifications
3. auth and session
4. user-facing content CRUD

## Why These Domains Go First

- translation: public query와 authenticated command가 함께 존재해 drift 비용이 크다.
- notifications: SSE payload와 durable inbox payload를 같은 envelope로 묶어야 한다.
- auth and session: worker와 backend 양쪽에 비슷한 surface가 있어 오류 포맷 차이가 크다.
- user-facing content CRUD: frontend service count가 많아 수동 parser 비용이 누적된다.

## Minimum Contract Surface

각 도메인은 아래를 shared package로 올린다.

- request schema
- success envelope
- error envelope
- enum error codes
- auth requirement metadata when needed
- pagination metadata when needed
