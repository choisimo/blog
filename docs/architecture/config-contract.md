# Platform Config Contract

분산되어 있던 dotenv, Consul, wrangler secret, k3s Secret/ConfigMap, GitHub Secrets 항목을 하나의 계약으로 정리했습니다.

## Canonical contract

- `shared/src/contracts/platform-config.js`

## Key alignment

핵심 통합 항목:

- `BACKEND_KEY`
- `JWT_SECRET`
- `TERMINAL_SESSION_SECRET`
- `TERMINAL_CONNECT_TOKEN_TTL_SECONDS`
- `TERMINAL_SESSION_TIMEOUT_MS`
- `TERMINAL_BLOCKED_COUNTRIES`
- `REDIS_URL`
- `REDIS_PASSWORD`
- `BACKEND_ORIGIN`
- `TERMINAL_ORIGIN`

## Examples updated

- `backend/.env.example`
- `.gh_env.example`
- `k3s/configmap.yaml`
- `k3s/secret-example.yaml`
