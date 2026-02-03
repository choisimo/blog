#!/bin/bash
# =============================================================================
# Cloudflare Wrangler Secrets 일괄 등록 스크립트
# =============================================================================
# 사용법:
#   ./scripts/upload-wrangler-secrets.sh api-gateway      # API Gateway secrets
#   ./scripts/upload-wrangler-secrets.sh r2-gateway       # R2 Gateway secrets
#   ./scripts/upload-wrangler-secrets.sh terminal-gateway # Terminal Gateway secrets
#   ./scripts/upload-wrangler-secrets.sh all              # 전체 Workers secrets
#   ./scripts/upload-wrangler-secrets.sh list <worker>    # 현재 secrets 목록
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_section() { echo -e "\n${BLUE}=== $1 ===${NC}"; }

ENV_FILE=".env.wrangler.local"
WRANGLER_ENV="${WRANGLER_ENV:-production}"

# Wrangler CLI 확인
if ! command -v wrangler &> /dev/null; then
    log_error "Wrangler CLI is not installed. Install it: npm i -g wrangler"
    exit 1
fi

# .env.wrangler.local 파일 확인
check_env_file() {
    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "File not found: $ENV_FILE"
        log_info "Create it first: cp .env.wrangler $ENV_FILE"
        exit 1
    fi
}

# 특정 변수 읽기
get_value() {
    local key=$1
    local value
    value=$(grep "^${key}=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- | head -1)
    echo "$value"
}

# Secret 설정 (값이 유효한 경우만)
set_secret() {
    local worker_dir=$1
    local key=$2
    local value=$3
    
    # placeholder 값 건너뛰기
    if [[ -z "$value" || "$value" == "your-"* || "$value" == "change-me"* || "$value" == "sk-xxx"* ]]; then
        log_warn "Skipping $key (placeholder or empty value)"
        return 0
    fi
    
    echo -n "  Setting $key... "
    if echo "$value" | wrangler secret put "$key" --env "$WRANGLER_ENV" 2>/dev/null; then
        echo "✓"
        return 0
    else
        echo "✗"
        return 1
    fi
}

# API Gateway secrets
upload_api_gateway() {
    log_section "API Gateway (api.nodove.com)"
    cd workers/api-gateway
    
    local count=0
    
    # Required - Authentication
    set_secret "." "JWT_SECRET" "$(get_value JWT_SECRET)" && ((count++)) || true
    set_secret "." "ADMIN_USERNAME" "$(get_value ADMIN_USERNAME)" && ((count++)) || true
    set_secret "." "ADMIN_PASSWORD" "$(get_value ADMIN_PASSWORD)" && ((count++)) || true
    set_secret "." "ADMIN_EMAIL" "$(get_value ADMIN_EMAIL)" && ((count++)) || true
    
    # Required - Backend Proxy
    set_secret "." "BACKEND_ORIGIN" "$(get_value BACKEND_ORIGIN)" && ((count++)) || true
    set_secret "." "BACKEND_KEY" "$(get_value BACKEND_KEY)" && ((count++)) || true
    
    # Optional - Email OTP
    set_secret "." "RESEND_API_KEY" "$(get_value RESEND_API_KEY)" && ((count++)) || true
    set_secret "." "NOTIFY_FROM_EMAIL" "$(get_value NOTIFY_FROM_EMAIL)" && ((count++)) || true
    
    # Optional - AI Services
    set_secret "." "GEMINI_API_KEY" "$(get_value GEMINI_API_KEY)" && ((count++)) || true
    set_secret "." "OPENROUTER_API_KEY" "$(get_value OPENROUTER_API_KEY)" && ((count++)) || true
    set_secret "." "AI_SERVE_API_KEY" "$(get_value AI_SERVE_API_KEY)" && ((count++)) || true
    
    cd - > /dev/null
    log_info "Uploaded $count secrets for API Gateway"
}

# R2 Gateway secrets
upload_r2_gateway() {
    log_section "R2 Gateway (assets-b.nodove.com)"
    cd workers/r2-gateway
    
    local count=0
    
    # Required - Internal API Authentication (Worker-to-Worker)
    set_secret "." "INTERNAL_KEY" "$(get_value INTERNAL_KEY)" && ((count++)) || true
    
    cd - > /dev/null
    log_info "Uploaded $count secrets for R2 Gateway"
}

# Terminal Gateway secrets
upload_terminal_gateway() {
    log_section "Terminal Gateway (terminal.nodove.com)"
    cd workers/terminal-gateway
    
    local count=0
    
    # Required - Authentication (same JWT as API Gateway)
    set_secret "." "JWT_SECRET" "$(get_value JWT_SECRET)" && ((count++)) || true
    
    # Required - Backend Authentication (same BACKEND_KEY as API Gateway)
    set_secret "." "BACKEND_KEY" "$(get_value BACKEND_KEY)" && ((count++)) || true
    
    cd - > /dev/null
    log_info "Uploaded $count secrets for Terminal Gateway"
}

# Secrets 목록 조회
list_secrets() {
    local worker=${1:-}
    
    case "$worker" in
        api-gateway|api)
            log_section "API Gateway secrets"
            cd workers/api-gateway
            wrangler secret list --env "$WRANGLER_ENV" 2>/dev/null || log_warn "No secrets found or access denied"
            cd - > /dev/null
            ;;
        r2-gateway|r2)
            log_section "R2 Gateway secrets"
            cd workers/r2-gateway
            wrangler secret list --env "$WRANGLER_ENV" 2>/dev/null || log_warn "No secrets found or access denied"
            cd - > /dev/null
            ;;
        terminal-gateway|terminal)
            log_section "Terminal Gateway secrets"
            cd workers/terminal-gateway
            wrangler secret list --env "$WRANGLER_ENV" 2>/dev/null || log_warn "No secrets found or access denied"
            cd - > /dev/null
            ;;
        all|"")
            list_secrets "api-gateway"
            list_secrets "r2-gateway"
            list_secrets "terminal-gateway"
            ;;
        *)
            log_error "Unknown worker: $worker"
            exit 1
            ;;
    esac
}

show_usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  api-gateway       Upload API Gateway secrets"
    echo "  r2-gateway        Upload R2 Gateway secrets"
    echo "  terminal-gateway  Upload Terminal Gateway secrets"
    echo "  all               Upload all Workers secrets"
    echo "  list [worker]     List current secrets (worker: api, r2, terminal, all)"
    echo ""
    echo "Environment:"
    echo "  WRANGLER_ENV      Target environment (default: production)"
    echo ""
    echo "Examples:"
    echo "  $0 api-gateway"
    echo "  $0 all"
    echo "  $0 list api"
    echo "  WRANGLER_ENV=development $0 api-gateway"
    echo ""
    echo "Prerequisites:"
    echo "  1. Copy template: cp .env.wrangler .env.wrangler.local"
    echo "  2. Fill in actual values in .env.wrangler.local"
    echo "  3. Run: wrangler login"
}

# 메인
case "${1:-}" in
    api-gateway|api)
        check_env_file
        upload_api_gateway
        ;;
    r2-gateway|r2)
        check_env_file
        upload_r2_gateway
        ;;
    terminal-gateway|terminal)
        check_env_file
        upload_terminal_gateway
        ;;
    all)
        check_env_file
        upload_api_gateway
        upload_r2_gateway
        upload_terminal_gateway
        log_section "Summary"
        log_info "All Workers secrets uploaded for env: $WRANGLER_ENV"
        ;;
    list)
        list_secrets "${2:-all}"
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
