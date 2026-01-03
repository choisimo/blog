#!/bin/bash
# =============================================================================
# API Credentials Auto-Setup Script
# =============================================================================
# 배포 시 자동으로 JWT 토큰을 생성하고 n8n Credentials와 Workers에 주입
#
# Usage:
#   ./setup-api-credentials.sh [OPTIONS]
#
# Options:
#   --generate-token      JWT 토큰 생성 (Blog API 인증)
#   --setup-n8n          n8n Credentials 설정
#   --setup-workers      Cloudflare Workers secrets 설정
#   --rotate             토큰 로테이션 (새 토큰 생성 + 배포)
#   --all                모든 작업 수행
#
# Environment Variables Required:
#   ADMIN_USERNAME, ADMIN_PASSWORD - Blog API 관리자 계정
#   JWT_SECRET - JWT 서명 키 (토큰 검증용)
#   N8N_USER, N8N_PASS - n8n 관리자 계정
#   CLOUDFLARE_API_TOKEN - Cloudflare API 토큰
#
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
BLOG_API_URL="${BLOG_API_URL:-http://localhost:5080}"
N8N_URL="${N8N_URL:-http://localhost:5678}"
TOKEN_FILE="${TOKEN_FILE:-/tmp/blog-api-token.jwt}"
CREDENTIAL_NAME="${CREDENTIAL_NAME:-Blog API Auth}"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# JWT Token Generation
# =============================================================================
generate_token() {
    log_info "Generating JWT token from Blog API..."
    
    if [ -z "${ADMIN_USERNAME:-}" ] || [ -z "${ADMIN_PASSWORD:-}" ]; then
        log_error "ADMIN_USERNAME and ADMIN_PASSWORD are required"
        return 1
    fi
    
    # Wait for API to be ready
    local max_retries=30
    local retry=0
    while [ $retry -lt $max_retries ]; do
        if curl -sf "${BLOG_API_URL}/api/v1/healthz" > /dev/null 2>&1; then
            break
        fi
        retry=$((retry + 1))
        log_warn "Waiting for Blog API... ($retry/$max_retries)"
        sleep 2
    done
    
    if [ $retry -eq $max_retries ]; then
        log_error "Blog API not available at ${BLOG_API_URL}"
        return 1
    fi
    
    # Login and get token
    local response
    response=$(curl -sf "${BLOG_API_URL}/api/v1/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\": \"${ADMIN_USERNAME}\", \"password\": \"${ADMIN_PASSWORD}\"}" \
        2>/dev/null) || {
        log_error "Failed to authenticate with Blog API"
        return 1
    }
    
    local token
    token=$(echo "$response" | jq -r '.data.token // .token // empty')
    
    if [ -z "$token" ]; then
        log_error "Failed to extract token from response: $response"
        return 1
    fi
    
    # Save token
    echo "$token" > "$TOKEN_FILE"
    chmod 600 "$TOKEN_FILE"
    
    log_success "JWT token generated and saved to $TOKEN_FILE"
    echo "$token"
}

# =============================================================================
# n8n Credentials Setup
# =============================================================================
setup_n8n_credentials() {
    log_info "Setting up n8n Credentials..."
    
    local token="${1:-}"
    if [ -z "$token" ] && [ -f "$TOKEN_FILE" ]; then
        token=$(cat "$TOKEN_FILE")
    fi
    
    if [ -z "$token" ]; then
        log_error "No token provided. Run --generate-token first"
        return 1
    fi
    
    if [ -z "${N8N_USER:-}" ] || [ -z "${N8N_PASS:-}" ]; then
        log_error "N8N_USER and N8N_PASS are required"
        return 1
    fi
    
    # Wait for n8n to be ready
    local max_retries=30
    local retry=0
    while [ $retry -lt $max_retries ]; do
        if curl -sf "${N8N_URL}/healthz" > /dev/null 2>&1; then
            break
        fi
        retry=$((retry + 1))
        log_warn "Waiting for n8n... ($retry/$max_retries)"
        sleep 2
    done
    
    if [ $retry -eq $max_retries ]; then
        log_error "n8n not available at ${N8N_URL}"
        return 1
    fi
    
    # Check if credential already exists
    local existing
    existing=$(curl -sf "${N8N_URL}/api/v1/credentials" \
        -u "${N8N_USER}:${N8N_PASS}" \
        -H "Accept: application/json" \
        2>/dev/null | jq -r ".data[] | select(.name == \"${CREDENTIAL_NAME}\") | .id" 2>/dev/null || echo "")
    
    local credential_data
    credential_data=$(cat <<EOF
{
    "name": "${CREDENTIAL_NAME}",
    "type": "httpHeaderAuth",
    "data": {
        "name": "Authorization",
        "value": "Bearer ${token}"
    }
}
EOF
)
    
    if [ -n "$existing" ]; then
        log_info "Updating existing credential (ID: $existing)..."
        curl -sf "${N8N_URL}/api/v1/credentials/${existing}" \
            -X PATCH \
            -u "${N8N_USER}:${N8N_PASS}" \
            -H "Content-Type: application/json" \
            -d "$credential_data" > /dev/null 2>&1 || {
            log_warn "Failed to update credential, trying to create new one..."
            existing=""
        }
    fi
    
    if [ -z "$existing" ]; then
        log_info "Creating new credential..."
        curl -sf "${N8N_URL}/api/v1/credentials" \
            -X POST \
            -u "${N8N_USER}:${N8N_PASS}" \
            -H "Content-Type: application/json" \
            -d "$credential_data" > /dev/null 2>&1 || {
            log_error "Failed to create n8n credential"
            return 1
        }
    fi
    
    # Also create Buffer Zone API credential if BUFFER_ZONE_URL is set
    if [ -n "${BUFFER_ZONE_URL:-}" ]; then
        log_info "Setting up Buffer Zone API credential..."
        local buffer_cred
        buffer_cred=$(cat <<EOF
{
    "name": "Buffer Zone API Auth",
    "type": "httpHeaderAuth",
    "data": {
        "name": "Authorization",
        "value": "Bearer ${token}"
    }
}
EOF
)
        curl -sf "${N8N_URL}/api/v1/credentials" \
            -X POST \
            -u "${N8N_USER}:${N8N_PASS}" \
            -H "Content-Type: application/json" \
            -d "$buffer_cred" > /dev/null 2>&1 || log_warn "Buffer Zone credential may already exist"
    fi
    
    log_success "n8n Credentials configured successfully"
}

# =============================================================================
# Cloudflare Workers Secrets Setup
# =============================================================================
setup_workers_secrets() {
    log_info "Setting up Cloudflare Workers secrets..."
    
    local token="${1:-}"
    if [ -z "$token" ] && [ -f "$TOKEN_FILE" ]; then
        token=$(cat "$TOKEN_FILE")
    fi
    
    if [ -z "$token" ]; then
        log_error "No token provided. Run --generate-token first"
        return 1
    fi
    
    if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
        log_error "CLOUDFLARE_API_TOKEN is required"
        return 1
    fi
    
    local workers_dir="${WORKERS_DIR:-$(dirname "$0")/../../workers}"
    
    if [ ! -d "$workers_dir" ]; then
        log_warn "Workers directory not found at $workers_dir"
        return 0
    fi
    
    cd "$workers_dir"
    
    # API Gateway secrets
    if [ -d "api-gateway" ]; then
        log_info "Setting secrets for api-gateway..."
        echo "$token" | npx wrangler secret put BLOG_API_TOKEN --name blog-api-gateway 2>/dev/null || \
            log_warn "Failed to set BLOG_API_TOKEN for api-gateway"
        
        if [ -n "${JWT_SECRET:-}" ]; then
            echo "${JWT_SECRET}" | npx wrangler secret put JWT_SECRET --name blog-api-gateway 2>/dev/null || \
                log_warn "Failed to set JWT_SECRET for api-gateway"
        fi
    fi
    
    log_success "Cloudflare Workers secrets configured"
}

# =============================================================================
# Token Rotation
# =============================================================================
rotate_token() {
    log_info "Starting token rotation..."
    
    # Generate new token
    local new_token
    new_token=$(generate_token) || return 1
    
    # Update all services
    setup_n8n_credentials "$new_token" || log_warn "Failed to update n8n credentials"
    setup_workers_secrets "$new_token" || log_warn "Failed to update workers secrets"
    
    log_success "Token rotation completed"
    echo "New token: ${new_token:0:20}..."
}

# =============================================================================
# Full Setup
# =============================================================================
setup_all() {
    log_info "Running full credentials setup..."
    
    local token
    token=$(generate_token) || return 1
    
    setup_n8n_credentials "$token" || log_warn "n8n setup failed (may not be running)"
    setup_workers_secrets "$token" || log_warn "Workers setup failed (may need manual setup)"
    
    log_success "Full credentials setup completed"
}

# =============================================================================
# Health Check
# =============================================================================
check_services() {
    log_info "Checking service availability..."
    
    echo ""
    echo "=== Service Status ==="
    
    # Blog API
    if curl -sf "${BLOG_API_URL}/api/v1/healthz" > /dev/null 2>&1; then
        echo -e "Blog API:    ${GREEN}OK${NC} (${BLOG_API_URL})"
    else
        echo -e "Blog API:    ${RED}UNAVAILABLE${NC} (${BLOG_API_URL})"
    fi
    
    # n8n
    if curl -sf "${N8N_URL}/healthz" > /dev/null 2>&1; then
        echo -e "n8n:         ${GREEN}OK${NC} (${N8N_URL})"
    else
        echo -e "n8n:         ${RED}UNAVAILABLE${NC} (${N8N_URL})"
    fi
    
    # Token status
    if [ -f "$TOKEN_FILE" ]; then
        local token_age
        token_age=$(( $(date +%s) - $(stat -c %Y "$TOKEN_FILE" 2>/dev/null || stat -f %m "$TOKEN_FILE" 2>/dev/null || echo 0) ))
        echo -e "Token:       ${GREEN}EXISTS${NC} (age: ${token_age}s)"
    else
        echo -e "Token:       ${YELLOW}NOT GENERATED${NC}"
    fi
    
    echo ""
}

# =============================================================================
# Main
# =============================================================================
print_help() {
    cat << EOF
API Credentials Auto-Setup Script

Usage: $0 [OPTIONS]

Options:
    --generate-token    Generate JWT token from Blog API
    --setup-n8n         Configure n8n HTTP Header Auth credential
    --setup-workers     Configure Cloudflare Workers secrets
    --rotate            Rotate token (generate new + update all)
    --all               Full setup (generate + n8n + workers)
    --check             Check service availability
    --help              Show this help message

Environment Variables:
    ADMIN_USERNAME      Blog API admin username
    ADMIN_PASSWORD      Blog API admin password
    JWT_SECRET          JWT signing secret
    N8N_USER            n8n admin username
    N8N_PASS            n8n admin password
    CLOUDFLARE_API_TOKEN Cloudflare API token
    BLOG_API_URL        Blog API URL (default: http://localhost:5080)
    N8N_URL             n8n URL (default: http://localhost:5678)

Examples:
    # Full automatic setup
    export ADMIN_USERNAME=admin ADMIN_PASSWORD=secret
    export N8N_USER=admin N8N_PASS=secret
    $0 --all

    # Token rotation
    $0 --rotate

    # Check status
    $0 --check
EOF
}

case "${1:-}" in
    --generate-token|-g)
        generate_token
        ;;
    --setup-n8n|-n)
        setup_n8n_credentials "${2:-}"
        ;;
    --setup-workers|-w)
        setup_workers_secrets "${2:-}"
        ;;
    --rotate|-r)
        rotate_token
        ;;
    --all|-a)
        setup_all
        ;;
    --check|-c)
        check_services
        ;;
    --help|-h|"")
        print_help
        ;;
    *)
        log_error "Unknown option: $1"
        print_help
        exit 1
        ;;
esac
