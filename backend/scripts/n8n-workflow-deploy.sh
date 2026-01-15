#!/bin/bash
# =============================================================================
# n8n AI Workflow Deployment Script
# =============================================================================
#
# This script imports and activates all AI workflows on the pmx-102-1 server.
#
# Usage:
#   ./scripts/n8n-workflow-deploy.sh [options]
#
# Options:
#   --import-only    Only import workflows, don't activate
#   --activate-only  Only activate existing workflows
#   --test           Run endpoint tests after deployment
#   --dry-run        Show what would be done without making changes
#   --help           Show this help message
#
# Prerequisites:
#   - Docker Compose running with n8n service
#   - n8n-workflows/*.json files present
#   - curl and jq installed
#
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKFLOWS_DIR="${PROJECT_ROOT}/n8n-workflows"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.blog-workflow.yml"

# n8n Configuration
N8N_CONTAINER="blog-n8n"
N8N_HOST="${N8N_HOST:-blog-bw.nodove.com}"
N8N_PROTOCOL="${N8N_PROTOCOL:-https}"
N8N_BASE_URL="${N8N_PROTOCOL}://${N8N_HOST}"
N8N_WEBHOOK_BASE="${N8N_BASE_URL}/webhook"

# Workflow files to deploy
WORKFLOW_FILES=(
    "ai-health.json"
    "ai-chat.json"
    "ai-generate.json"
    "ai-task.json"
    "ai-translate.json"
    "ai-vision.json"
    "ai-embeddings.json"
)

# Options
IMPORT_ONLY=false
ACTIVATE_ONLY=false
RUN_TESTS=false
DRY_RUN=false

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running"
        exit 1
    fi
    
    # Check if n8n container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${N8N_CONTAINER}$"; then
        log_error "n8n container '${N8N_CONTAINER}' is not running"
        log_info "Start it with: docker compose -f ${COMPOSE_FILE} up -d n8n"
        exit 1
    fi
    
    # Check workflow files
    if [ ! -d "$WORKFLOWS_DIR" ]; then
        log_error "Workflows directory not found: $WORKFLOWS_DIR"
        exit 1
    fi
    
    local missing_files=()
    for file in "${WORKFLOW_FILES[@]}"; do
        if [ ! -f "${WORKFLOWS_DIR}/${file}" ]; then
            missing_files+=("$file")
        fi
    done
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        log_error "Missing workflow files:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        exit 1
    fi
    
    # Check curl and jq
    if ! command -v curl &>/dev/null; then
        log_error "curl is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &>/dev/null; then
        log_warn "jq is not installed, JSON output will not be formatted"
    fi
    
    log_success "Prerequisites check passed"
}

# =============================================================================
# Workflow Import Functions
# =============================================================================

import_workflow() {
    local workflow_file="$1"
    local workflow_name="${workflow_file%.json}"
    
    log_info "Importing workflow: $workflow_name"
    
    if [ "$DRY_RUN" = true ]; then
        echo "  [DRY-RUN] Would import: $workflow_file"
        return 0
    fi
    
    # Import using n8n CLI inside container
    local result
    if result=$(docker exec "$N8N_CONTAINER" n8n import:workflow --input="/workflows/${workflow_file}" 2>&1); then
        log_success "Imported: $workflow_name"
        return 0
    else
        log_error "Failed to import $workflow_name: $result"
        return 1
    fi
}

import_all_workflows() {
    log_info "=== Importing Workflows ==="
    
    local success_count=0
    local fail_count=0
    
    for file in "${WORKFLOW_FILES[@]}"; do
        if import_workflow "$file"; then
            ((success_count++)) || true
        else
            ((fail_count++)) || true
        fi
    done
    
    echo ""
    log_info "Import Summary: ${success_count} succeeded, ${fail_count} failed"
    
    if [ $fail_count -gt 0 ]; then
        return 1
    fi
    return 0
}

# =============================================================================
# Workflow Activation Functions
# =============================================================================

get_workflow_id_by_name() {
    local workflow_name="$1"
    
    # Get workflow list and find by name
    docker exec "$N8N_CONTAINER" n8n list:workflow 2>/dev/null | \
        grep -i "$workflow_name" | \
        awk '{print $1}' | \
        head -1
}

activate_workflow() {
    local workflow_name="$1"
    
    log_info "Activating workflow: $workflow_name"
    
    if [ "$DRY_RUN" = true ]; then
        echo "  [DRY-RUN] Would activate: $workflow_name"
        return 0
    fi
    
    # Get workflow ID
    local workflow_id
    workflow_id=$(get_workflow_id_by_name "$workflow_name")
    
    if [ -z "$workflow_id" ]; then
        log_warn "Workflow not found: $workflow_name (may need to import first)"
        return 1
    fi
    
    # Activate using n8n CLI
    local result
    if result=$(docker exec "$N8N_CONTAINER" n8n update:workflow --id="$workflow_id" --active=true 2>&1); then
        log_success "Activated: $workflow_name (ID: $workflow_id)"
        return 0
    else
        log_error "Failed to activate $workflow_name: $result"
        return 1
    fi
}

activate_all_workflows() {
    log_info "=== Activating Workflows ==="
    
    local success_count=0
    local fail_count=0
    
    # Map filenames to workflow names (removing .json and using descriptive names)
    declare -A workflow_names=(
        ["ai-health.json"]="AI Health"
        ["ai-chat.json"]="AI Chat"
        ["ai-generate.json"]="AI Generate"
        ["ai-task.json"]="AI Task"
        ["ai-translate.json"]="AI Translate"
        ["ai-vision.json"]="AI Vision"
        ["ai-embeddings.json"]="AI Embeddings"
    )
    
    for file in "${WORKFLOW_FILES[@]}"; do
        local name="${workflow_names[$file]:-${file%.json}}"
        if activate_workflow "$name"; then
            ((success_count++)) || true
        else
            ((fail_count++)) || true
        fi
    done
    
    echo ""
    log_info "Activation Summary: ${success_count} succeeded, ${fail_count} failed"
    
    if [ $fail_count -gt 0 ]; then
        return 1
    fi
    return 0
}

# =============================================================================
# Testing Functions
# =============================================================================

test_endpoint() {
    local endpoint="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    
    local url="${N8N_WEBHOOK_BASE}${endpoint}"
    
    log_info "Testing: $method $endpoint"
    
    if [ "$DRY_RUN" = true ]; then
        echo "  [DRY-RUN] Would test: $url"
        return 0
    fi
    
    local response
    local http_code
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" -H "Content-Type: application/json" -d "$data" "$url" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -1)
    response=$(echo "$response" | sed '$d')
    
    if [[ "$http_code" =~ ^2[0-9][0-9]$ ]]; then
        log_success "$endpoint → HTTP $http_code"
        if command -v jq &>/dev/null && echo "$response" | jq . >/dev/null 2>&1; then
            echo "$response" | jq -C . | head -20
        else
            echo "$response" | head -20
        fi
        return 0
    else
        log_error "$endpoint → HTTP $http_code"
        echo "$response" | head -10
        return 1
    fi
}

run_tests() {
    log_info "=== Running Endpoint Tests ==="
    
    local success_count=0
    local fail_count=0
    
    # Test Health endpoint
    if test_endpoint "/ai/health" "GET"; then
        ((success_count++)) || true
    else
        ((fail_count++)) || true
    fi
    echo ""
    
    # Test Chat endpoint
    local chat_data='{"messages":[{"role":"user","content":"Say hello in one word."}],"model":"gpt-4.1"}'
    if test_endpoint "/ai/chat" "POST" "$chat_data"; then
        ((success_count++)) || true
    else
        ((fail_count++)) || true
    fi
    echo ""
    
    # Test Generate endpoint
    local generate_data='{"prompt":"Say hello in one word.","temperature":0.1}'
    if test_endpoint "/ai/generate" "POST" "$generate_data"; then
        ((success_count++)) || true
    else
        ((fail_count++)) || true
    fi
    echo ""
    
    # Test Task endpoint (sketch mode)
    local task_data='{"mode":"sketch","payload":{"paragraph":"AI is transforming the world.","postTitle":"AI"}}'
    if test_endpoint "/ai/task" "POST" "$task_data"; then
        ((success_count++)) || true
    else
        ((fail_count++)) || true
    fi
    echo ""
    
    # Test Embeddings endpoint
    local embed_data='{"input":["Hello world"]}'
    if test_endpoint "/ai/embeddings" "POST" "$embed_data"; then
        ((success_count++)) || true
    else
        ((fail_count++)) || true
    fi
    echo ""
    
    log_info "Test Summary: ${success_count} passed, ${fail_count} failed"
    
    if [ $fail_count -gt 0 ]; then
        return 1
    fi
    return 0
}

# =============================================================================
# n8n Environment Variables Setup
# =============================================================================

setup_n8n_variables() {
    log_info "=== Setting up n8n Environment Variables ==="
    
    cat << 'EOF'
To complete the setup, configure these variables in n8n UI:

1. Open n8n Dashboard: https://blog-bw.nodove.com
2. Go to: Settings → Variables
3. Add the following variables:

   ┌────────────────────────────┬──────────────────────────────────────┐
   │ Variable Name              │ Value                                │
   ├────────────────────────────┼──────────────────────────────────────┤
   │ AI_SERVER_URL              │ https://api.openai.com/v1            │
   │ AI_API_KEY                 │ your-api-key                         │
   │ AI_DEFAULT_MODEL           │ gpt-4.1                              │
   │ OPENAI_API_BASE_URL        │ (optional alias)                     │
   │ TEI_URL                    │ http://embedding-server:80           │
   └────────────────────────────┴──────────────────────────────────────┘

Note: These variables are already set in docker-compose environment,
      but adding them in n8n UI provides a backup and easier management.

EOF
}

# =============================================================================
# Main Execution
# =============================================================================

show_help() {
    cat << EOF
n8n AI Workflow Deployment Script

Usage: $0 [options]

Options:
  --import-only    Only import workflows, don't activate
  --activate-only  Only activate existing workflows
  --test           Run endpoint tests after deployment
  --dry-run        Show what would be done without making changes
  --help           Show this help message

Examples:
  $0                     # Import and activate all workflows
  $0 --test              # Import, activate, and test
  $0 --import-only       # Only import workflows
  $0 --dry-run --test    # Preview all operations

EOF
}

main() {
    echo ""
    echo "=============================================="
    echo "  n8n AI Workflow Deployment"
    echo "=============================================="
    echo ""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --import-only)
                IMPORT_ONLY=true
                shift
                ;;
            --activate-only)
                ACTIVATE_ONLY=true
                shift
                ;;
            --test)
                RUN_TESTS=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                log_warn "Running in DRY-RUN mode - no changes will be made"
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Check prerequisites
    check_prerequisites
    echo ""
    
    # Import workflows
    if [ "$ACTIVATE_ONLY" = false ]; then
        if ! import_all_workflows; then
            log_error "Workflow import had failures"
        fi
        echo ""
    fi
    
    # Activate workflows
    if [ "$IMPORT_ONLY" = false ]; then
        if ! activate_all_workflows; then
            log_warn "Workflow activation had failures (may need manual activation in n8n UI)"
        fi
        echo ""
    fi
    
    # Show environment variable setup instructions
    setup_n8n_variables
    
    # Run tests if requested
    if [ "$RUN_TESTS" = true ]; then
        echo ""
        if ! run_tests; then
            log_warn "Some tests failed - check endpoint configuration"
        fi
    fi
    
    echo ""
    echo "=============================================="
    echo "  Deployment Complete"
    echo "=============================================="
    echo ""
    log_info "Next steps:"
    echo "  1. Verify workflows in n8n UI: ${N8N_BASE_URL}"
    echo "  2. Set environment variables in n8n Settings → Variables"
    echo "  3. Test endpoints: ${N8N_WEBHOOK_BASE}/ai/health"
    echo ""
}

# Run main function
main "$@"
