#!/usr/bin/env bash
set -euo pipefail

SSH_HOST="${SSH_HOST:-blog}"
SSH_ADDRESS_FAMILY="${SSH_ADDRESS_FAMILY:-inet}"
K3S_NAMESPACE="${K3S_NAMESPACE:-blog}"
K3S_BACKEND_SERVICE="${K3S_BACKEND_SERVICE:-api}"
K3S_BACKEND_REMOTE_PORT="${K3S_BACKEND_REMOTE_PORT:-5080}"
K3S_BACKEND_LOCAL_PORT="${K3S_BACKEND_LOCAL_PORT:-5081}"
K3S_BACKEND_REMOTE_BIND="${K3S_BACKEND_REMOTE_BIND:-127.0.0.1}"
K3S_BACKEND_LOCAL_BIND="${K3S_BACKEND_LOCAL_BIND:-127.0.0.1}"
K3S_TUNNEL_MODE="${K3S_TUNNEL_MODE:-stdio}"
REMOTE_PID_FILE="/tmp/blog-api-port-forward-${K3S_BACKEND_LOCAL_PORT}.pid"
REMOTE_LOG_FILE="/tmp/blog-api-port-forward-${K3S_BACKEND_LOCAL_PORT}.log"

remote_command=$(printf \
  'kubectl -n %q port-forward --address %q svc/%q %q' \
  "$K3S_NAMESPACE" \
  "$K3S_BACKEND_REMOTE_BIND" \
  "$K3S_BACKEND_SERVICE" \
  "${K3S_BACKEND_LOCAL_PORT}:${K3S_BACKEND_REMOTE_PORT}")

remote_start_command=$(cat <<EOF
set -e
if nc -z '${K3S_BACKEND_REMOTE_BIND}' '${K3S_BACKEND_LOCAL_PORT}' >/dev/null 2>&1; then
  exit 0
fi
if [ -f '${REMOTE_PID_FILE}' ]; then
  kill "\$(cat '${REMOTE_PID_FILE}')" 2>/dev/null || true
  rm -f '${REMOTE_PID_FILE}'
fi
nohup ${remote_command} >'${REMOTE_LOG_FILE}' 2>&1 &
echo \$! >'${REMOTE_PID_FILE}'
sleep 1
if ! nc -z '${K3S_BACKEND_REMOTE_BIND}' '${K3S_BACKEND_LOCAL_PORT}' >/dev/null 2>&1; then
  cat '${REMOTE_LOG_FILE}' >&2 2>/dev/null || true
  exit 1
fi
EOF
)

remote_stop_command=$(cat <<EOF
if [ -f '${REMOTE_PID_FILE}' ]; then
  kill "\$(cat '${REMOTE_PID_FILE}')" 2>/dev/null || true
  rm -f '${REMOTE_PID_FILE}'
fi
EOF
)

cleanup_remote_port_forward() {
  if [[ "$K3S_TUNNEL_MODE" == "stdio" ]]; then
    ssh -o BatchMode=yes -o ConnectTimeout=8 -o AddressFamily="${SSH_ADDRESS_FAMILY}" "$SSH_HOST" "$remote_stop_command" >/dev/null 2>&1 || true
  fi
}

cat <<EOF
Opening k3s backend tunnel.
  ssh host:      ${SSH_HOST}
  k3s service:   ${K3S_NAMESPACE}/${K3S_BACKEND_SERVICE}:${K3S_BACKEND_REMOTE_PORT}
  local backend: http://${K3S_BACKEND_LOCAL_BIND}:${K3S_BACKEND_LOCAL_PORT}
  health check:  http://${K3S_BACKEND_LOCAL_BIND}:${K3S_BACKEND_LOCAL_PORT}/api/v1/healthz
  mode:          ${K3S_TUNNEL_MODE}

Keep this terminal open while using the local frontend.
EOF

if [[ "$K3S_TUNNEL_MODE" == "stdio" ]]; then
  command -v socat >/dev/null || {
    echo "socat is required for K3S_TUNNEL_MODE=stdio" >&2
    exit 1
  }

  trap cleanup_remote_port_forward EXIT
  ssh -o BatchMode=yes -o ConnectTimeout=8 -o AddressFamily="${SSH_ADDRESS_FAMILY}" "$SSH_HOST" "$remote_start_command"

  exec socat \
    "TCP-LISTEN:${K3S_BACKEND_LOCAL_PORT},bind=${K3S_BACKEND_LOCAL_BIND},reuseaddr,fork" \
    "EXEC:ssh -o BatchMode=yes -o ConnectTimeout=8 -o AddressFamily=${SSH_ADDRESS_FAMILY} ${SSH_HOST} nc ${K3S_BACKEND_REMOTE_BIND} ${K3S_BACKEND_LOCAL_PORT}"
fi

exec ssh \
  -o ExitOnForwardFailure=yes \
  -o AddressFamily="${SSH_ADDRESS_FAMILY}" \
  -L "${K3S_BACKEND_LOCAL_PORT}:${K3S_BACKEND_REMOTE_BIND}:${K3S_BACKEND_LOCAL_PORT}" \
  "$SSH_HOST" \
  "$remote_command"
