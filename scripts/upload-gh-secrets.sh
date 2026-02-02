#!/bin/bash
# =============================================================================
# GitHub Secrets 일괄 등록 스크립트
# =============================================================================
# 사용법:
#   ./scripts/upload-gh-secrets.sh frontend   # .gh_env.local만 등록
#   ./scripts/upload-gh-secrets.sh backend    # .env.backend.local만 등록
#   ./scripts/upload-gh-secrets.sh all        # 둘 다 등록
#   ./scripts/upload-gh-secrets.sh ssh        # SSH 키만 등록
#   ./scripts/upload-gh-secrets.sh ssl        # SSL 인증서만 등록
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# GitHub CLI 확인
if ! command -v gh &> /dev/null; then
    log_error "GitHub CLI (gh) is not installed. Install it first: https://cli.github.com/"
    exit 1
fi

# 인증 확인
if ! gh auth status &> /dev/null; then
    log_error "Not authenticated with GitHub CLI. Run: gh auth login"
    exit 1
fi

upload_env_file() {
    local file=$1
    local desc=$2
    
    if [[ ! -f "$file" ]]; then
        log_error "File not found: $file"
        log_info "Create it first: cp ${file%.local} $file"
        return 1
    fi
    
    log_info "Uploading secrets from $file ($desc)..."
    
    local count=0
    while IFS='=' read -r key value; do
        # 주석, 빈 줄, placeholder 값 건너뛰기
        [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
        [[ "$value" == "your-"* || "$value" == "change-me"* || "$value" == "sk-xxx"* ]] && continue
        
        # 빈 값도 등록 (선택적 secrets)
        if [[ -z "$value" ]]; then
            log_warn "Skipping empty value: $key"
            continue
        fi
        
        echo -n "  Setting $key... "
        if gh secret set "$key" --body "$value" 2>/dev/null; then
            echo "✓"
            ((count++))
        else
            echo "✗"
        fi
    done < "$file"
    
    log_info "Uploaded $count secrets from $file"
}

upload_ssh_key() {
    local keyfile="${1:-$HOME/.ssh/id_ed25519}"
    
    if [[ ! -f "$keyfile" ]]; then
        log_error "SSH key not found: $keyfile"
        log_info "Usage: $0 ssh [path/to/private/key]"
        return 1
    fi
    
    log_info "Uploading SSH private key from $keyfile..."
    if gh secret set SSH_PRIVATE_KEY < "$keyfile"; then
        log_info "SSH_PRIVATE_KEY uploaded successfully"
    else
        log_error "Failed to upload SSH_PRIVATE_KEY"
        return 1
    fi
}

upload_ssl_certs() {
    local certfile="${1:-ssl/origin.crt}"
    local keyfile="${2:-ssl/origin.key}"
    
    if [[ -f "$certfile" ]]; then
        log_info "Uploading SSL certificate from $certfile..."
        gh secret set SSL_CERT < "$certfile" && log_info "SSL_CERT uploaded"
    else
        log_warn "SSL certificate not found: $certfile"
    fi
    
    if [[ -f "$keyfile" ]]; then
        log_info "Uploading SSL key from $keyfile..."
        gh secret set SSL_KEY < "$keyfile" && log_info "SSL_KEY uploaded"
    else
        log_warn "SSL key not found: $keyfile"
    fi
}

show_usage() {
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  frontend    Upload .gh_env.local (frontend/CI secrets only)"
    echo "  backend     Upload .env.backend.local (backend infrastructure secrets)"
    echo "  all         Upload both frontend and backend secrets"
    echo "  ssh [file]  Upload SSH private key (default: ~/.ssh/id_ed25519)"
    echo "  ssl         Upload SSL certificates (ssl/origin.crt, ssl/origin.key)"
    echo "  list        List all current GitHub secrets"
    echo ""
    echo "Examples:"
    echo "  $0 frontend"
    echo "  $0 backend"
    echo "  $0 ssh ~/.ssh/deploy_key"
    echo "  $0 all"
}

# 메인
case "${1:-}" in
    frontend)
        upload_env_file ".gh_env.local" "Frontend/CI"
        ;;
    backend)
        upload_env_file ".env.backend.local" "Backend Infrastructure"
        ;;
    all)
        upload_env_file ".gh_env.local" "Frontend/CI"
        echo ""
        upload_env_file ".env.backend.local" "Backend Infrastructure"
        ;;
    ssh)
        upload_ssh_key "${2:-}"
        ;;
    ssl)
        upload_ssl_certs "${2:-}" "${3:-}"
        ;;
    list)
        log_info "Current GitHub secrets:"
        gh secret list
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
