# Release Rollback Runbook

이 문서는 `Preflight -> Launchable -> Committed` 전환 중 고객 영향이 확인될 때
`Committed -> Rollback`을 실행하기 위한 절차입니다. destructive DB rollback은 기본값이
아니며, 먼저 이전 code target으로 되돌릴 수 있는지 확인합니다.

## Release Record

출시 전에 아래 값을 release ticket에 기록합니다.

| Field                                              | Value |
| -------------------------------------------------- | ----- |
| Release commit SHA                                 |       |
| Previous stable commit SHA                         |       |
| `blog-api` previous image tag or digest            |       |
| `ai-worker` previous image tag or digest           |       |
| Cloudflare Worker current deployment or version ID |       |
| Cloudflare Worker previous stable version ID       |       |
| GitHub Pages previous deploy artifact or commit    |       |
| D1 migration max version before deploy             |       |
| D1 migration max version after deploy              |       |

## Rollback Triggers

하나라도 충족하면 신규 배포를 멈추고 rollback을 시작합니다.

| Trigger           | Condition                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| Backend readiness | `/api/v1/readiness`가 2회 연속 503이거나 5분 이상 degraded                                           |
| Gateway auth      | `MISSING_GATEWAY_SIGNATURE` 또는 `INVALID_GATEWAY_SIGNATURE` 401이 backend-owned route에서 지속 증가 |
| Worker proxy      | Worker proxy `502`, `503`, `504`가 5분 이상 지속                                                     |
| D1 schema         | Worker log에 `no such column` 또는 `no such table` 발생                                              |
| Auth/session      | login, session create, session recover 핵심 smoke 실패                                               |
| Outbox            | `domain_outbox.deadLetter > 0` 또는 stuck event 지속 증가                                            |
| AI queue          | `ai_task_dlq_length > 0` 또는 queue length가 drain되지 않음                                          |
| Smoke             | public config, posts, auth/session, AI generate, analytics view 중 핵심 시나리오 실패                |

## Freeze

1. release owner 1명이 incident lead를 맡고, 추가 deploy를 중단합니다.
2. Argo CD Application의 auto-sync와 Image Updater가 rollback target을 다시 덮어쓰지 않도록 일시 정지합니다.
3. failing SHA, previous stable SHA, current Worker deployment/version ID, previous Worker version ID를 ticket에 기록합니다.
4. 현재 증상에서 첫 신호를 고정합니다: gateway 401, D1 schema error, readiness 503, Worker 5xx, auth/session failure 중 하나입니다.

## Worker Rollback

Cloudflare Workers는 previous version으로 rollback하면 새 active deployment를 만듭니다. Cloudflare 문서 기준으로 Wrangler `rollback` 또는 dashboard의 Worker Deployments 화면을 사용합니다.

```bash
cd workers/api-gateway
npx wrangler deployments list --env production
npx wrangler rollback <previous-worker-version-id> --env production --message "rollback: <release-sha> to <previous-stable-sha>"
```

검증:

```bash
curl -fsS https://api.nodove.com/_health
curl -fsS https://api.nodove.com/healthz
curl -fsS https://api.nodove.com/api/v1/public/config
```

backend-owned route smoke를 1개 이상 실행하고 backend log에서 gateway signature 401이 멈췄는지 확인합니다.

## Backend And k3s Rollback

1. Argo CD auto-sync와 Image Updater가 정지되어 있는지 확인합니다.
2. `api`와 `ai-worker` image를 previous stable SHA tag 또는 digest로 되돌립니다.
3. `latest` tag를 rollback target으로 사용하지 않습니다.
4. apply 후 rollout과 readiness를 확인합니다.

```bash
kubectl -n blog set image deploy/api api=ghcr.io/choisimo/blog-api:<previous-stable-sha>
kubectl -n blog set image deploy/ai-worker ai-worker=ghcr.io/choisimo/blog-api:<previous-stable-sha>
kubectl -n blog rollout status deploy/api
kubectl -n blog rollout status deploy/ai-worker
curl -fsS https://api.nodove.com/api/v1/readiness
```

Argo CD로 GitOps rollback을 수행하는 경우, k3s manifest가 previous stable image target을 가리키는 commit을 먼저 만들고 sync합니다.

## Frontend Rollback

1. previous GitHub Pages artifact 또는 previous stable commit을 redeploy합니다.
2. `runtime-config.json`의 API base URL이 rollback target과 맞는지 확인합니다.
3. browser smoke: home, posts list/detail, auth/session, AI entry를 확인합니다.

## DB And Data Safety

1. D1/Postgres migration은 즉시 destructive rollback하지 않습니다.
2. 이전 code가 새 schema와 forward-compatible하면 schema는 유지합니다.
3. 이전 code가 새 schema 때문에 실패하면 feature flag disable 또는 compatibility patch를 먼저 적용합니다.
4. idempotency/outbox table은 삭제하지 않습니다. stuck/processing record만 별도 runbook 기준으로 release 또는 dead-letter 처리합니다.

## Post-Rollback Verification

| Area      | Check                                                   |
| --------- | ------------------------------------------------------- |
| Edge      | `/_health`, `/healthz`, `/api/v1/public/config` 200     |
| Origin    | `/api/v1/readiness` 200 and `status=ready`              |
| Auth      | login/session create/recover smoke pass                 |
| Content   | posts list/detail smoke pass                            |
| AI        | generate or queue smoke pass, depending on feature flag |
| Analytics | view record and editor picks read smoke pass            |
| Logs      | no gateway signature 401 spike, no D1 schema errors     |
| Metrics   | 5xx rate and p95 latency return to baseline             |

## Relaunch Gate

재배포는 아래가 충족될 때만 허용합니다.

1. rollback target이 stable 상태로 15분 이상 유지됩니다.
2. root cause가 `must-fix-before-launch` 항목으로 문서화됩니다.
3. affected secret, migration, image target, or feature flag contract가 CI 또는 deploy gate로 보강됩니다.
4. smoke와 CI evidence가 release ticket에 링크됩니다.

## References

- Cloudflare Workers rollback docs: https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/
- Wrangler Worker commands: https://developers.cloudflare.com/workers/wrangler/commands/workers/#rollback
