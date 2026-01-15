#!/bin/bash

# ===================================
# Blog + n8n Workflow Stack - Server Bootstrap Script
# ===================================
# This script prepares a fresh Ubuntu server for the Blog + n8n Workflow stack.
# Run this ONCE on initial server setup before CI/CD deployment.
#
# Usage: sudo bash bootstrap-server.sh [OPTIONS]
#
# Options:
#   --stack-dir DIR     Stack installation directory (default: /opt/blog-stack)
#   --user USER         User to run Docker as (default: current user)
#   --skip-docker       Skip Docker installation (if already installed)
#   --skip-firewall     Skip UFW firewall configuration
#   --help              Show this help message

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Defaults
STACK_DIR="/opt/blog-stack"
DOCKER_USER="${SUDO_USER:-$USER}"
SKIP_DOCKER=false
SKIP_FIREWALL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --stack-dir)
            STACK_DIR="$2"
            shift 2
            ;;
        --user)
            DOCKER_USER="$2"
            shift 2
            ;;
        --skip-docker)
            SKIP_DOCKER=true
            shift
            ;;
        --skip-firewall)
            SKIP_FIREWALL=true
            shift
            ;;
        --help)
            head -20 "$0" | tail -15
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo bash $0${NC}"
    exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Blog + n8n Workflow Stack Bootstrap${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Configuration:"
echo "  Stack Directory: $STACK_DIR"
echo "  Docker User: $DOCKER_USER"
echo "  Skip Docker: $SKIP_DOCKER"
echo "  Skip Firewall: $SKIP_FIREWALL"
echo ""

# Confirm
read -p "Continue with these settings? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# ===================================
# Step 1: System Update
# ===================================
echo ""
echo -e "${YELLOW}[1/7] Updating system packages...${NC}"
apt-get update
apt-get upgrade -y
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    jq \
    htop \
    unzip

# ===================================
# Step 2: Install Docker
# ===================================
if [ "$SKIP_DOCKER" = false ]; then
    echo ""
    echo -e "${YELLOW}[2/7] Installing Docker...${NC}"
    
    # Remove old versions
    apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # Add Docker GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add user to docker group
    usermod -aG docker "$DOCKER_USER"
    
    # Enable Docker service
    systemctl enable docker
    systemctl start docker
    
    echo -e "${GREEN}Docker installed successfully${NC}"
    docker --version
    docker compose version
else
    echo ""
    echo -e "${YELLOW}[2/7] Skipping Docker installation...${NC}"
fi

# ===================================
# Step 3: Configure Firewall
# ===================================
if [ "$SKIP_FIREWALL" = false ]; then
    echo ""
    echo -e "${YELLOW}[3/7] Configuring UFW firewall...${NC}"
    
    apt-get install -y ufw
    
    # Reset and set defaults
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH (important!)
    ufw allow ssh
    
    # Allow HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Enable firewall
    ufw --force enable
    
    echo -e "${GREEN}Firewall configured${NC}"
    ufw status verbose
else
    echo ""
    echo -e "${YELLOW}[3/7] Skipping firewall configuration...${NC}"
fi

# ===================================
# Step 4: Create Stack Directory Structure
# ===================================
echo ""
echo -e "${YELLOW}[4/7] Creating stack directory structure...${NC}"

mkdir -p "$STACK_DIR"/{config,data,logs,scripts,backups}

# Create subdirectories for data persistence
mkdir -p "$STACK_DIR"/data/{postgres,redis,chroma,n8n,minio}
mkdir -p "$STACK_DIR"/data/nginx/{conf.d,ssl}
mkdir -p "$STACK_DIR"/logs/{nginx,api,n8n}

# Set ownership
chown -R "$DOCKER_USER":"$DOCKER_USER" "$STACK_DIR"

echo -e "${GREEN}Directory structure created:${NC}"
tree -L 2 "$STACK_DIR" 2>/dev/null || ls -la "$STACK_DIR"

# ===================================
# Step 5: Create Docker Network
# ===================================
echo ""
echo -e "${YELLOW}[5/7] Creating Docker networks...${NC}"

# Run as docker user
su - "$DOCKER_USER" -c "docker network create blog-network 2>/dev/null || echo 'Network blog-network already exists'"

echo -e "${GREEN}Docker networks ready${NC}"

# ===================================
# Step 6: Create Helper Scripts
# ===================================
echo ""
echo -e "${YELLOW}[6/7] Creating helper scripts...${NC}"

# Create stack management script
cat > "$STACK_DIR/scripts/stack.sh" << 'SCRIPT'
#!/bin/bash
# Stack management helper script

STACK_DIR="/opt/blog-stack"
COMPOSE_FILE="$STACK_DIR/docker-compose.yml"

case "$1" in
    up)
        docker compose -f "$COMPOSE_FILE" up -d "${@:2}"
        ;;
    down)
        docker compose -f "$COMPOSE_FILE" down "${@:2}"
        ;;
    restart)
        docker compose -f "$COMPOSE_FILE" restart "${@:2}"
        ;;
    logs)
        docker compose -f "$COMPOSE_FILE" logs -f "${@:2}"
        ;;
    ps)
        docker compose -f "$COMPOSE_FILE" ps "${@:2}"
        ;;
    pull)
        docker compose -f "$COMPOSE_FILE" pull "${@:2}"
        ;;
    health)
        echo "=== Service Health Check ==="
        echo ""
        echo "PostgreSQL:"
        docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres 2>/dev/null && echo "  OK" || echo "  FAILED"
        echo ""
        echo "Redis:"
        docker compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping 2>/dev/null && echo "  OK" || echo "  FAILED"
        echo ""
        echo "API:"
        curl -sf http://localhost:5080/api/v1/healthz && echo "  OK" || echo "  FAILED"
        echo ""
        echo "n8n:"
        curl -sf http://localhost:5678/healthz && echo "  OK" || echo "  FAILED"
        echo ""
        echo "LiteLLM:"
        curl -sf http://localhost:4000/health && echo "  OK" || echo "  FAILED"
        ;;
    backup)
        BACKUP_NAME="backup-$(date +%Y%m%d_%H%M%S)"
        BACKUP_DIR="$STACK_DIR/backups/$BACKUP_NAME"
        mkdir -p "$BACKUP_DIR"
        
        echo "Creating backup: $BACKUP_NAME"
        
        # Backup PostgreSQL
        docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dumpall -U postgres > "$BACKUP_DIR/postgres.sql"
        
        # Backup n8n workflows
        docker compose -f "$COMPOSE_FILE" exec -T n8n n8n export:workflow --all --output=/data/backups/ 2>/dev/null || true
        
        echo "Backup completed: $BACKUP_DIR"
        ;;
    *)
        echo "Usage: $0 {up|down|restart|logs|ps|pull|health|backup} [services...]"
        exit 1
        ;;
esac
SCRIPT

chmod +x "$STACK_DIR/scripts/stack.sh"

# Create symlink for easy access
ln -sf "$STACK_DIR/scripts/stack.sh" /usr/local/bin/blog-stack

# Create cleanup script
cat > "$STACK_DIR/scripts/cleanup.sh" << 'SCRIPT'
#!/bin/bash
# Docker cleanup script - removes unused resources

echo "Cleaning up Docker resources..."

# Remove unused containers
docker container prune -f

# Remove unused images
docker image prune -f

# Remove unused volumes (be careful!)
# docker volume prune -f

# Remove unused networks
docker network prune -f

echo "Cleanup complete"
docker system df
SCRIPT

chmod +x "$STACK_DIR/scripts/cleanup.sh"

echo -e "${GREEN}Helper scripts created:${NC}"
echo "  - blog-stack up/down/restart/logs/ps/pull/health/backup"
echo "  - $STACK_DIR/scripts/cleanup.sh"

# ===================================
# Step 7: Create .env Template
# ===================================
echo ""
echo -e "${YELLOW}[7/7] Creating environment template...${NC}"

cat > "$STACK_DIR/.env.template" << 'ENV'
# ===================================
# Blog + n8n Workflow Stack Environment
# ===================================
# Copy this file to .env and fill in the values
# The CI/CD pipeline will generate this automatically

# === Image Configuration ===
GITHUB_REPOSITORY_OWNER=your-github-username
IMAGE_TAG=latest

# === Database ===
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=blog

# === Redis ===
REDIS_PASSWORD=your-redis-password

# === n8n ===
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=your-n8n-password
N8N_ENCRYPTION_KEY=your-32-char-encryption-key
N8N_WEBHOOK_URL=https://workflow.yourdomain.com

# === API ===
GITHUB_TOKEN=ghp_your-github-token
GITHUB_REPO_OWNER=your-github-username
GITHUB_REPO_NAME=blog
ADMIN_BEARER_TOKEN=your-admin-token

# === AI (OpenAI-compatible) ===
AI_SERVER_URL=https://api.openai.com/v1
AI_API_KEY=sk-your-ai-key
LITELLM_MASTER_KEY=sk-your-litellm-key
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-your-anthropic-key

# === Domain ===
API_DOMAIN=api.yourdomain.com
WORKFLOW_DOMAIN=workflow.yourdomain.com
ENV

chown "$DOCKER_USER":"$DOCKER_USER" "$STACK_DIR/.env.template"

echo -e "${GREEN}Environment template created at $STACK_DIR/.env.template${NC}"

# ===================================
# Summary
# ===================================
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Bootstrap Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Server is ready for CI/CD deployment."
echo ""
echo -e "${BLUE}Stack Directory:${NC} $STACK_DIR"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Configure GitHub Secrets in your repository"
echo "2. Push changes to trigger CI/CD deployment"
echo "3. Or manually deploy:"
echo ""
echo "   # Login to GHCR (for private images)"
echo "   echo \$GITHUB_TOKEN | docker login ghcr.io -u \$GITHUB_USER --password-stdin"
echo ""
echo "   # Copy docker-compose.yml and .env to $STACK_DIR"
echo "   # Then run:"
echo "   cd $STACK_DIR && docker compose up -d"
echo ""
echo -e "${BLUE}Management Commands:${NC}"
echo "  blog-stack up        - Start all services"
echo "  blog-stack down      - Stop all services"
echo "  blog-stack ps        - List running services"
echo "  blog-stack logs      - View logs"
echo "  blog-stack health    - Check service health"
echo "  blog-stack backup    - Backup databases"
echo ""
echo -e "${YELLOW}Note: Log out and back in for Docker group changes to take effect.${NC}"
echo ""
