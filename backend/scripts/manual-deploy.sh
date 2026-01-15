#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="${DEPLOY_DIR:-$HOME/blog-stack}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

show_help() {
  cat << EOF
Blog Backend Manual Deployment Script

Usage: $(basename "$0") <command> [options]

Commands:
  setup           Initial setup (create directories, copy configs)
  pull            Pull latest code from git
  build           Build Docker images locally
  deploy          Deploy services (pull images + restart)
  restart         Restart all services
  restart-api     Restart only API service
  status          Show service status
  logs [service]  Show logs (optionally for specific service)
  health          Run health checks
  env-check       Verify environment variables
  cleanup         Remove old images and containers

Options:
  -h, --help      Show this help message
  -f, --force     Force operation without confirmation
  -d, --dir DIR   Use custom deploy directory (default: ~/blog-stack)

Examples:
  $(basename "$0") setup                 # Initial setup
  $(basename "$0") pull && $(basename "$0") build && $(basename "$0") deploy
  $(basename "$0") restart-api           # Restart only API after code change
  $(basename "$0") logs api              # View API logs
  $(basename "$0") -d /opt/blog deploy   # Deploy to custom directory

Environment Variables:
  DEPLOY_DIR      Deployment directory (default: ~/blog-stack)
  GHCR_TOKEN      GitHub Container Registry token for pulling images
  GITHUB_OWNER    GitHub repository owner (default: choisimo)

Note:
  This script is for manual server administration.
  Environment variables (.env) are managed by GitHub Actions workflow:
  .github/workflows/sync-backend-env.yml
EOF
}

check_docker() {
  if ! command -v docker &> /dev/null; then
    log_error "Docker is not installed"
    exit 1
  fi

  if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null; then
    log_error "Docker Compose is not installed"
    exit 1
  fi
}

get_compose_cmd() {
  if docker compose version &> /dev/null; then
    echo "docker compose"
  else
    echo "docker-compose"
  fi
}

cmd_setup() {
  log_info "Setting up deployment directory: $DEPLOY_DIR"

  mkdir -p "$DEPLOY_DIR"/{ssl,scripts,n8n-workflows,n8n_files}

  if [ -f "$BACKEND_DIR/docker-compose.blog-workflow.yml" ]; then
    cp "$BACKEND_DIR/docker-compose.blog-workflow.yml" "$DEPLOY_DIR/docker-compose.yml"
    log_success "Copied docker-compose.yml"
  fi

  if [ -f "$BACKEND_DIR/nginx/nginx.conf" ]; then
    cp "$BACKEND_DIR/nginx/nginx.conf" "$DEPLOY_DIR/nginx.conf"
    log_success "Copied nginx.conf"
  fi

  if [ -d "$BACKEND_DIR/n8n-workflows" ]; then
    cp -r "$BACKEND_DIR/n8n-workflows/"* "$DEPLOY_DIR/n8n-workflows/" 2>/dev/null || true
    log_success "Copied n8n workflows"
  fi

  for script in "$SCRIPT_DIR"/*.sh; do
    if [ -f "$script" ]; then
      cp "$script" "$DEPLOY_DIR/scripts/"
    fi
  done
  log_success "Copied utility scripts"

  if [ ! -f "$DEPLOY_DIR/.env" ]; then
    log_warn ".env file not found in $DEPLOY_DIR"
    log_info "Run 'sync-backend-env' GitHub Action to generate .env from secrets"
    log_info "Or manually create .env from backend/.env.example"
  fi

  if [ ! -f "$DEPLOY_DIR/ssl/origin.crt" ]; then
    log_info "Generating self-signed SSL certificate..."
    "$DEPLOY_DIR/scripts/generate-ssl-cert.sh" "$DEPLOY_DIR/ssl" 2>/dev/null || \
      openssl req -x509 -nodes -days 5475 -newkey rsa:2048 \
        -keyout "$DEPLOY_DIR/ssl/origin.key" \
        -out "$DEPLOY_DIR/ssl/origin.crt" \
        -subj "/CN=*.nodove.com/O=Nodove/C=KR" \
        -addext "subjectAltName=DNS:*.nodove.com,DNS:nodove.com" 2>/dev/null
    log_success "SSL certificate generated"
  fi

  log_success "Setup complete!"
  echo ""
  echo "Next steps:"
  echo "1. Ensure .env file exists (via GitHub Action or manual copy)"
  echo "2. Run: $(basename "$0") deploy"
}

cmd_pull() {
  log_info "Pulling latest code from git..."
  cd "$BACKEND_DIR"

  if [ -d ".git" ]; then
    git fetch origin
    git pull origin main
    log_success "Code updated"
  else
    log_error "Not a git repository. Clone the repo first:"
    echo "  git clone https://github.com/choisimo/blog.git"
    exit 1
  fi
}

cmd_build() {
  log_info "Building Docker images locally..."
  cd "$BACKEND_DIR"

  IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
  GITHUB_OWNER="${GITHUB_OWNER:-choisimo}"

  log_info "Building blog-api:$IMAGE_TAG"
  docker build -t "ghcr.io/$GITHUB_OWNER/blog-api:$IMAGE_TAG" -t "ghcr.io/$GITHUB_OWNER/blog-api:latest" .

  if [ -d "terminal-server" ]; then
    log_info "Building blog-terminal:$IMAGE_TAG"
    docker build -t "ghcr.io/$GITHUB_OWNER/blog-terminal:$IMAGE_TAG" -t "ghcr.io/$GITHUB_OWNER/blog-terminal:latest" ./terminal-server
  fi

  log_success "Images built successfully"
  docker images | grep -E "(blog-api|blog-terminal)" | head -10
}

cmd_deploy() {
  check_docker
  DC=$(get_compose_cmd)

  cd "$DEPLOY_DIR"

  if [ ! -f ".env" ]; then
    log_error ".env file not found in $DEPLOY_DIR"
    log_info "Run 'sync-backend-env' GitHub Action first"
    exit 1
  fi

  if [ ! -f "docker-compose.yml" ]; then
    log_error "docker-compose.yml not found. Run 'setup' first."
    exit 1
  fi

  log_info "Logging into GHCR..."
  if [ -n "${GHCR_TOKEN:-}" ]; then
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GITHUB_OWNER:-choisimo}" --password-stdin
  else
    log_warn "GHCR_TOKEN not set. Attempting without login..."
  fi

  log_info "Pulling images..."
  $DC pull || log_warn "Some images failed to pull, using local images"

  log_info "Starting services..."
  $DC up -d --remove-orphans

  log_info "Waiting for services to start..."
  sleep 10

  cmd_health
}

cmd_restart() {
  check_docker
  DC=$(get_compose_cmd)
  cd "$DEPLOY_DIR"

  log_info "Restarting all services..."
  $DC restart

  sleep 5
  cmd_status
}

cmd_restart_api() {
  check_docker
  DC=$(get_compose_cmd)
  cd "$DEPLOY_DIR"

  log_info "Restarting API service..."
  $DC restart api

  sleep 3

  log_info "API service status:"
  $DC ps api
}

cmd_status() {
  check_docker
  DC=$(get_compose_cmd)
  cd "$DEPLOY_DIR"

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║                    SERVICE STATUS                          ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  $DC ps

  echo ""
  echo "Resource usage:"
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -15 || true
}

cmd_logs() {
  check_docker
  DC=$(get_compose_cmd)
  cd "$DEPLOY_DIR"

  SERVICE="${1:-}"

  if [ -n "$SERVICE" ]; then
    $DC logs -f --tail=100 "$SERVICE"
  else
    $DC logs -f --tail=50
  fi
}

cmd_health() {
  cd "$DEPLOY_DIR"

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║                    HEALTH CHECKS                           ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  check_endpoint() {
    local name="$1"
    local url="$2"
    if curl -sf "$url" > /dev/null 2>&1; then
      echo -e "  ${GREEN}✅${NC} $name"
    else
      echo -e "  ${RED}❌${NC} $name"
    fi
  }

  echo "Internal endpoints:"
  check_endpoint "API Health      " "http://localhost:8080/api/v1/healthz"
  check_endpoint "n8n Health      " "http://localhost:5678/healthz"
  check_endpoint "Nginx Health    " "http://localhost:8080/health"

  echo ""
  echo "Database services:"

  DC=$(get_compose_cmd)
  if $DC exec -T postgres pg_isready -U bloguser > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} PostgreSQL"
  else
    echo -e "  ${RED}❌${NC} PostgreSQL"
  fi

  if $DC exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅${NC} Redis"
  else
    echo -e "  ${RED}❌${NC} Redis"
  fi

  echo ""
}

cmd_env_check() {
  cd "$DEPLOY_DIR"

  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║              ENVIRONMENT VARIABLE CHECK                    ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  if [ ! -f ".env" ]; then
    log_error ".env file not found"
    exit 1
  fi

  REQUIRED_VARS=(
    "POSTGRES_PASSWORD"
    "REDIS_PASSWORD"
    "JWT_SECRET"
    "ADMIN_PASSWORD"
    "N8N_PASS"
    "N8N_ENCRYPTION_KEY"
  )

  OPTIONAL_VARS=(
    "AI_SERVER_URL"
    "AI_API_KEY"
    "OPENAI_API_KEY"
    "GOOGLE_API_KEY"
    "ANTHROPIC_API_KEY"
    "GITHUB_TOKEN"
  )

  echo "Required variables:"
  for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^${var}=.\+" .env 2>/dev/null; then
      echo -e "  ${GREEN}✅${NC} $var"
    else
      echo -e "  ${RED}❌${NC} $var (missing or empty)"
    fi
  done

  echo ""
  echo "Optional variables:"
  for var in "${OPTIONAL_VARS[@]}"; do
    if grep -q "^${var}=.\+" .env 2>/dev/null; then
      echo -e "  ${GREEN}✅${NC} $var"
    else
      echo -e "  ${YELLOW}⚠️${NC}  $var (not set)"
    fi
  done

  echo ""
  echo ".env file stats:"
  echo "  Lines: $(wc -l < .env)"
  echo "  Size: $(wc -c < .env) bytes"
  echo "  Last modified: $(stat -c %y .env 2>/dev/null || stat -f %Sm .env 2>/dev/null)"
}

cmd_cleanup() {
  log_info "Cleaning up old Docker resources..."

  docker image prune -f
  docker container prune -f
  docker network prune -f

  log_info "Removing old blog images (keeping latest 3)..."
  for image in "blog-api" "blog-terminal"; do
    docker images "ghcr.io/*/$image" --format "{{.ID}} {{.Tag}}" 2>/dev/null | \
      grep -v latest | \
      tail -n +4 | \
      awk '{print $1}' | \
      xargs -r docker rmi 2>/dev/null || true
  done

  log_success "Cleanup complete"
  docker system df
}

FORCE=false
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--help)
      show_help
      exit 0
      ;;
    -f|--force)
      FORCE=true
      shift
      ;;
    -d|--dir)
      DEPLOY_DIR="$2"
      shift 2
      ;;
    *)
      break
      ;;
  esac
done

COMMAND="${1:-}"
shift || true

case "$COMMAND" in
  setup)
    cmd_setup
    ;;
  pull)
    cmd_pull
    ;;
  build)
    cmd_build
    ;;
  deploy)
    cmd_deploy
    ;;
  restart)
    cmd_restart
    ;;
  restart-api)
    cmd_restart_api
    ;;
  status)
    cmd_status
    ;;
  logs)
    cmd_logs "$@"
    ;;
  health)
    cmd_health
    ;;
  env-check)
    cmd_env_check
    ;;
  cleanup)
    cmd_cleanup
    ;;
  "")
    show_help
    ;;
  *)
    log_error "Unknown command: $COMMAND"
    echo ""
    show_help
    exit 1
    ;;
esac
