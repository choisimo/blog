#!/usr/bin/env bash
# =============================================================================
# Server Setup Script - Run on PMX-102-1 Server
# =============================================================================
# This script updates the TEI server configuration and sets up API keys
# for Perplexity and Tavily AI search integration.
#
# Usage:
#   ssh user@server
#   bash server-rag-setup.sh
# =============================================================================

set -euo pipefail

echo "============================================="
echo "   Blog Server RAG & AI Search Setup"
echo "============================================="
echo ""

# Configuration
COMPOSE_DIR="${HOME}/blog-stack"
BACKEND_ENV="${COMPOSE_DIR}/.env"

# Check if we're in the right place
if [ ! -f "${COMPOSE_DIR}/docker-compose.yml" ]; then
    echo "ERROR: docker-compose.yml not found in ${COMPOSE_DIR}"
    echo "Please update COMPOSE_DIR variable to point to your blog stack directory."
    exit 1
fi

cd "${COMPOSE_DIR}"

# =============================================================================
# Step 1: Pull latest docker-compose.yml changes
# =============================================================================
echo "[1/4] Pulling latest changes from git..."
git pull origin main || echo "WARN: Could not pull from git. Manual update may be needed."

# =============================================================================
# Step 2: Add API keys to .env (if not already present)
# =============================================================================
echo ""
echo "[2/4] Checking API keys in .env..."

# Perplexity API Key
if grep -q "PERPLEXITY_API_KEY" "$BACKEND_ENV" 2>/dev/null; then
    echo "  - PERPLEXITY_API_KEY already exists"
else
    echo "  - Adding PERPLEXITY_API_KEY"
    echo "" >> "$BACKEND_ENV"
    echo "# AI Search Providers (added by setup script)" >> "$BACKEND_ENV"
    echo "PERPLEXITY_API_KEY=pplx-YOUR_API_KEY_HERE" >> "$BACKEND_ENV"
    echo "  - WARN: Please update PERPLEXITY_API_KEY with your actual key"
fi

# Tavily API Key
if grep -q "TAVILY_API_KEY" "$BACKEND_ENV" 2>/dev/null; then
    echo "  - TAVILY_API_KEY already exists"
else
    echo "  - Adding TAVILY_API_KEY"
    echo "TAVILY_API_KEY=tvly-YOUR_API_KEY_HERE" >> "$BACKEND_ENV"
    echo "  - WARN: Please update TAVILY_API_KEY with your actual key"
fi

# =============================================================================
# Step 3: Restart TEI Embedding Server with new configuration
# =============================================================================
echo ""
echo "[3/4] Restarting TEI Embedding Server..."

DC="docker compose"
if ! $DC version >/dev/null 2>&1; then 
    DC="docker-compose"
fi

# Pull latest images
$DC pull embedding-server

# Restart embedding server
$DC up -d embedding-server

# Wait for health check
echo "  - Waiting for TEI server to be healthy..."
for i in {1..30}; do
    if $DC exec -T embedding-server curl -sf http://localhost:80/health >/dev/null 2>&1; then
        echo "  - TEI server is healthy!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "  - WARN: TEI server health check timeout. Check logs with: $DC logs embedding-server"
    fi
    sleep 2
done

# =============================================================================
# Step 4: Restart Backend API to pick up new env vars
# =============================================================================
echo ""
echo "[4/4] Restarting Backend API..."
$DC up -d api

# Wait for health check
echo "  - Waiting for API server to be healthy..."
for i in {1..20}; do
    if $DC exec -T api wget -q --spider http://localhost:5080/api/v1/healthz 2>/dev/null; then
        echo "  - API server is healthy!"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "  - WARN: API server health check timeout. Check logs with: $DC logs api"
    fi
    sleep 2
done

# =============================================================================
# Verification
# =============================================================================
echo ""
echo "============================================="
echo "   Verification"
echo "============================================="

# Check TEI max-input-length
echo ""
echo "TEI Server Configuration:"
$DC exec -T embedding-server cat /proc/1/cmdline 2>/dev/null | tr '\0' ' ' | grep -o -- '--max-input-length [0-9]*' || echo "  - Could not verify TEI config"

# Check service status
echo ""
echo "Service Status:"
$DC ps | grep -E "(embedding|api|chromadb)" || true

# =============================================================================
# Next Steps
# =============================================================================
echo ""
echo "============================================="
echo "   Next Steps"
echo "============================================="
echo ""
echo "1. Update API keys in ${BACKEND_ENV}:"
echo "   - PERPLEXITY_API_KEY=pplx-YOUR_ACTUAL_KEY"
echo "   - TAVILY_API_KEY=tvly-YOUR_ACTUAL_KEY"
echo ""
echo "2. Restart API after updating keys:"
echo "   $DC restart api"
echo ""
echo "3. Run RAG indexing:"
echo "   gh workflow run rag-index.yml --repo choisimo/blog"
echo "   OR"
echo "   python3 scripts/rag/index_via_api.py"
echo ""
echo "4. Verify RAG indexing:"
echo "   curl https://blog-b.nodove.com/api/v1/rag/status"
echo ""
echo "Setup complete!"
