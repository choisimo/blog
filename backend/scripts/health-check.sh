#!/bin/bash

# ===================================
# Blog + n8n Stack Health Check Script
# ===================================
# Validates all services are running and healthy.
# Can be used locally or in CI/CD pipelines.
#
# Usage:
#   ./health-check.sh                    # Check all services
#   ./health-check.sh --service api      # Check specific service
#   ./health-check.sh --json             # Output as JSON
#   ./health-check.sh --wait 300         # Wait up to 300s for services

set -e

# Configuration
STACK_DIR="${STACK_DIR:-/opt/blog-stack}"
API_HOST="${API_HOST:-localhost}"
API_PORT="${API_PORT:-5080}"
N8N_PORT="${N8N_PORT:-5678}"
LITELLM_PORT="${LITELLM_PORT:-4000}"
NGINX_PORT="${NGINX_PORT:-80}"
TIMEOUT="${TIMEOUT:-5}"
MAX_WAIT="${MAX_WAIT:-120}"
JSON_OUTPUT=false
SPECIFIC_SERVICE=""

# Colors (disabled for JSON output)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --service|-s)
            SPECIFIC_SERVICE="$2"
            shift 2
            ;;
        --json|-j)
            JSON_OUTPUT=true
            RED='' GREEN='' YELLOW='' BLUE='' NC=''
            shift
            ;;
        --wait|-w)
            MAX_WAIT="$2"
            shift 2
            ;;
        --host)
            API_HOST="$2"
            shift 2
            ;;
        --help|-h)
            echo "Health Check Script for Blog + n8n Stack"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --service, -s NAME    Check specific service"
            echo "  --json, -j            Output as JSON"
            echo "  --wait, -w SECONDS    Wait for services (default: 120)"
            echo "  --host HOST           API host (default: localhost)"
            echo "  --help, -h            Show this help"
            echo ""
            echo "Services: api, n8n, litellm, postgres, redis, mongodb, nginx, qdrant, chroma"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Results storage
declare -A RESULTS
OVERALL_STATUS="healthy"

# Check functions
check_http() {
    local name="$1"
    local url="$2"
    local expected="${3:-200}"
    
    local start_time=$(date +%s)
    local response=""
    local status=""
    
    while true; do
        response=$(curl -sf -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" "$url" 2>/dev/null || echo "000")
        
        if [ "$response" = "$expected" ]; then
            status="healthy"
            break
        fi
        
        local elapsed=$(($(date +%s) - start_time))
        if [ "$elapsed" -ge "$MAX_WAIT" ]; then
            status="unhealthy"
            OVERALL_STATUS="unhealthy"
            break
        fi
        
        sleep 2
    done
    
    RESULTS["$name"]="$status|$url|HTTP $response"
}

check_tcp() {
    local name="$1"
    local host="$2"
    local port="$3"
    
    local start_time=$(date +%s)
    local status=""
    
    while true; do
        if nc -z -w "$TIMEOUT" "$host" "$port" 2>/dev/null; then
            status="healthy"
            break
        fi
        
        local elapsed=$(($(date +%s) - start_time))
        if [ "$elapsed" -ge "$MAX_WAIT" ]; then
            status="unhealthy"
            OVERALL_STATUS="unhealthy"
            break
        fi
        
        sleep 2
    done
    
    RESULTS["$name"]="$status|$host:$port|TCP"
}

check_docker_service() {
    local name="$1"
    local container="$2"
    
    local status=""
    local health=""
    
    # Check if container exists and is running
    if docker ps --filter "name=$container" --format '{{.Status}}' | grep -q "Up"; then
        health=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
        
        if [ "$health" = "healthy" ] || [ "$health" = "none" ]; then
            status="healthy"
        else
            status="unhealthy"
            OVERALL_STATUS="unhealthy"
        fi
    else
        status="unhealthy"
        health="not running"
        OVERALL_STATUS="unhealthy"
    fi
    
    RESULTS["$name"]="$status|$container|Docker: $health"
}

check_postgres() {
    local start_time=$(date +%s)
    local status=""
    
    while true; do
        if docker compose -f "$STACK_DIR/docker-compose.yml" exec -T postgres pg_isready -U postgres 2>/dev/null | grep -q "accepting"; then
            status="healthy"
            break
        fi
        
        local elapsed=$(($(date +%s) - start_time))
        if [ "$elapsed" -ge "$MAX_WAIT" ]; then
            status="unhealthy"
            OVERALL_STATUS="unhealthy"
            break
        fi
        
        sleep 2
    done
    
    RESULTS["postgres"]="$status|postgres:5432|pg_isready"
}

check_redis() {
    local start_time=$(date +%s)
    local status=""
    
    while true; do
        if docker compose -f "$STACK_DIR/docker-compose.yml" exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
            status="healthy"
            break
        fi
        
        local elapsed=$(($(date +%s) - start_time))
        if [ "$elapsed" -ge "$MAX_WAIT" ]; then
            status="unhealthy"
            OVERALL_STATUS="unhealthy"
            break
        fi
        
        sleep 2
    done
    
    RESULTS["redis"]="$status|redis:6379|redis-cli ping"
}

check_mongodb() {
    local start_time=$(date +%s)
    local status=""
    
    while true; do
        if docker compose -f "$STACK_DIR/docker-compose.yml" exec -T mongodb mongosh --quiet --eval "db.adminCommand('ping')" 2>/dev/null | grep -q "ok"; then
            status="healthy"
            break
        fi
        
        local elapsed=$(($(date +%s) - start_time))
        if [ "$elapsed" -ge "$MAX_WAIT" ]; then
            status="unhealthy"
            OVERALL_STATUS="unhealthy"
            break
        fi
        
        sleep 2
    done
    
    RESULTS["mongodb"]="$status|mongodb:27017|mongosh ping"
}

# Run checks
run_checks() {
    if [ -n "$SPECIFIC_SERVICE" ]; then
        case "$SPECIFIC_SERVICE" in
            api)
                check_http "api" "http://${API_HOST}:${API_PORT}/api/v1/healthz"
                ;;
            n8n)
                check_http "n8n" "http://${API_HOST}:${N8N_PORT}/healthz"
                ;;
            litellm)
                check_http "litellm" "http://${API_HOST}:${LITELLM_PORT}/health"
                ;;
            postgres)
                check_postgres
                ;;
            redis)
                check_redis
                ;;
            mongodb)
                check_mongodb
                ;;
            nginx)
                check_http "nginx" "http://${API_HOST}:${NGINX_PORT}/"
                ;;
            qdrant)
                check_http "qdrant" "http://${API_HOST}:6333/health"
                ;;
            chroma)
                check_http "chroma" "http://${API_HOST}:8000/api/v1/heartbeat"
                ;;
            *)
                echo "Unknown service: $SPECIFIC_SERVICE"
                exit 1
                ;;
        esac
    else
        # Check all services
        echo -e "${BLUE}Checking all services...${NC}"
        echo ""
        
        # Infrastructure
        check_postgres &
        check_redis &
        check_mongodb &
        wait
        
        # HTTP services
        check_http "api" "http://${API_HOST}:${API_PORT}/api/v1/healthz" &
        check_http "n8n" "http://${API_HOST}:${N8N_PORT}/healthz" &
        check_http "litellm" "http://${API_HOST}:${LITELLM_PORT}/health" &
        check_http "nginx" "http://${API_HOST}:${NGINX_PORT}/" &
        wait
        
        # Vector DBs (optional)
        check_http "qdrant" "http://${API_HOST}:6333/health" &
        check_http "chroma" "http://${API_HOST}:8000/api/v1/heartbeat" &
        wait
    fi
}

# Output results
output_results() {
    if [ "$JSON_OUTPUT" = true ]; then
        echo "{"
        echo '  "timestamp": "'$(date -Iseconds)'",'
        echo '  "status": "'$OVERALL_STATUS'",'
        echo '  "services": {'
        
        local first=true
        for name in "${!RESULTS[@]}"; do
            IFS='|' read -r status endpoint method <<< "${RESULTS[$name]}"
            
            if [ "$first" = true ]; then
                first=false
            else
                echo ","
            fi
            
            echo -n '    "'$name'": {"status": "'$status'", "endpoint": "'$endpoint'", "method": "'$method'"}'
        done
        
        echo ""
        echo "  }"
        echo "}"
    else
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}Health Check Results${NC}"
        echo -e "${BLUE}========================================${NC}"
        echo ""
        
        for name in "${!RESULTS[@]}"; do
            IFS='|' read -r status endpoint method <<< "${RESULTS[$name]}"
            
            if [ "$status" = "healthy" ]; then
                echo -e "${GREEN}✓${NC} $name"
                echo "    Endpoint: $endpoint"
                echo "    Method: $method"
            else
                echo -e "${RED}✗${NC} $name"
                echo "    Endpoint: $endpoint"
                echo "    Method: $method"
            fi
            echo ""
        done
        
        echo -e "${BLUE}========================================${NC}"
        if [ "$OVERALL_STATUS" = "healthy" ]; then
            echo -e "${GREEN}Overall Status: HEALTHY${NC}"
        else
            echo -e "${RED}Overall Status: UNHEALTHY${NC}"
        fi
        echo -e "${BLUE}========================================${NC}"
    fi
}

# Main
main() {
    # Check if docker compose file exists
    if [ ! -f "$STACK_DIR/docker-compose.yml" ]; then
        echo -e "${YELLOW}Warning: docker-compose.yml not found at $STACK_DIR${NC}"
        echo "Using HTTP checks only..."
    fi
    
    run_checks
    output_results
    
    # Exit with appropriate code
    if [ "$OVERALL_STATUS" = "healthy" ]; then
        exit 0
    else
        exit 1
    fi
}

main
