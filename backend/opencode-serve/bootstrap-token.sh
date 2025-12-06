#!/bin/sh
# Auto-bootstrap token for auto-chat-proxy
# This script runs on container startup to automatically generate and persist a JWT token

set -e

TOKEN_FILE="${TOKEN_FILE:-/app/shared/auto-token.jwt}"
ADMIN_URL="${ADMIN_URL:-http://proxy-admin:7080}"
MAX_RETRIES="${MAX_RETRIES:-60}"
RETRY_INTERVAL="${RETRY_INTERVAL:-2}"

echo "[bootstrap] Starting token bootstrap..."
echo "[bootstrap] ADMIN_URL: $ADMIN_URL"
echo "[bootstrap] TOKEN_FILE: $TOKEN_FILE"

# Ensure directory exists
mkdir -p "$(dirname "$TOKEN_FILE")"

# Wait for proxy-admin to be ready
echo "[bootstrap] Waiting for proxy-admin to be ready..."
retries=0
until curl -sf "$ADMIN_URL/admin/health" > /dev/null 2>&1; do
  retries=$((retries + 1))
  if [ "$retries" -ge "$MAX_RETRIES" ]; then
    echo "[bootstrap] ERROR: proxy-admin not ready after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "[bootstrap] Attempt $retries/$MAX_RETRIES - waiting ${RETRY_INTERVAL}s..."
  sleep "$RETRY_INTERVAL"
done

echo "[bootstrap] proxy-admin is ready!"

# Check if token already exists and is valid
if [ -f "$TOKEN_FILE" ]; then
  EXISTING_TOKEN=$(cat "$TOKEN_FILE" 2>/dev/null || echo "")
  if [ -n "$EXISTING_TOKEN" ]; then
    # Validate token by making a test request
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $EXISTING_TOKEN" \
      "$ADMIN_URL/admin/config" 2>/dev/null || echo "000")
    
    if [ "$HTTP_CODE" = "200" ]; then
      echo "[bootstrap] Existing token is valid, skipping creation"
      exit 0
    else
      echo "[bootstrap] Existing token invalid (HTTP $HTTP_CODE), creating new one..."
    fi
  fi
fi

# Create bootstrap token (first token can be created without auth)
echo "[bootstrap] Creating new bootstrap token..."
RESPONSE=$(curl -sf -X POST "$ADMIN_URL/admin/token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "auto-chat-proxy-bootstrap",
    "scopes": ["proxy:invoke", "admin:*"],
    "ttlHours": 87600
  }' 2>&1) || {
  echo "[bootstrap] ERROR: Failed to create token"
  echo "[bootstrap] Response: $RESPONSE"
  exit 1
}

echo "[bootstrap] Token creation response received"

# Extract JWT from response
JWT=$(echo "$RESPONSE" | sed -n 's/.*"jwt":"\([^"]*\)".*/\1/p')

if [ -z "$JWT" ]; then
  echo "[bootstrap] ERROR: Could not extract JWT from response"
  echo "[bootstrap] Response: $RESPONSE"
  exit 1
fi

# Save token to file
echo "$JWT" > "$TOKEN_FILE"
chmod 600 "$TOKEN_FILE"

echo "[bootstrap] Token saved successfully to $TOKEN_FILE"
echo "[bootstrap] Token length: $(echo -n "$JWT" | wc -c) characters"
echo "[bootstrap] Bootstrap complete!"
