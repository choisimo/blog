#!/bin/sh
# Install language runtimes into the Piston container after first start.
# Run once after `docker compose up -d piston`.
#
# Usage:
#   ./scripts/setup-piston-runtimes.sh
#
# Packages installed match the LANGUAGE_OPTIONS in frontend/src/components/features/sentio/CodeIDE.tsx

set -e

PISTON_URL="http://localhost:2000"

wait_for_piston() {
  echo "Waiting for Piston to be ready..."
  for i in $(seq 1 30); do
    if wget -q --spider "${PISTON_URL}/api/v2/runtimes" 2>/dev/null; then
      echo "Piston is ready."
      return 0
    fi
    sleep 2
  done
  echo "ERROR: Piston did not become ready in 60s" >&2
  exit 1
}

install_runtime() {
  LANG="$1"
  VERSION="$2"
  echo "Installing ${LANG} ${VERSION}..."
  docker exec blog-piston ppman install "${LANG}=${VERSION}" || \
    docker exec blog-piston ppman install "${LANG}"
}

wait_for_piston

install_runtime python 3.10.0
install_runtime javascript 18.15.0
install_runtime typescript 5.0.3
install_runtime java 15.0.2
install_runtime c++ 10.2.0
install_runtime c 10.2.0

echo ""
echo "Runtime installation complete. Verifying..."
curl -sf "${PISTON_URL}/api/v2/runtimes" | grep -o '"language":"[^"]*"' | sort
echo ""
echo "Done."
