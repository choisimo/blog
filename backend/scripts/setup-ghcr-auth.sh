#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../../.env"
if [[ ! -f "$ENV_FILE" ]]; then
  ENV_FILE="${SCRIPT_DIR}/../.env"
fi

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi

GHCR_USER="${GITHUB_REPOSITORY_OWNER:-}"
GHCR_PAT="${GHCR_TOKEN:-}"

if [[ -z "$GHCR_USER" || -z "$GHCR_PAT" ]]; then
  echo "ERROR: GITHUB_REPOSITORY_OWNER and GHCR_TOKEN must be set in .env or environment." >&2
  echo "       GHCR_TOKEN must have the 'read:packages' scope." >&2
  exit 1
fi

echo "Logging into ghcr.io as ${GHCR_USER} ..."
echo "$GHCR_PAT" | docker login ghcr.io -u "$GHCR_USER" --password-stdin

echo ""
echo "Credentials written to ${HOME}/.docker/config.json"
echo ""
echo "Next step: docker compose up -d watchtower"
echo ""
echo "Manual update trigger:"
echo "  curl -sS -X POST \\"
echo "    -H \"Authorization: Bearer \${WATCHTOWER_API_TOKEN}\" \\"
echo "    http://localhost:8080/v1/update"
