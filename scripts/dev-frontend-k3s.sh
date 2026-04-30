#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

VITE_DEV_PORT="${VITE_DEV_PORT:-8093}"
K3S_BACKEND_LOCAL_PORT="${K3S_BACKEND_LOCAL_PORT:-5081}"
SSH_HOST="${SSH_HOST:-blog}"
SSH_ADDRESS_FAMILY="${SSH_ADDRESS_FAMILY:-inet}"
K3S_NAMESPACE="${K3S_NAMESPACE:-blog}"
K3S_SECRET_NAME="${K3S_SECRET_NAME:-blog-app-secrets}"

export VITE_DEV_HOST="${VITE_DEV_HOST:-0.0.0.0}"
export VITE_DEV_PORT
export VITE_DEV_STRICT_PORT="${VITE_DEV_STRICT_PORT:-true}"
export VITE_BACKEND_PROXY_TARGET="${VITE_BACKEND_PROXY_TARGET:-http://127.0.0.1:${K3S_BACKEND_LOCAL_PORT}}"

# Route browser API calls through the Vite same-origin proxy to avoid production CORS constraints.
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://localhost:${VITE_DEV_PORT}}"
export API_BASE_URL="$VITE_API_BASE_URL"
export VITE_CHAT_BASE_URL="${VITE_CHAT_BASE_URL:-$VITE_API_BASE_URL}"
export CHAT_BASE_URL="$VITE_CHAT_BASE_URL"
export FEATURE_AI_ENABLED="${FEATURE_AI_ENABLED:-true}"
export FEATURE_RAG_ENABLED="${FEATURE_RAG_ENABLED:-true}"
export FEATURE_AI_INLINE="${FEATURE_AI_INLINE:-true}"
export FEATURE_COMMENTS_ENABLED="${FEATURE_COMMENTS_ENABLED:-true}"
export FEATURE_TERMINAL_ENABLED="${FEATURE_TERMINAL_ENABLED:-false}"
export FEATURE_CODE_EXECUTION_ENABLED="${FEATURE_CODE_EXECUTION_ENABLED:-false}"
export VITE_FEATURE_AI_ENABLED="${VITE_FEATURE_AI_ENABLED:-$FEATURE_AI_ENABLED}"
export VITE_FEATURE_RAG_ENABLED="${VITE_FEATURE_RAG_ENABLED:-$FEATURE_RAG_ENABLED}"
export VITE_FEATURE_AI_INLINE="${VITE_FEATURE_AI_INLINE:-$FEATURE_AI_INLINE}"
export VITE_FEATURE_COMMENTS_ENABLED="${VITE_FEATURE_COMMENTS_ENABLED:-$FEATURE_COMMENTS_ENABLED}"
export VITE_FEATURE_TERMINAL_ENABLED="${VITE_FEATURE_TERMINAL_ENABLED:-$FEATURE_TERMINAL_ENABLED}"
export VITE_FEATURE_CODE_EXECUTION_ENABLED="${VITE_FEATURE_CODE_EXECUTION_ENABLED:-$FEATURE_CODE_EXECUTION_ENABLED}"
export AI_DEFAULT_MODEL="${AI_DEFAULT_MODEL:-gpt-4.1}"
export VITE_AI_DEFAULT_MODEL="${VITE_AI_DEFAULT_MODEL:-$AI_DEFAULT_MODEL}"

read_k3s_secret_value() {
  local key="$1"
  local remote_secret_command
  remote_secret_command=$(printf \
    "kubectl -n %q get secret %q -o jsonpath='{.data.%s}' | base64 -d" \
    "$K3S_NAMESPACE" \
    "$K3S_SECRET_NAME" \
    "$key")
  ssh -o BatchMode=yes -o ConnectTimeout=8 -o AddressFamily="$SSH_ADDRESS_FAMILY" "$SSH_HOST" "$remote_secret_command" 2>/dev/null
}

if [[ -z "${BACKEND_PROXY_SIGNING_SECRET:-}" ]]; then
  if signing_secret=$(read_k3s_secret_value "GATEWAY_SIGNING_SECRET") &&
    [[ -n "$signing_secret" ]]; then
    export BACKEND_PROXY_SIGNING_SECRET="$signing_secret"
  else
    cat <<EOF
Warning: k3s GATEWAY_SIGNING_SECRET could not be read through ssh ${SSH_HOST}.
Protected backend routes may return 401 unless BACKEND_PROXY_SIGNING_SECRET is set.
EOF
  fi
fi

if [[ -z "${BACKEND_PROXY_BACKEND_KEY:-}" && -z "${BACKEND_KEY:-}" ]]; then
  if backend_key=$(read_k3s_secret_value "BACKEND_KEY") &&
    [[ -n "$backend_key" ]]; then
    export BACKEND_PROXY_BACKEND_KEY="$backend_key"
  else
    cat <<EOF
Warning: k3s BACKEND_KEY could not be read through ssh ${SSH_HOST}.
Protected backend routes may return 401 unless BACKEND_PROXY_BACKEND_KEY is set.
EOF
  fi
fi

if ! curl -fsS "${VITE_BACKEND_PROXY_TARGET}/api/v1/healthz" >/dev/null 2>&1; then
  cat <<EOF
Warning: k3s backend tunnel is not responding yet:
  ${VITE_BACKEND_PROXY_TARGET}/api/v1/healthz

Start it in another terminal:
  npm run k3s:backend:tunnel
EOF
fi

cat <<EOF
Starting frontend with k3s backend proxy.
  frontend: http://localhost:${VITE_DEV_PORT}
  proxy:    /api -> ${VITE_BACKEND_PROXY_TARGET}
  signing:  $([[ -n "${BACKEND_PROXY_SIGNING_SECRET:-}" ]] && echo enabled || echo disabled)
  backend:  $([[ -n "${BACKEND_PROXY_BACKEND_KEY:-}${BACKEND_KEY:-}" ]] && echo enabled || echo disabled)
EOF

cd "${repo_root}/frontend"
exec npm run dev
