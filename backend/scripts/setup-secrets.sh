#!/bin/bash

# ===================================
# GitHub Secrets Setup Helper
# ===================================
# This script helps you set up GitHub Secrets for CI/CD deployment.
# It generates secure values and creates a .env.local file for reference.
#
# Requirements: gh CLI (GitHub CLI) must be installed and authenticated
#
# Usage:
#   ./setup-secrets.sh --check          Check which secrets are missing
#   ./setup-secrets.sh --generate       Generate secure values for secrets
#   ./setup-secrets.sh --set            Interactively set secrets via gh CLI
#   ./setup-secrets.sh --export FILE    Export secrets to a file (for backup)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Generate random string
generate_random() {
    openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | xxd -p | head -c "$((2 * $1))"
}

# Required secrets list
declare -A SECRETS
SECRETS=(
    # Server & SSH
    ["SERVER_HOST"]="Production server hostname or IP"
    ["SERVER_USER"]="SSH username for deployment"
    ["SERVER_SSH_KEY"]="SSH private key (base64 encoded or raw)"
    
    # Database
    ["POSTGRES_PASSWORD"]="PostgreSQL password"
    ["REDIS_PASSWORD"]="Redis password"
    
    # GitHub
    ["GH_TOKEN"]="GitHub Personal Access Token (repo permissions)"
    ["GITHUB_REPO_OWNER"]="GitHub username/organization"
    ["GITHUB_REPO_NAME"]="GitHub repository name"
    ["GIT_USER_NAME"]="Git commit author name"
    ["GIT_USER_EMAIL"]="Git commit author email"
    
    # Admin
    ["ADMIN_BEARER_TOKEN"]="Admin API authentication token"
    
    # AI Services
    ["LITELLM_MASTER_KEY"]="LiteLLM master key"
    ["AI_API_KEY"]="AI server API key (OpenAI-compatible)"
    ["OPENAI_API_KEY"]="OpenAI API key (optional)"
    ["ANTHROPIC_API_KEY"]="Anthropic API key (optional)"
    ["GEMINI_API_KEY"]="Google Gemini API key (optional)"
    
    # MinIO
    ["MINIO_ROOT_USER"]="MinIO admin username"
    ["MINIO_ROOT_PASSWORD"]="MinIO admin password"
)

# Required variables (non-sensitive)
declare -A VARIABLES
VARIABLES=(
    ["API_DOMAIN"]="API domain (e.g., api.yourdomain.com)"
    ["WORKFLOW_DOMAIN"]="Workflow domain (e.g., workflow.yourdomain.com)"
    ["FRONTEND_DOMAIN"]="Frontend domain (e.g., blog.yourdomain.com)"
    ["AI_SERVER_URL"]="OpenAI-compatible AI server URL"
    ["IMAGE_TAG"]="Docker image tag (default: latest)"
)

# Check if gh CLI is installed
check_gh_cli() {
    if ! command -v gh &> /dev/null; then
        echo -e "${RED}GitHub CLI (gh) is not installed.${NC}"
        echo "Install it from: https://cli.github.com/"
        echo ""
        echo "On macOS: brew install gh"
        echo "On Ubuntu: sudo apt install gh"
        return 1
    fi
    
    if ! gh auth status &> /dev/null; then
        echo -e "${RED}GitHub CLI is not authenticated.${NC}"
        echo "Run: gh auth login"
        return 1
    fi
    
    return 0
}

# Get current repository
get_repo() {
    gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo ""
}

# Check which secrets are missing
check_secrets() {
    echo -e "${BLUE}Checking GitHub Secrets...${NC}"
    echo ""
    
    if ! check_gh_cli; then
        echo -e "${YELLOW}Cannot check secrets without gh CLI. Showing required secrets list:${NC}"
        echo ""
        for key in "${!SECRETS[@]}"; do
            echo "  - $key: ${SECRETS[$key]}"
        done
        return
    fi
    
    REPO=$(get_repo)
    if [ -z "$REPO" ]; then
        echo -e "${RED}Not in a git repository or cannot determine repo.${NC}"
        return
    fi
    
    echo "Repository: $REPO"
    echo ""
    
    # Get existing secrets
    EXISTING=$(gh secret list --repo "$REPO" 2>/dev/null | awk '{print $1}')
    
    echo -e "${GREEN}=== Required Secrets ===${NC}"
    for key in "${!SECRETS[@]}"; do
        if echo "$EXISTING" | grep -q "^${key}$"; then
            echo -e "  ${GREEN}✓${NC} $key"
        else
            echo -e "  ${RED}✗${NC} $key - ${SECRETS[$key]}"
        fi
    done
    
    echo ""
    echo -e "${GREEN}=== Repository Variables ===${NC}"
    EXISTING_VARS=$(gh variable list --repo "$REPO" 2>/dev/null | awk '{print $1}')
    for key in "${!VARIABLES[@]}"; do
        if echo "$EXISTING_VARS" | grep -q "^${key}$"; then
            echo -e "  ${GREEN}✓${NC} $key"
        else
            echo -e "  ${YELLOW}○${NC} $key - ${VARIABLES[$key]}"
        fi
    done
}

# Generate secure values
generate_secrets() {
    echo -e "${BLUE}Generating secure values...${NC}"
    echo ""
    
    OUTPUT_FILE="${1:-.env.secrets.generated}"
    
    cat > "$OUTPUT_FILE" << EOF
# ===================================
# Generated Secrets
# Generated on: $(date)
# ===================================
# IMPORTANT: Store these securely and add to GitHub Secrets
# DO NOT commit this file to git!

# === Database Passwords ===
POSTGRES_PASSWORD=$(generate_random 16)
REDIS_PASSWORD=$(generate_random 16)

# === Admin ===
ADMIN_BEARER_TOKEN=$(generate_random 32)

# === LiteLLM ===
LITELLM_MASTER_KEY=sk-$(generate_random 24)

# === MinIO ===
MINIO_ROOT_USER=admin
MINIO_ROOT_PASSWORD=$(generate_random 16)

# === Secrets you need to provide manually ===
# SERVER_HOST=your-server-ip-or-hostname
# SERVER_USER=your-ssh-username
# SERVER_SSH_KEY=your-ssh-private-key

# GH_TOKEN=ghp_your-github-token
# GITHUB_REPO_OWNER=your-github-username
# GITHUB_REPO_NAME=blog
# GIT_USER_NAME=Your Name
# GIT_USER_EMAIL=your@email.com

# AI_API_KEY=sk-your-ai-key
# OPENAI_API_KEY=sk-your-openai-key
# ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
# GEMINI_API_KEY=your-gemini-key

# === Variables (non-sensitive, set via gh variable set) ===
# API_DOMAIN=api.yourdomain.com
# WORKFLOW_DOMAIN=workflow.yourdomain.com
# FRONTEND_DOMAIN=blog.yourdomain.com
# AI_SERVER_URL=https://api.openai.com/v1
# IMAGE_TAG=latest
EOF

    echo -e "${GREEN}Generated secrets saved to: $OUTPUT_FILE${NC}"
    echo ""
    echo -e "${YELLOW}IMPORTANT:${NC}"
    echo "1. Review and customize the generated values"
    echo "2. Fill in the manual secrets (marked with #)"
    echo "3. Add each secret to GitHub using:"
    echo "   gh secret set SECRET_NAME < value"
    echo "4. Delete this file after adding secrets!"
    echo ""
    echo "Add this file to .gitignore:"
    echo "  echo '$OUTPUT_FILE' >> .gitignore"
}

# Interactively set secrets
set_secrets() {
    echo -e "${BLUE}Setting GitHub Secrets interactively...${NC}"
    echo ""
    
    if ! check_gh_cli; then
        return 1
    fi
    
    REPO=$(get_repo)
    if [ -z "$REPO" ]; then
        echo -e "${RED}Not in a git repository.${NC}"
        return 1
    fi
    
    echo "Repository: $REPO"
    echo ""
    
    # Get existing secrets
    EXISTING=$(gh secret list --repo "$REPO" 2>/dev/null | awk '{print $1}')
    
    for key in "${!SECRETS[@]}"; do
        if echo "$EXISTING" | grep -q "^${key}$"; then
            echo -e "${GREEN}$key${NC} already exists. Skip? (y/n) "
            read -r skip
            if [[ $skip =~ ^[Yy]$ ]]; then
                continue
            fi
        fi
        
        echo ""
        echo -e "${YELLOW}$key${NC}: ${SECRETS[$key]}"
        
        # Special handling for multi-line secrets
        if [[ $key == "SERVER_SSH_KEY" ]]; then
            echo "Enter path to file containing the value:"
            read -r filepath
            if [ -f "$filepath" ]; then
                gh secret set "$key" --repo "$REPO" < "$filepath"
                echo -e "${GREEN}✓ Set $key from file${NC}"
            else
                echo -e "${RED}File not found: $filepath${NC}"
            fi
        else
            echo "Enter value (or press Enter to skip):"
            read -rs value
            if [ -n "$value" ]; then
                echo "$value" | gh secret set "$key" --repo "$REPO"
                echo -e "${GREEN}✓ Set $key${NC}"
            else
                echo "Skipped"
            fi
        fi
    done
    
    echo ""
    echo -e "${GREEN}Secrets configuration complete!${NC}"
}

# Export secrets list
export_secrets_list() {
    OUTPUT_FILE="${1:-secrets-list.txt}"
    
    echo "# Required GitHub Secrets" > "$OUTPUT_FILE"
    echo "# Generated on: $(date)" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    echo "## Secrets (Sensitive)" >> "$OUTPUT_FILE"
    for key in "${!SECRETS[@]}"; do
        echo "$key: ${SECRETS[$key]}" >> "$OUTPUT_FILE"
    done
    
    echo "" >> "$OUTPUT_FILE"
    echo "## Variables (Non-sensitive)" >> "$OUTPUT_FILE"
    for key in "${!VARIABLES[@]}"; do
        echo "$key: ${VARIABLES[$key]}" >> "$OUTPUT_FILE"
    done
    
    echo -e "${GREEN}Exported to: $OUTPUT_FILE${NC}"
}

# Main
case "${1:-}" in
    --check|-c)
        check_secrets
        ;;
    --generate|-g)
        generate_secrets "$2"
        ;;
    --set|-s)
        set_secrets
        ;;
    --export|-e)
        export_secrets_list "$2"
        ;;
    --help|-h|*)
        echo "GitHub Secrets Setup Helper"
        echo ""
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --check, -c           Check which secrets are missing"
        echo "  --generate, -g [FILE] Generate secure values (default: .env.secrets.generated)"
        echo "  --set, -s             Interactively set secrets via gh CLI"
        echo "  --export, -e [FILE]   Export secrets list to file"
        echo "  --help, -h            Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0 --check                    # See which secrets are missing"
        echo "  $0 --generate                 # Generate secure values"
        echo "  $0 --generate my-secrets.env  # Generate to custom file"
        echo "  $0 --set                      # Set secrets interactively"
        ;;
esac
