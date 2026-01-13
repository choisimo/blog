#!/bin/bash
# =============================================================================
# n8n AI Workflows Import Script (PostgreSQL Direct Insertion)
# =============================================================================
# This script imports AI workflow JSON files directly into PostgreSQL.
# 
# The n8n CLI `import:workflow` has bugs with missing DB fields
# (activeVersionId, workflow_history, shared_workflow, webhook_entity),
# so we insert directly into the database.
#
# Usage:
#   ./scripts/import-n8n-workflows.sh [OPTIONS]
#
# Options:
#   --check       Check if workflows exist (dry run)
#   --force       Force re-import (delete existing, then import)
#   --help        Show this help
#
# Prerequisites:
#   - PostgreSQL container (blog-postgres) must be running
#   - n8n-workflows/*.json files must exist
#   - jq must be installed (for JSON parsing)
#
# =============================================================================

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKFLOWS_DIR="${SCRIPT_DIR}/../n8n-workflows"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-blog-postgres}"
POSTGRES_USER="${POSTGRES_USER:-bloguser}"
POSTGRES_DB="${POSTGRES_DB:-blog}"
N8N_CONTAINER="${N8N_CONTAINER:-blog-n8n}"

# n8n project ID (default shared project)
N8N_PROJECT_ID="${N8N_PROJECT_ID:-rA24JTWCzC2vkzAo}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
CHECK_ONLY=false
FORCE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --check)
      CHECK_ONLY=true
      shift
      ;;
    --force)
      FORCE=true
      shift
      ;;
    --help)
      head -30 "$0" | tail -25
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is required but not installed${NC}"
  echo "Install with: apt-get install jq (Debian/Ubuntu) or brew install jq (macOS)"
  exit 1
fi

if ! docker ps | grep -q "$POSTGRES_CONTAINER"; then
  echo -e "${RED}Error: PostgreSQL container '$POSTGRES_CONTAINER' is not running${NC}"
  exit 1
fi

if [ ! -d "$WORKFLOWS_DIR" ]; then
  echo -e "${RED}Error: Workflows directory not found: $WORKFLOWS_DIR${NC}"
  exit 1
fi

# AI workflow files to import
AI_WORKFLOWS=(
  "ai-health.json"
  "ai-chat.json"
  "ai-generate.json"
  "ai-translate.json"
  "ai-task.json"
  "ai-vision.json"
  "ai-embeddings.json"
)

echo -e "${GREEN}Found ${#AI_WORKFLOWS[@]} AI workflow files to process${NC}"

# Function to run SQL in PostgreSQL
run_sql() {
  docker exec "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "$1" 2>/dev/null
}

# Function to run SQL file in PostgreSQL
run_sql_file() {
  docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>/dev/null
}

# Function to check if workflow exists by name
check_workflow() {
  local name="$1"
  run_sql "SELECT id FROM workflow_entity WHERE name = '$name';" | tr -d '[:space:]'
}

# Function to generate a random n8n-style ID (26 characters, alphanumeric)
generate_id() {
  local length=${1:-26}
  cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w $length | head -n 1
}

# Function to extract webhook path from workflow JSON
extract_webhook_path() {
  local file="$1"
  jq -r '.nodes[] | select(.type == "n8n-nodes-base.webhook") | .parameters.path // empty' "$file" | head -1
}

# Function to extract webhook method from workflow JSON
extract_webhook_method() {
  local file="$1"
  jq -r '.nodes[] | select(.type == "n8n-nodes-base.webhook") | .parameters.httpMethod // "GET"' "$file" | head -1
}

# Function to delete workflow and related records
delete_workflow() {
  local workflow_id="$1"
  
  echo -e "  ${YELLOW}Deleting workflow: $workflow_id${NC}"
  
  run_sql "
    BEGIN;
    
    -- Delete webhook registrations
    DELETE FROM webhook_entity WHERE \"workflowId\" = '$workflow_id';
    
    -- Delete shared workflow
    DELETE FROM shared_workflow WHERE \"workflowId\" = '$workflow_id';
    
    -- Get version IDs to delete
    DELETE FROM workflow_history WHERE \"workflowId\" = '$workflow_id';
    
    -- Remove activeVersionId reference first
    UPDATE workflow_entity SET \"activeVersionId\" = NULL WHERE id = '$workflow_id';
    
    -- Delete the workflow
    DELETE FROM workflow_entity WHERE id = '$workflow_id';
    
    COMMIT;
  " > /dev/null
}

# Function to import workflow using direct DB insertion
import_workflow() {
  local file="$1"
  local filepath="${WORKFLOWS_DIR}/${file}"
  
  if [ ! -f "$filepath" ]; then
    echo -e "${RED}  File not found: $filepath${NC}"
    return 1
  fi
  
  # Extract workflow name from JSON
  local name
  name=$(jq -r '.name' "$filepath" 2>/dev/null)
  
  if [ -z "$name" ] || [ "$name" = "null" ]; then
    echo -e "${RED}  Failed to extract workflow name from $file${NC}"
    return 1
  fi
  
  # Check if workflow exists
  local existing_id
  existing_id=$(check_workflow "$name")
  
  if [ -n "$existing_id" ]; then
    if [ "$CHECK_ONLY" = true ]; then
      echo -e "${GREEN}  [EXISTS] $name (ID: $existing_id)${NC}"
      return 0
    elif [ "$FORCE" = true ]; then
      delete_workflow "$existing_id"
    else
      echo -e "${YELLOW}  [SKIP] $name already exists (ID: $existing_id). Use --force to re-import.${NC}"
      return 0
    fi
  fi
  
  if [ "$CHECK_ONLY" = true ]; then
    echo -e "${YELLOW}  [MISSING] $name${NC}"
    return 0
  fi
  
  echo -e "  ${BLUE}Importing: $name${NC}"
  
  # Generate IDs
  local workflow_id
  workflow_id=$(generate_id 26)
  local version_id
  version_id=$(generate_id 36)
  
  # Extract nodes and connections from JSON
  local nodes
  nodes=$(jq -c '.nodes // []' "$filepath")
  local connections
  connections=$(jq -c '.connections // {}' "$filepath")
  local settings
  settings=$(jq -c '.settings // {}' "$filepath")
  local static_data
  static_data=$(jq -c '.staticData // null' "$filepath")
  local trigger_count
  trigger_count=$(jq -r '.triggerCount // 0' "$filepath")
  
  # Extract webhook info if exists
  local webhook_path
  webhook_path=$(extract_webhook_path "$filepath")
  local webhook_method
  webhook_method=$(extract_webhook_method "$filepath")
  
  # Current timestamp
  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  
  # Escape single quotes for SQL
  nodes_escaped=$(echo "$nodes" | sed "s/'/''/g")
  connections_escaped=$(echo "$connections" | sed "s/'/''/g")
  settings_escaped=$(echo "$settings" | sed "s/'/''/g")
  static_data_escaped=$(echo "$static_data" | sed "s/'/''/g")
  
  # Insert workflow with deferred constraints
  local sql="
BEGIN;
SET CONSTRAINTS ALL DEFERRED;

-- 1. Insert workflow_entity (without activeVersionId first)
INSERT INTO workflow_entity (
  id, name, active, nodes, connections, settings, \"staticData\", 
  \"createdAt\", \"updatedAt\", \"triggerCount\", \"versionId\", \"meta\"
) VALUES (
  '$workflow_id',
  '$name',
  true,
  '${nodes_escaped}'::jsonb,
  '${connections_escaped}'::jsonb,
  '${settings_escaped}'::jsonb,
  '${static_data_escaped}'::jsonb,
  '$now',
  '$now',
  $trigger_count,
  '$version_id',
  '{}'::jsonb
);

-- 2. Insert workflow_history
INSERT INTO workflow_history (
  \"versionId\", \"workflowId\", nodes, connections, \"createdAt\", \"authors\"
) VALUES (
  '$version_id',
  '$workflow_id',
  '${nodes_escaped}'::json,
  '${connections_escaped}'::json,
  '$now',
  'system'
);

-- 3. Update workflow_entity with activeVersionId
UPDATE workflow_entity 
SET \"activeVersionId\" = '$version_id'
WHERE id = '$workflow_id';

-- 4. Insert shared_workflow (share with project)
INSERT INTO shared_workflow (
  role, \"createdAt\", \"updatedAt\", \"workflowId\", \"projectId\"
) VALUES (
  'workflow:owner',
  '$now',
  '$now',
  '$workflow_id',
  '$N8N_PROJECT_ID'
);
"

  # 5. Add webhook_entity if workflow has webhook node
  if [ -n "$webhook_path" ] && [ "$webhook_path" != "null" ]; then
    local webhook_id
    webhook_id=$(generate_id 36)
    
    sql+="
-- 5. Insert webhook_entity
INSERT INTO webhook_entity (
  id, \"webhookPath\", method, node, \"workflowId\", \"pathLength\", \"webhookId\"
) VALUES (
  '$webhook_id',
  '$webhook_path',
  '$webhook_method',
  'Webhook',
  '$workflow_id',
  1,
  NULL
);
"
  fi
  
  sql+="
COMMIT;
"

  # Execute SQL
  if echo "$sql" | run_sql_file > /dev/null 2>&1; then
    echo -e "${GREEN}  [OK] $name imported and activated (ID: $workflow_id)${NC}"
    if [ -n "$webhook_path" ] && [ "$webhook_path" != "null" ]; then
      echo -e "${BLUE}       Webhook: /$webhook_path ($webhook_method)${NC}"
    fi
  else
    echo -e "${RED}  [FAIL] Failed to import $name${NC}"
    # Try to get error details
    echo "$sql" | docker exec -i "$POSTGRES_CONTAINER" psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" 2>&1 | head -5
    return 1
  fi
}

# Main execution
echo ""
if [ "$CHECK_ONLY" = true ]; then
  echo -e "${YELLOW}=== Checking workflows (dry run) ===${NC}"
else
  echo -e "${YELLOW}=== Importing AI workflows ===${NC}"
fi
echo ""

success_count=0
fail_count=0

for file in "${AI_WORKFLOWS[@]}"; do
  echo -e "Processing: $file"
  if import_workflow "$file"; then
    ((success_count++))
  else
    ((fail_count++))
  fi
done

echo ""
echo "========================================"
echo -e "Results: ${GREEN}$success_count success${NC}, ${RED}$fail_count failed${NC}"
echo "========================================"

# Restart n8n workers to pick up new workflows
if [ "$CHECK_ONLY" = false ] && [ $success_count -gt 0 ]; then
  echo ""
  echo -e "${YELLOW}Restarting n8n workers to apply changes...${NC}"
  
  # Try different docker compose commands
  if command -v docker &> /dev/null; then
    docker compose restart n8n-worker 2>/dev/null || \
    docker-compose restart n8n-worker 2>/dev/null || \
    echo -e "${YELLOW}Could not restart n8n-worker automatically. Please restart manually.${NC}"
  fi
  
  echo -e "${GREEN}Done!${NC}"
fi

# Print webhook URLs
echo ""
echo "=== AI Webhook Endpoints ==="
echo "Health:     GET  /webhook/ai/health"
echo "Chat:       POST /webhook/ai/chat"
echo "Generate:   POST /webhook/ai/generate"
echo "Translate:  POST /webhook/ai/translate"
echo "Task:       POST /webhook/ai/task"
echo "Vision:     POST /webhook/ai/vision"
echo "Embeddings: POST /webhook/ai/embeddings"
echo ""

exit $fail_count
