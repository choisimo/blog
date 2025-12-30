#!/bin/bash

# ===================================
# Blog + n8n Stack Operations Script
# ===================================
# Handles rollback, backup, restore, and maintenance operations.
#
# Usage:
#   ./stack-ops.sh rollback [IMAGE_TAG]   # Rollback to previous/specific version
#   ./stack-ops.sh backup                  # Create full backup
#   ./stack-ops.sh restore BACKUP_NAME     # Restore from backup
#   ./stack-ops.sh logs [SERVICE]          # View logs
#   ./stack-ops.sh restart [SERVICE]       # Restart services
#   ./stack-ops.sh cleanup                 # Clean up Docker resources
#   ./stack-ops.sh status                  # Show stack status

set -e

# Configuration
STACK_DIR="${STACK_DIR:-/opt/blog-stack}"
BACKUP_DIR="${BACKUP_DIR:-$STACK_DIR/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-$STACK_DIR/docker-compose.yml}"
ENV_FILE="${ENV_FILE:-$STACK_DIR/.env}"
KEEP_BACKUPS="${KEEP_BACKUPS:-5}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check prerequisites
check_prereqs() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "docker-compose.yml not found at $COMPOSE_FILE"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
}

# Get current image tags
get_current_tags() {
    if [ -f "$ENV_FILE" ]; then
        grep "IMAGE_TAG=" "$ENV_FILE" | cut -d'=' -f2 || echo "latest"
    else
        echo "latest"
    fi
}

# List available image tags from GHCR
list_available_tags() {
    local repo_owner=$(grep "GITHUB_REPOSITORY_OWNER=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2 || echo "")
    
    if [ -z "$repo_owner" ]; then
        log_warn "Cannot determine repo owner for listing tags"
        return
    fi
    
    log_info "Available tags for ghcr.io/$repo_owner/blog-api:"
    
    # This requires GHCR authentication
    docker images "ghcr.io/$repo_owner/*" --format "{{.Repository}}:{{.Tag}}" 2>/dev/null | head -10 || \
        log_warn "Cannot list remote tags. Showing local images only."
}

# Rollback to previous version
rollback() {
    local target_tag="${1:-}"
    
    log_info "Starting rollback process..."
    
    # Get current tag
    local current_tag=$(get_current_tags)
    log_info "Current IMAGE_TAG: $current_tag"
    
    if [ -z "$target_tag" ]; then
        # List available local images and prompt
        log_info "Available local images:"
        docker images "ghcr.io/*/blog-api" --format "table {{.Repository}}\t{{.Tag}}\t{{.CreatedAt}}" | head -10
        echo ""
        read -p "Enter target IMAGE_TAG to rollback to: " target_tag
        
        if [ -z "$target_tag" ]; then
            log_error "No target tag specified"
            exit 1
        fi
    fi
    
    log_info "Target IMAGE_TAG: $target_tag"
    
    # Confirm
    read -p "Rollback from '$current_tag' to '$target_tag'? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Rollback cancelled"
        exit 0
    fi
    
    # Create backup before rollback
    log_info "Creating backup before rollback..."
    backup "pre-rollback-$(date +%Y%m%d_%H%M%S)"
    
    # Update .env with new tag
    if [ -f "$ENV_FILE" ]; then
        sed -i "s/IMAGE_TAG=.*/IMAGE_TAG=$target_tag/" "$ENV_FILE"
    fi
    
    # Pull the target images
    log_info "Pulling images with tag: $target_tag..."
    IMAGE_TAG="$target_tag" docker compose -f "$COMPOSE_FILE" pull api terminal-server 2>/dev/null || true
    
    # Restart services
    log_info "Restarting services..."
    docker compose -f "$COMPOSE_FILE" up -d api terminal-server
    
    # Wait and verify
    log_info "Waiting for services to start..."
    sleep 10
    
    if curl -sf http://localhost:5080/api/v1/healthz > /dev/null; then
        log_success "Rollback completed successfully"
    else
        log_error "Rollback may have failed - API health check failed"
        log_warn "Check logs with: ./stack-ops.sh logs api"
        exit 1
    fi
}

# Create backup
backup() {
    local backup_name="${1:-backup-$(date +%Y%m%d_%H%M%S)}"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log_info "Creating backup: $backup_name"
    
    mkdir -p "$backup_path"
    
    # Backup .env file
    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "$backup_path/.env"
        log_success "Backed up .env"
    fi
    
    # Backup docker-compose.yml
    if [ -f "$COMPOSE_FILE" ]; then
        cp "$COMPOSE_FILE" "$backup_path/docker-compose.yml"
        log_success "Backed up docker-compose.yml"
    fi
    
    # Backup PostgreSQL
    log_info "Backing up PostgreSQL..."
    if docker compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
        docker compose -f "$COMPOSE_FILE" exec -T postgres pg_dumpall -U postgres > "$backup_path/postgres.sql" 2>/dev/null
        log_success "Backed up PostgreSQL"
    else
        log_warn "PostgreSQL not running, skipping database backup"
    fi
    
    # Backup n8n workflows
    log_info "Backing up n8n workflows..."
    mkdir -p "$backup_path/n8n-workflows"
    docker compose -f "$COMPOSE_FILE" exec -T n8n n8n export:workflow --all --output=/tmp/workflows/ 2>/dev/null || true
    docker compose -f "$COMPOSE_FILE" cp n8n:/tmp/workflows/. "$backup_path/n8n-workflows/" 2>/dev/null || \
        log_warn "Could not export n8n workflows"
    
    # Create manifest
    cat > "$backup_path/manifest.json" << EOF
{
    "name": "$backup_name",
    "created_at": "$(date -Iseconds)",
    "image_tag": "$(get_current_tags)",
    "contents": [
        "postgres.sql",
        ".env",
        "docker-compose.yml",
        "n8n-workflows/"
    ]
}
EOF
    
    # Compress backup
    log_info "Compressing backup..."
    tar -czf "$backup_path.tar.gz" -C "$BACKUP_DIR" "$backup_name"
    rm -rf "$backup_path"
    
    log_success "Backup created: $backup_path.tar.gz"
    
    # Cleanup old backups
    cleanup_old_backups
}

# Restore from backup
restore() {
    local backup_name="$1"
    
    if [ -z "$backup_name" ]; then
        log_info "Available backups:"
        ls -la "$BACKUP_DIR"/*.tar.gz 2>/dev/null || log_warn "No backups found"
        echo ""
        read -p "Enter backup name (without .tar.gz): " backup_name
    fi
    
    local backup_file="$BACKUP_DIR/$backup_name.tar.gz"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup not found: $backup_file"
        exit 1
    fi
    
    log_info "Restoring from: $backup_file"
    
    # Confirm
    read -p "This will overwrite current data. Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    # Extract backup
    local temp_dir=$(mktemp -d)
    tar -xzf "$backup_file" -C "$temp_dir"
    local backup_dir="$temp_dir/$backup_name"
    
    # Stop services
    log_info "Stopping services..."
    docker compose -f "$COMPOSE_FILE" stop api terminal-server n8n
    
    # Restore .env
    if [ -f "$backup_dir/.env" ]; then
        cp "$backup_dir/.env" "$ENV_FILE"
        log_success "Restored .env"
    fi
    
    # Restore PostgreSQL
    if [ -f "$backup_dir/postgres.sql" ]; then
        log_info "Restoring PostgreSQL..."
        docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U postgres < "$backup_dir/postgres.sql"
        log_success "Restored PostgreSQL"
    fi
    
    # Restore n8n workflows
    if [ -d "$backup_dir/n8n-workflows" ] && [ "$(ls -A $backup_dir/n8n-workflows)" ]; then
        log_info "Restoring n8n workflows..."
        docker compose -f "$COMPOSE_FILE" cp "$backup_dir/n8n-workflows/." n8n:/data/import/
        docker compose -f "$COMPOSE_FILE" exec -T n8n n8n import:workflow --input=/data/import/ 2>/dev/null || \
            log_warn "Could not import n8n workflows automatically"
    fi
    
    # Restart services
    log_info "Restarting services..."
    docker compose -f "$COMPOSE_FILE" up -d
    
    # Cleanup
    rm -rf "$temp_dir"
    
    log_success "Restore completed"
}

# Cleanup old backups
cleanup_old_backups() {
    local count=$(ls -1 "$BACKUP_DIR"/*.tar.gz 2>/dev/null | wc -l)
    
    if [ "$count" -gt "$KEEP_BACKUPS" ]; then
        local to_delete=$((count - KEEP_BACKUPS))
        log_info "Removing $to_delete old backup(s)..."
        
        ls -1t "$BACKUP_DIR"/*.tar.gz | tail -n "$to_delete" | xargs rm -f
    fi
}

# View logs
logs() {
    local service="${1:-}"
    
    if [ -n "$service" ]; then
        docker compose -f "$COMPOSE_FILE" logs -f "$service"
    else
        docker compose -f "$COMPOSE_FILE" logs -f
    fi
}

# Restart services
restart() {
    local service="${1:-}"
    
    if [ -n "$service" ]; then
        log_info "Restarting $service..."
        docker compose -f "$COMPOSE_FILE" restart "$service"
    else
        log_info "Restarting all services..."
        docker compose -f "$COMPOSE_FILE" restart
    fi
    
    log_success "Restart completed"
}

# Cleanup Docker resources
cleanup() {
    log_info "Cleaning up Docker resources..."
    
    # Remove unused containers
    docker container prune -f
    
    # Remove unused images (except for stack images)
    docker image prune -f
    
    # Remove unused networks
    docker network prune -f
    
    log_success "Cleanup completed"
    
    echo ""
    log_info "Docker disk usage:"
    docker system df
}

# Show stack status
status() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}Stack Status${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    echo -e "${YELLOW}Current Configuration:${NC}"
    echo "  Stack Directory: $STACK_DIR"
    echo "  IMAGE_TAG: $(get_current_tags)"
    echo ""
    
    echo -e "${YELLOW}Running Containers:${NC}"
    docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || log_warn "Could not get container status"
    echo ""
    
    echo -e "${YELLOW}Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}" 2>/dev/null | head -15 || true
    echo ""
    
    echo -e "${YELLOW}Recent Backups:${NC}"
    ls -lht "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -5 || echo "  No backups found"
    echo ""
    
    echo -e "${YELLOW}Disk Usage:${NC}"
    df -h "$STACK_DIR" 2>/dev/null || true
}

# Main
main() {
    check_prereqs
    
    case "${1:-status}" in
        rollback)
            rollback "$2"
            ;;
        backup)
            backup "$2"
            ;;
        restore)
            restore "$2"
            ;;
        logs)
            logs "$2"
            ;;
        restart)
            restart "$2"
            ;;
        cleanup)
            cleanup
            ;;
        status)
            status
            ;;
        help|--help|-h)
            echo "Blog + n8n Stack Operations Script"
            echo ""
            echo "Usage: $0 COMMAND [ARGS]"
            echo ""
            echo "Commands:"
            echo "  rollback [TAG]     Rollback to previous/specific image tag"
            echo "  backup [NAME]      Create full backup"
            echo "  restore NAME       Restore from backup"
            echo "  logs [SERVICE]     View logs (follow mode)"
            echo "  restart [SERVICE]  Restart service(s)"
            echo "  cleanup            Clean up Docker resources"
            echo "  status             Show stack status (default)"
            echo "  help               Show this help"
            echo ""
            echo "Examples:"
            echo "  $0 rollback                # Interactive rollback"
            echo "  $0 rollback v1.2.3         # Rollback to specific tag"
            echo "  $0 backup                  # Create backup with auto name"
            echo "  $0 backup pre-upgrade      # Create named backup"
            echo "  $0 restore backup-20241230 # Restore from backup"
            echo "  $0 logs api                # Follow API logs"
            echo ""
            echo "Environment Variables:"
            echo "  STACK_DIR     Stack directory (default: /opt/blog-stack)"
            echo "  BACKUP_DIR    Backup directory (default: \$STACK_DIR/backups)"
            echo "  KEEP_BACKUPS  Number of backups to keep (default: 5)"
            ;;
        *)
            log_error "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

main "$@"
