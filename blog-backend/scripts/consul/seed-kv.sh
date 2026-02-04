#!/bin/bash
set -e

CONSUL_ADDR="${CONSUL_HTTP_ADDR:-http://localhost:8500}"
PREFIX="blog"

echo "🔧 Seeding Consul KV Store..."
echo "   Consul Address: ${CONSUL_ADDR}"
echo ""

wait_for_consul() {
  echo "⏳ Waiting for Consul to be ready..."
  until curl -s "${CONSUL_ADDR}/v1/status/leader" | grep -q .; do
    sleep 1
  done
  echo "✅ Consul is ready"
}

put_kv() {
  local key="$1"
  local value="$2"
  curl -s -X PUT -d "${value}" "${CONSUL_ADDR}/v1/kv/${PREFIX}/${key}" > /dev/null
  echo "   ✓ ${PREFIX}/${key}"
}

put_kv_file() {
  local key="$1"
  local file="$2"
  curl -s -X PUT --data-binary "@${file}" "${CONSUL_ADDR}/v1/kv/${PREFIX}/${key}" > /dev/null
  echo "   ✓ ${PREFIX}/${key} (from ${file})"
}

wait_for_consul

echo ""
echo "📝 Global Configuration..."
put_kv "config/env" "production"

echo ""
echo "🌐 Domain Configuration..."
put_kv "config/domains/frontend" "https://noblog.nodove.com"
put_kv "config/domains/api" "https://api.nodove.com"
put_kv "config/domains/assets" "https://assets-b.nodove.com"
put_kv "config/domains/terminal" "https://terminal.nodove.com"

echo ""
echo "🔗 Service Endpoints..."
put_kv "services/backend/url" "http://backend:5080"
put_kv "services/backend/health_path" "/api/v1/healthz"
put_kv "services/backend/timeout" "30000"

put_kv "services/ai-gateway/url" "http://ai-gateway:7000"
put_kv "services/ai-gateway/health_path" "/health"
put_kv "services/ai-gateway/timeout" "120000"

put_kv "services/ai-backend/url" "http://ai-server-backend:7016"
put_kv "services/ai-backend/openai_compat_path" "/v1"

put_kv "services/ai-serve/url" "http://ai-server-serve:7012"
put_kv "services/ai-serve/health_path" "/health"

put_kv "services/chromadb/url" "http://chromadb:8000"
put_kv "services/chromadb/collection" "blog-posts-all-MiniLM-L6-v2"
put_kv "services/chromadb/health_path" "/api/v1/heartbeat"

put_kv "services/embedding/url" "https://api.openai.com/v1"
put_kv "services/embedding/api_key" ""
put_kv "services/embedding/model" "text-embedding-3-small"

put_kv "services/redis/url" "redis://redis:6379"
put_kv "services/redis/db" "0"

put_kv "services/postgres/host" "postgres"
put_kv "services/postgres/port" "5432"
put_kv "services/postgres/database" "blog"

put_kv "services/terminal/url" "http://terminal:8080"
put_kv "services/terminal/origin" "https://terminal-origin.nodove.com"

echo ""
echo "📄 Complex Configuration (JSON)..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
put_kv_file "config/cors/allowed_origins" "${SCRIPT_DIR}/../consul/data/cors-origins.json"

echo ""
echo "🚀 Feature Flags..."
put_kv "config/features/ai_enabled" "true"
put_kv "config/features/rag_enabled" "true"
put_kv "config/features/terminal_enabled" "true"
put_kv "config/features/ai_inline" "true"
put_kv "config/features/comments_enabled" "true"

echo ""
echo "✅ Consul KV seeding complete!"
echo ""
echo "📊 View in Consul UI: ${CONSUL_ADDR}/ui/blog-dc/kv/${PREFIX}/"
