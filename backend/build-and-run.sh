#!/bin/bash

# =============================================================================
# Blog Backend Full Stack - Build and Run Script
# =============================================================================
#
# This script:
# 1. Creates .env from .env.full.example
# 2. Copies n8n-workflows
# 3. Builds and starts all services
# 4. Imports n8n workflows
# 5. Verifies all services are running
#
# Usage: ./build-and-run.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}"
N8N_WORKFLOWS_DIR="${BACKEND_DIR}/n8n-workflows"
ENV_EXAMPLE="${BACKEND_DIR}/.env.full.example"
ENV_FILE="${BACKEND_DIR}/.env"
DOCKER_COMPOSE="docker-compose.full.yml"
NGINX_CONF="nginx-full.conf"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# =============================================================================
# Functions
# =============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# =============================================================================
# Check prerequisites
# =============================================================================

if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    log_error "Docker Compose is not installed. Please install Docker Compose v2."
    exit 1
fi

# =============================================================================
# Step 1: Create .env file
# =============================================================================

if [ ! -f "${ENV_FILE}" ]; then
    log_info "Creating .env from .env.full.example..."
    cp "${ENV_EXAMPLE}" "${ENV_FILE}"
    log_warn "Please edit .env and update your API keys and passwords!"
    log_warn "After updating, run this script again."
    exit 0
else
    log_info ".env file already exists, skipping..."
fi

# =============================================================================
# Step 2: Check n8n-workflows directory
# =============================================================================

if [ ! -d "${N8N_WORKFLOWS_DIR}" ]; then
    log_error "n8n-workflows directory not found at ${N8N_WORKFLOWS_DIR}"
    exit 1
fi

WORKFLOW_COUNT=$(ls -1 ${N8N_WORKFLOWS_DIR}/*.json 2>/dev/null | wc -l)
log_info "Found ${WORKFLOW_COUNT} workflow files in n8n-workflows/"

# =============================================================================
# Step 3: Check nginx.conf
# =============================================================================

if [ ! -f "${BACKEND_DIR}/${NGINX_CONF}" ]; then
    log_error "nginx-full.conf not found at ${BACKEND_DIR}/${NGINX_CONF}"
    exit 1
fi

# =============================================================================
# Step 4: Check opencode-serve path
# =============================================================================

OPENCODE_PATH=$(grep "OPENCODE_SERVE_PATH" "${ENV_FILE}" | cut -d'=' -f2)
if [ ! -d "${OPENCODE_PATH}" ]; then
    log_warn "opencode-serve path not found: ${OPENCODE_PATH}"
    log_warn "Using relative path for ai-engine build..."
    sed -i 's|^OPENCODE_SERVE_PATH=.*$|OPENCODE_SERVE_PATH=../secret-documentations/opencode-serve|' "${ENV_FILE}"
fi

# =============================================================================
# Step 5: Build services
# =============================================================================

log_info "Building Docker images..."
docker compose -f "${BACKEND_DIR}/${DOCKER_COMPOSE}" build

# =============================================================================
# Step 6: Start services
# =============================================================================

log_info "Starting services..."
docker compose -f "${BACKEND_DIR}/${DOCKER_COMPOSE}" up -d

# =============================================================================
# Step 7: Wait for services to be healthy
# =============================================================================

log_info "Waiting for services to be ready..."

# Wait for postgres
log_info "  - Waiting for PostgreSQL..."
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if docker compose -f "${BACKEND_DIR}/${DOCKER_COMPOSE}" exec -T postgres pg_isready -U n8n >/dev/null 2>&1; then
        break
    fi
    RETRY=$((RETRY+1))
    echo -n "."
    sleep 2
done
echo ""

if [ $RETRY -eq $MAX_RETRIES ]; then
    log_error "PostgreSQL failed to start"
    exit 1
fi

# Wait for redis
log_info "  - Waiting for Redis..."
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if docker compose -f "${BACKEND_DIR}/${DOCKER_COMPOSE}" exec -T redis redis-cli -a redis_password ping >/dev/null 2>&1; then
        break
    fi
    RETRY=$((RETRY+1))
    echo -n "."
    sleep 2
done
echo ""

# Wait for n8n
log_info "  - Waiting for n8n..."
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -sf http://localhost:5678/healthz >/dev/null 2>&1; then
        break
    fi
    RETRY=$((RETRY+1))
    echo -n "."
    sleep 2
done
echo ""

# Wait for API
log_info "  - Waiting for Blog API..."
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -sf http://localhost:8080/api/v1/healthz >/dev/null 2>&1; then
        break
    fi
    RETRY=$((RETRY+1))
    echo -n "."
    sleep 2
done
echo ""

# =============================================================================
# Step 8: Import n8n workflows
# =============================================================================

log_info "Importing n8n workflows..."
docker compose -f "${BACKEND_DIR}/${DOCKER_COMPOSE}" run --rm workflow-import

# =============================================================================
# Step 9: Verify services
# =============================================================================

log_info "Verifying services..."

echo ""
echo "========================================"
echo "  Service Status"
echo "========================================"
docker compose -f "${BACKEND_DIR}/${DOCKER_COMPOSE}" ps

# =============================================================================
# Step 10: Display access URLs
# =============================================================================

echo ""
echo "========================================"
echo "  Access URLs"
echo "========================================"
echo ""
echo "  Blog API:"
echo "    http://localhost:8080/api/v1/healthz"
echo ""
echo "  n8n Dashboard:"
echo "    http://localhost:5678"
echo "    Username: $(grep 'N8N_USER' "${ENV_FILE}" | cut -d'=' -f2)"
echo "    Password: $(grep 'N8N_PASS' "${ENV_FILE}" | cut -d'=' -f2)"
echo ""
echo "  AI Admin (Buffer Zone):"
echo "    http://localhost:7080"
echo "    Email: $(grep 'ADMIN_EMAIL' "${ENV_FILE}" | cut -d'=' -f2)"
echo "    Password: $(grep 'ADMIN_PASSWORD' "${ENV_FILE}" | cut -d'=' -f2)"
echo ""
echo "  ChromaDB:"
echo "    http://localhost:8100"
echo ""
echo "  Embedding Server:"
echo "    http://localhost:8180"
echo ""

# =============================================================================
# Step 11: Test workflows
# =============================================================================

log_info "Testing workflow endpoints..."

echo ""
echo "Testing /webhook/ai/health..."
HEALTH_RESPONSE=$(curl -sf http://localhost:5678/webhook/ai/health 2>/dev/null || echo "ERROR")
if [ "$HEALTH_RESPONSE" != "ERROR" ]; then
    echo -e "${GREEN}  ✓${NC} AI Health webhook is working"
else
    log_error "  ✗ AI Health webhook failed"
fi

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
log_info "To stop services: docker compose -f ${DOCKER_COMPOSE} down"
log_info "To view logs: docker compose -f ${DOCKER_COMPOSE} logs -f [service-name]"
echo ""
