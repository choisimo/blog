#!/bin/bash
# =============================================================================
# start-all-local.sh - Local Development Environment Startup Script
# =============================================================================
#
# Usage:
#   ./start-all-local.sh              # Docker 모드 (기본) - 모든 서비스 Docker로 실행
#   ./start-all-local.sh --hybrid     # Hybrid 모드 - Frontend/Workers 로컬 프로세스
#   ./start-all-local.sh --stop       # 모든 서비스 종료
#   ./start-all-local.sh --status     # 서비스 상태 확인
#
# =============================================================================

set -e

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Service URLs
GATEWAY_URL="http://localhost:8080"
BACKEND_URL="http://localhost:5080"
LITELLM_URL="http://localhost:4000"
WORKERS_URL="http://localhost:8787"
FRONTEND_URL="http://localhost:5173"

# Timeouts
HEALTH_CHECK_TIMEOUT=120
HEALTH_CHECK_INTERVAL=3

# PID file for hybrid mode
PID_FILE="$PROJECT_ROOT/.local-dev-pids"

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${CYAN}[STEP]${NC} $1"; }

print_banner() {
    echo -e "${CYAN}"
    echo "============================================================================="
    echo "                    Local Development Environment"
    echo "============================================================================="
    echo -e "${NC}"
}

# -----------------------------------------------------------------------------
# Prerequisites Check
# -----------------------------------------------------------------------------
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    local missing=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing+=("docker")
    elif ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check Docker Compose
    if ! docker compose version &> /dev/null; then
        missing+=("docker-compose")
    fi
    
    # Check Node.js (for hybrid mode)
    if ! command -v node &> /dev/null; then
        log_warn "Node.js not found - hybrid mode will not be available"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_warn "npm not found - hybrid mode will not be available"
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Missing required tools: ${missing[*]}"
        echo ""
        echo "Please install the following:"
        for tool in "${missing[@]}"; do
            case $tool in
                docker)
                    echo "  - Docker: https://docs.docker.com/get-docker/"
                    ;;
                docker-compose)
                    echo "  - Docker Compose: https://docs.docker.com/compose/install/"
                    ;;
            esac
        done
        exit 1
    fi
    
    log_success "All prerequisites satisfied"
}

# -----------------------------------------------------------------------------
# Environment Setup (Fully Automated)
# -----------------------------------------------------------------------------
generate_random_key() {
    # Generate a random key for security tokens
    local prefix="${1:-sk}"
    local random_part=$(head -c 32 /dev/urandom 2>/dev/null | base64 2>/dev/null | tr -dc 'a-zA-Z0-9' | head -c 24)
    if [ -z "$random_part" ]; then
        # Fallback if /dev/urandom is not available
        random_part=$(date +%s%N | sha256sum | head -c 24)
    fi
    echo "${prefix}-${random_part}"
}

setup_environment() {
    log_step "Setting up environment files..."
    
    local env_file="$PROJECT_ROOT/.env.local"
    local created_new=false
    
    # Create .env.local if it doesn't exist
    if [ ! -f "$env_file" ]; then
        created_new=true
        log_info "Creating .env.local with auto-generated secure values..."
        
        # Generate secure random keys
        local master_key=$(generate_random_key "sk")
        local origin_secret=$(generate_random_key "secret")
        local jwt_secret=$(generate_random_key "jwt")
        local admin_token=$(generate_random_key "admin")
        
        cat > "$env_file" << EOF
# =============================================================================
# Local Development Environment Variables (Auto-Generated)
# =============================================================================
# Generated at: $(date -Iseconds)
#
# This file was automatically created by start-all-local.sh
# All non-AI services work immediately (posts, comments, terminal, etc.)
#
# 🤖 TO ENABLE AI FEATURES:
#
# Option 1 - Cloud AI (add one of these):
#   GOOGLE_API_KEY=AIza...  (free: https://aistudio.google.com/app/apikey)
#   OPENAI_API_KEY=sk-...   (paid)
#   ANTHROPIC_API_KEY=sk-... (paid)
#
# Option 2 - Local AI with Ollama (free, offline):
#   1. Install: https://ollama.ai
#   2. Run: ollama serve && ollama pull llama3.2
#   3. Change AI_DEFAULT_MODEL below to: local
# =============================================================================

# -----------------------------------------------------------------------------
# LiteLLM Gateway Configuration
# -----------------------------------------------------------------------------
LITELLM_MASTER_KEY=${master_key}

# Default AI model
# Cloud: gemini-1.5-flash, gpt-4o-mini, claude-3-haiku (requires API key)
# Local: local, local/llama3 (requires Ollama)
AI_DEFAULT_MODEL=gemini-1.5-flash

# -----------------------------------------------------------------------------
# AI Provider API Keys (Add at least one for cloud AI)
# -----------------------------------------------------------------------------
# Google Gemini (recommended - free tier available)
GOOGLE_API_KEY=

# OpenAI
OPENAI_API_KEY=

# Anthropic Claude
ANTHROPIC_API_KEY=

# -----------------------------------------------------------------------------
# Terminal Service
# -----------------------------------------------------------------------------
ORIGIN_SECRET_KEY=${origin_secret}
SANDBOX_IMAGE=alpine:latest

# -----------------------------------------------------------------------------
# Admin Configuration
# -----------------------------------------------------------------------------
ADMIN_BEARER_TOKEN=${admin_token}
JWT_SECRET=${jwt_secret}
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
EOF
        
        log_success "Created .env.local with secure auto-generated keys"
    fi
    
    # Determine which AI model to use based on available API keys
    local has_api_key=false
    local detected_provider=""
    
    if grep -qE "^GOOGLE_API_KEY=.+" "$env_file" 2>/dev/null; then
        has_api_key=true
        detected_provider="Google Gemini"
    elif grep -qE "^OPENAI_API_KEY=.+" "$env_file" 2>/dev/null; then
        has_api_key=true
        detected_provider="OpenAI"
    elif grep -qE "^ANTHROPIC_API_KEY=.+" "$env_file" 2>/dev/null; then
        has_api_key=true
        detected_provider="Anthropic"
    fi
    
    # Show status message
    echo ""
    if [ "$has_api_key" = true ]; then
        log_success "AI Provider detected: $detected_provider"
        echo -e "  ${GREEN}✓${NC} Real AI responses will be used"
    else
        log_info "No AI API key configured"
        echo -e "  ${YELLOW}→${NC} AI features require an API key or local Ollama"
        echo ""
        echo -e "  ${CYAN}Option 1: Cloud AI (recommended)${NC}"
        echo -e "     Edit .env.local and add: ${GREEN}GOOGLE_API_KEY=AIza...${NC}"
        echo -e "     Free tier: https://aistudio.google.com/app/apikey"
        echo ""
        echo -e "  ${CYAN}Option 2: Local AI with Ollama (free, offline)${NC}"
        echo -e "     1. Install: https://ollama.ai"
        echo -e "     2. Run: ${GREEN}ollama serve${NC}"
        echo -e "     3. Pull: ${GREEN}ollama pull llama3.2${NC}"
        echo -e "     4. Use model: ${GREEN}local${NC} or ${GREEN}local/llama3${NC}"
        echo ""
        echo -e "  ${YELLOW}Note:${NC} All other features (comments, posts, terminal) work without AI"
        echo ""
    fi
    
    # Show first-run message with generated credentials
    if [ "$created_new" = true ]; then
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  ✅ First-time Setup Complete!${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo -e "  ${CYAN}Auto-generated credentials:${NC}"
        echo -e "    LiteLLM Master Key: ${YELLOW}$(grep LITELLM_MASTER_KEY "$env_file" | cut -d= -f2)${NC}"
        echo -e "    Admin Username:     ${YELLOW}admin${NC}"
        echo -e "    Admin Password:     ${YELLOW}admin123${NC}"
        echo ""
        echo -e "  ${CYAN}Configuration file:${NC} $env_file"
        echo ""
    fi
    
    log_success "Environment configured"
}

# -----------------------------------------------------------------------------
# Health Check Functions
# -----------------------------------------------------------------------------
wait_for_service() {
    local name="$1"
    local url="$2"
    local timeout="${3:-$HEALTH_CHECK_TIMEOUT}"
    local elapsed=0
    
    log_info "Waiting for $name to be ready..."
    
    while [ $elapsed -lt $timeout ]; do
        if curl -sf "$url" > /dev/null 2>&1; then
            log_success "$name is ready ($url)"
            return 0
        fi
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        echo -ne "\r  Waiting... ${elapsed}s / ${timeout}s"
    done
    
    echo ""
    log_error "$name failed to start within ${timeout}s"
    return 1
}

check_all_services() {
    log_step "Checking all services..."
    
    local all_ok=true
    
    # Gateway (main entry point)
    if curl -sf "$GATEWAY_URL/health" > /dev/null 2>&1; then
        log_success "Gateway: $GATEWAY_URL"
    else
        log_error "Gateway not responding: $GATEWAY_URL"
        all_ok=false
    fi
    
    # Backend API
    if curl -sf "$BACKEND_URL/api/v1/healthz" > /dev/null 2>&1; then
        log_success "Backend API: $BACKEND_URL"
    else
        log_error "Backend not responding: $BACKEND_URL"
        all_ok=false
    fi
    
    # LiteLLM
    if curl -sf "$LITELLM_URL/health/liveliness" > /dev/null 2>&1; then
        log_success "LiteLLM Gateway: $LITELLM_URL"
    else
        log_error "LiteLLM not responding: $LITELLM_URL"
        all_ok=false
    fi
    
    # Workers
    if curl -sf "$WORKERS_URL" > /dev/null 2>&1; then
        log_success "Workers API: $WORKERS_URL"
    else
        log_warn "Workers not responding: $WORKERS_URL (may be optional)"
    fi
    
    if $all_ok; then
        return 0
    else
        return 1
    fi
}

# -----------------------------------------------------------------------------
# Docker Mode
# -----------------------------------------------------------------------------
start_docker_mode() {
    log_step "Starting all services with Docker Compose..."
    
    cd "$PROJECT_ROOT"
    
    # Build and start
    docker compose -f docker-compose.local.yml up --build -d
    
    echo ""
    log_step "Waiting for services to be ready..."
    
    # Wait for main services
    wait_for_service "LiteLLM" "$LITELLM_URL/health/liveliness" 60 || true
    wait_for_service "Backend" "$BACKEND_URL/api/v1/healthz" 60 || true
    wait_for_service "Gateway" "$GATEWAY_URL/health" 30 || true
    
    echo ""
}

stop_docker_mode() {
    log_step "Stopping Docker services..."
    
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.local.yml down
    
    log_success "All Docker services stopped"
}

# -----------------------------------------------------------------------------
# Hybrid Mode (Frontend/Workers as local processes)
# -----------------------------------------------------------------------------
start_hybrid_mode() {
    log_step "Starting Hybrid mode..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is required for hybrid mode"
        exit 1
    fi
    
    # Start Docker services (backend, litellm, nginx)
    log_info "Starting Docker services (backend, litellm)..."
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.local.yml up -d backend litellm nginx
    
    # Wait for backend services
    wait_for_service "LiteLLM" "$LITELLM_URL/health/liveliness" 60
    wait_for_service "Backend" "$BACKEND_URL/api/v1/healthz" 60
    
    # Initialize PID file
    echo "" > "$PID_FILE"
    
    # Start Workers locally
    log_info "Starting Workers locally..."
    cd "$PROJECT_ROOT/workers"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing Workers dependencies..."
        npm install
    fi
    
    # Build shared package if needed
    if [ ! -d "$PROJECT_ROOT/shared/dist" ]; then
        log_info "Building shared package..."
        cd "$PROJECT_ROOT/shared"
        npm install
        npm run build
        cd "$PROJECT_ROOT/workers"
    fi
    
    # Apply migrations
    log_info "Applying D1 migrations..."
    npx wrangler d1 migrations apply blog-db --local 2>/dev/null || true
    
    # Start wrangler dev in background
    npx wrangler dev --local --persist --ip 0.0.0.0 --port 8787 > /tmp/workers.log 2>&1 &
    echo $! >> "$PID_FILE"
    log_info "Workers started (PID: $!)"
    
    # Start Frontend locally
    log_info "Starting Frontend locally..."
    cd "$PROJECT_ROOT/frontend"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing Frontend dependencies..."
        npm install
    fi
    
    # Start Vite dev server in background
    # Note: VITE_API_BASE_URL should NOT include /api/v1 - that's appended by the frontend code
    VITE_API_BASE_URL="http://localhost:8080" \
    VITE_WORKERS_BASE_URL="http://localhost:8787" \
    npm run dev > /tmp/frontend.log 2>&1 &
    echo $! >> "$PID_FILE"
    log_info "Frontend started (PID: $!)"
    
    # Wait for local services
    sleep 5
    wait_for_service "Workers" "$WORKERS_URL" 30 || true
    wait_for_service "Frontend" "$FRONTEND_URL" 30 || true
    
    echo ""
}

stop_hybrid_mode() {
    log_step "Stopping Hybrid mode services..."
    
    # Stop local processes
    if [ -f "$PID_FILE" ]; then
        while read -r pid; do
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                log_info "Stopping process $pid..."
                kill "$pid" 2>/dev/null || true
            fi
        done < "$PID_FILE"
        rm -f "$PID_FILE"
    fi
    
    # Stop Docker services
    cd "$PROJECT_ROOT"
    docker compose -f docker-compose.local.yml down
    
    log_success "All services stopped"
}

# -----------------------------------------------------------------------------
# Cleanup Handler
# -----------------------------------------------------------------------------
cleanup() {
    echo ""
    log_warn "Shutting down..."
    
    if [ -f "$PID_FILE" ]; then
        stop_hybrid_mode
    else
        stop_docker_mode
    fi
    
    exit 0
}

# -----------------------------------------------------------------------------
# Print Status
# -----------------------------------------------------------------------------
print_status() {
    print_banner
    
    echo -e "${CYAN}Service Status:${NC}"
    echo ""
    
    # Docker containers
    echo "Docker Containers:"
    docker compose -f "$PROJECT_ROOT/docker-compose.local.yml" ps 2>/dev/null || echo "  No containers running"
    echo ""
    
    # Health checks
    check_all_services
    
    echo ""
    echo -e "${CYAN}Access Points:${NC}"
    echo "  Main UI:        $GATEWAY_URL"
    echo "  Backend API:    $GATEWAY_URL/api/v1/"
    echo "  LiteLLM API:    $GATEWAY_URL/ai/v1/"
    echo "  Workers API:    $GATEWAY_URL/workers/"
    echo ""
    echo "  Direct Backend: $BACKEND_URL"
    echo "  Direct LiteLLM: $LITELLM_URL"
    echo "  Direct Workers: $WORKERS_URL"
}

# -----------------------------------------------------------------------------
# Print Final Instructions
# -----------------------------------------------------------------------------
print_litellm_credentials() {
    # Credentials are now shown in setup_environment() on first run
    # This function is kept for backward compatibility but does nothing
    :
}

print_instructions() {
    # Show LiteLLM credentials on first run
    print_litellm_credentials
    
    echo ""
    echo -e "${GREEN}=============================================================================${NC}"
    echo -e "${GREEN}                    All Services Started Successfully!${NC}"
    echo -e "${GREEN}=============================================================================${NC}"
    echo ""
    echo -e "${CYAN}Access Points:${NC}"
    echo "  🌐 Main UI:        $GATEWAY_URL"
    echo "  📡 Backend API:    $GATEWAY_URL/api/v1/"
    echo "  🤖 LiteLLM API:    $GATEWAY_URL/ai/v1/"
    echo "  ⚡ Workers API:    $GATEWAY_URL/workers/"
    echo ""
    echo -e "${CYAN}Direct Access (debugging):${NC}"
    echo "  Backend:  $BACKEND_URL"
    echo "  LiteLLM:  $LITELLM_URL"
    echo "  Workers:  $WORKERS_URL"
    if [ "$MODE" = "hybrid" ]; then
        echo "  Frontend: $FRONTEND_URL (Vite HMR)"
    fi
    echo ""
    echo -e "${CYAN}Useful Commands:${NC}"
    echo "  View logs:    docker compose -f docker-compose.local.yml logs -f"
    echo "  Stop all:     ./start-all-local.sh --stop"
    echo "  Status:       ./start-all-local.sh --status"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
    echo ""
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    local MODE="docker"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --hybrid|-h)
                MODE="hybrid"
                shift
                ;;
            --stop|-s)
                stop_docker_mode
                exit 0
                ;;
            --status)
                print_status
                exit 0
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --hybrid, -h    Start in hybrid mode (Frontend/Workers as local processes)"
                echo "  --stop, -s      Stop all services"
                echo "  --status        Show service status"
                echo "  --help          Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Print banner
    print_banner
    
    # Setup trap for cleanup
    trap cleanup SIGINT SIGTERM
    
    # Run checks and setup
    check_prerequisites
    setup_environment
    
    # Start services based on mode
    if [ "$MODE" = "hybrid" ]; then
        start_hybrid_mode
    else
        start_docker_mode
    fi
    
    # Final health check
    echo ""
    if check_all_services; then
        print_instructions
        
        # Keep script running (for Ctrl+C handling)
        if [ "$MODE" = "docker" ]; then
            # Follow docker logs
            docker compose -f "$PROJECT_ROOT/docker-compose.local.yml" logs -f
        else
            # Wait for interrupt
            while true; do
                sleep 1
            done
        fi
    else
        log_error "Some services failed to start. Check logs with:"
        echo "  docker compose -f docker-compose.local.yml logs"
        exit 1
    fi
}

# Run main
main "$@"
