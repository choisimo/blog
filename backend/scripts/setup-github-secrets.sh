#!/bin/bash
# =============================================================================
# GitHub Secrets & Variables Setup Script
# =============================================================================
# 
# Usage:
#   1. Export your GitHub token: export GH_TOKEN=ghp_xxxx
#   2. Run this script: ./setup-github-secrets.sh
#
# Or interactively:
#   gh auth login
#   ./setup-github-secrets.sh
#
# =============================================================================

set -euo pipefail

REPO="choisimo/blog"

# Check if gh is authenticated
if ! gh auth status &>/dev/null; then
    echo "❌ GitHub CLI not authenticated. Please run: gh auth login"
    exit 1
fi

echo "=== Setting up GitHub Secrets & Variables for $REPO ==="
echo ""

# =============================================================================
# SECRETS (sensitive values - you'll be prompted for each)
# =============================================================================

echo "=== Required Secrets ==="
echo "You will be prompted for each secret value."
echo ""

# Function to set secret
set_secret() {
    local name=$1
    local description=$2
    echo -n "Enter $name ($description): "
    read -s value
    echo ""
    if [ -n "$value" ]; then
        echo "$value" | gh secret set "$name" --repo "$REPO"
        echo "✅ $name set"
    else
        echo "⏭️  $name skipped (empty)"
    fi
}

# SSH Secrets
echo ""
echo "--- SSH Configuration ---"
set_secret "PROD_SSH_HOST" "Production server IP/hostname"
set_secret "PROD_SSH_USER" "SSH username"
echo "For PROD_SSH_KEY, paste the entire private key (press Ctrl+D when done):"
gh secret set PROD_SSH_KEY --repo "$REPO" < /dev/stdin || echo "⏭️  PROD_SSH_KEY skipped"
set_secret "PROD_SSH_PORT" "SSH port (default: 22)"

# Database Secrets
echo ""
echo "--- Database Secrets ---"
set_secret "POSTGRES_PASSWORD" "PostgreSQL password"
set_secret "REDIS_PASSWORD" "Redis password"
set_secret "MONGO_PASSWORD" "MongoDB password"
set_secret "QDRANT_API_KEY" "Qdrant API key"

# AI Service Secrets
echo ""
echo "--- AI Service Secrets ---"
set_secret "LITELLM_MASTER_KEY" "LiteLLM master key"
set_secret "OPENAI_API_KEY" "OpenAI API key (optional)"
set_secret "GOOGLE_API_KEY" "Google/Gemini API key (optional)"
set_secret "ANTHROPIC_API_KEY" "Anthropic API key (optional)"

# Admin Secrets
echo ""
echo "--- Admin Secrets ---"
set_secret "ADMIN_JWT_SECRET" "Admin JWT secret (32+ chars)"
set_secret "ADMIN_PASSWORD" "Admin password"
set_secret "ADMIN_BEARER_TOKEN" "API bearer token"
set_secret "JWT_SECRET" "JWT secret"

# n8n Secrets
echo ""
echo "--- n8n Secrets ---"
set_secret "N8N_PASS" "n8n login password"
set_secret "N8N_ENCRYPTION_KEY" "n8n encryption key (32 chars)"
set_secret "N8N_API_KEY" "n8n API key (optional)"

# Cloudflare Secrets
echo ""
echo "--- Cloudflare Secrets ---"
set_secret "CF_API_TOKEN" "Cloudflare API token"

# SSL Certificates
echo ""
echo "--- SSL Certificates ---"
echo "For SSL_CERT, paste the certificate content (press Ctrl+D when done):"
gh secret set SSL_CERT --repo "$REPO" < /dev/stdin || echo "⏭️  SSL_CERT skipped"
echo "For SSL_KEY, paste the private key content (press Ctrl+D when done):"
gh secret set SSL_KEY --repo "$REPO" < /dev/stdin || echo "⏭️  SSL_KEY skipped"

# Other Secrets
echo ""
echo "--- Other Secrets ---"
set_secret "GH_PAT_TOKEN" "GitHub Personal Access Token"
set_secret "ORIGIN_SECRET_KEY" "Terminal server secret"
set_secret "MINIO_PASSWORD" "MinIO password"
set_secret "FIRECRAWL_API_TOKEN" "Firecrawl API token (optional)"
set_secret "GRAFANA_PASSWORD" "Grafana password (optional)"
set_secret "PGADMIN_PASSWORD" "pgAdmin password (optional)"

# =============================================================================
# VARIABLES (non-sensitive configuration)
# =============================================================================

echo ""
echo "=== Setting Variables ==="

# Function to set variable
set_var() {
    local name=$1
    local value=$2
    gh variable set "$name" --repo "$REPO" --body "$value"
    echo "✅ $name = $value"
}

# Application
set_var "APP_ENV" "production"
set_var "SITE_BASE_URL" "https://noblog.nodove.com"
set_var "API_BASE_URL" "https://blog-b.nodove.com"

# Database
set_var "POSTGRES_DB" "blog"
set_var "POSTGRES_USER" "bloguser"
set_var "MONGO_USER" "mongouser"
set_var "MONGO_DB" "blog"

# AI
set_var "AI_DEFAULT_MODEL" "gpt-4.1"

# n8n
set_var "N8N_USER" "admin"
set_var "N8N_WEBHOOK_URL" "https://blog-bw.nodove.com/"
set_var "N8N_HOST" "blog-bw.nodove.com"
set_var "N8N_WORKER_REPLICAS" "2"

# Cloudflare (fill in your values)
# set_var "CF_ACCOUNT_ID" "your-account-id"
# set_var "D1_DATABASE_ID" "your-d1-id"
set_var "R2_BUCKET_NAME" "blog"
set_var "R2_ASSETS_BASE_URL" "https://assets-b.nodove.com"

# GitHub
set_var "GITHUB_REPO_OWNER" "choisimo"
set_var "GITHUB_REPO_NAME" "blog"

# Other
set_var "ADMIN_EMAIL" "admin@nodove.com"
set_var "ADMIN_USERNAME" "admin"
set_var "MINIO_USER" "minioadmin"
set_var "SANDBOX_IMAGE" "alpine:latest"
set_var "PGADMIN_EMAIL" "admin@nodove.com"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To verify, run:"
echo "  gh secret list --repo $REPO"
echo "  gh variable list --repo $REPO"
