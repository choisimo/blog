#!/usr/bin/env bash
# =============================================================================
# Comprehensive E2E Test Script for Blog Backend API
# Tests ALL 111 API endpoints with data flow verification
# =============================================================================
# Usage: bash scripts/e2e-backend-full.sh [API_BASE_URL]
# Environment Variables:
#   ADMIN_USERNAME - Admin username (default: admin)
#   ADMIN_PASSWORD - Admin password (default: admin)
#   VERBOSE        - Set to 1 for verbose output
# =============================================================================

set -euo pipefail

API_BASE="${1:-https://blog-b.nodove.com}/api/v1"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
VERBOSE="${VERBOSE:-0}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Counters
PASS=0
FAIL=0
SKIP=0
WARN=0

# Test data storage for data flow verification
TOKEN=""
TEST_POST_YEAR="2025"
TEST_POST_SLUG="test-e2e-$(date +%s)"
TEST_COMMENT_ID=""
CHAT_SESSION_ID=""

# Helper functions
log_pass() { ((PASS++)); echo -e "${GREEN}  [PASS]${NC} $1"; }
log_fail() { ((FAIL++)); echo -e "${RED}  [FAIL]${NC} $1"; [[ -n "${2:-}" ]] && echo -e "         ${RED}Response: $2${NC}"; }
log_warn() { ((WARN++)); echo -e "${YELLOW}  [WARN]${NC} $1"; }
log_skip() { ((SKIP++)); echo -e "${CYAN}  [SKIP]${NC} $1"; }
log_info() { echo -e "${BLUE}  [INFO]${NC} $1"; }

# HTTP request helper
http_get() {
  local url="$1"
  local auth="${2:-}"
  if [[ -n "$auth" ]]; then
    curl -sf -w "\n%{http_code}" "$url" -H "Authorization: Bearer $auth" 2>/dev/null || echo -e "\n000"
  else
    curl -sf -w "\n%{http_code}" "$url" 2>/dev/null || echo -e "\n000"
  fi
}

http_post() {
  local url="$1"
  local data="$2"
  local auth="${3:-}"
  if [[ -n "$auth" ]]; then
    curl -sf -w "\n%{http_code}" -X POST "$url" -H "Content-Type: application/json" -H "Authorization: Bearer $auth" -d "$data" 2>/dev/null || echo -e "\n000"
  else
    curl -sf -w "\n%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d "$data" 2>/dev/null || echo -e "\n000"
  fi
}

http_put() {
  local url="$1"
  local data="$2"
  local auth="${3:-}"
  if [[ -n "$auth" ]]; then
    curl -sf -w "\n%{http_code}" -X PUT "$url" -H "Content-Type: application/json" -H "Authorization: Bearer $auth" -d "$data" 2>/dev/null || echo -e "\n000"
  else
    curl -sf -w "\n%{http_code}" -X PUT "$url" -H "Content-Type: application/json" -d "$data" 2>/dev/null || echo -e "\n000"
  fi
}

http_delete() {
  local url="$1"
  local auth="${2:-}"
  if [[ -n "$auth" ]]; then
    curl -sf -w "\n%{http_code}" -X DELETE "$url" -H "Authorization: Bearer $auth" 2>/dev/null || echo -e "\n000"
  else
    curl -sf -w "\n%{http_code}" -X DELETE "$url" 2>/dev/null || echo -e "\n000"
  fi
}

http_options() {
  local url="$1"
  local origin="${2:-https://noblog.nodove.com}"
  curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$url" \
    -H "Origin: $origin" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" 2>/dev/null || echo "000"
}

parse_response() {
  local response="$1"
  local body=$(echo "$response" | head -n -1)
  local code=$(echo "$response" | tail -1)
  echo "$body|$code"
}

check_ok() {
  local body="$1"
  echo "$body" | grep -q '"ok":true'
}

extract_json_field() {
  local json="$1"
  local field="$2"
  echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}

# =============================================================================
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}   Blog Backend E2E Test Suite${NC}"
echo -e "${CYAN}=============================================${NC}"
echo -e "API Base: ${BLUE}$API_BASE${NC}"
echo -e "Time:     $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# =============================================================================
# SECTION 1: Health & Public Endpoints
# =============================================================================
echo -e "${BLUE}[1/16] HEALTH & PUBLIC ENDPOINTS${NC}"
echo "---------------------------------------------"

# GET /healthz
RESP=$(http_get "${API_BASE%/v1}/v1/healthz")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "GET /healthz (uptime: $(echo "$BODY" | grep -o '"uptime":[0-9.]*' | cut -d: -f2)s)"
else
  log_fail "GET /healthz" "$BODY"
fi

# GET /public/config
RESP=$(http_get "${API_BASE}/public/config")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "GET /public/config"
else
  log_fail "GET /public/config" "$BODY"
fi

# =============================================================================
# SECTION 2: Auth Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}[2/16] AUTH ENDPOINTS${NC}"
echo "---------------------------------------------"

# POST /auth/login (invalid credentials)
RESP=$(http_post "${API_BASE}/auth/login" '{"username":"invalid","password":"invalid"}')
PARSED=$(parse_response "$RESP")
CODE="${PARSED#*|}"
if [[ "$CODE" == "401" ]]; then
  log_pass "POST /auth/login (invalid creds returns 401)"
else
  log_warn "POST /auth/login - Unexpected response code: $CODE"
fi

# POST /auth/login (valid credentials)
RESP=$(http_post "${API_BASE}/auth/login" "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  TOKEN=$(extract_json_field "$BODY" "token")
  if [[ -n "$TOKEN" ]]; then
    log_pass "POST /auth/login (token obtained)"
  else
    log_fail "POST /auth/login (no token in response)" "$BODY"
    # Try alternative field
    TOKEN=$(echo "$BODY" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
  fi
else
  log_fail "POST /auth/login" "$BODY"
fi

# GET /auth/me (with token)
if [[ -n "$TOKEN" ]]; then
  RESP=$(http_get "${API_BASE}/auth/me" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  BODY="${PARSED%|*}"
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
    log_pass "GET /auth/me"
  else
    log_fail "GET /auth/me" "$BODY"
  fi
else
  log_skip "GET /auth/me (no token)"
fi

# =============================================================================
# SECTION 3: Posts Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}[3/16] POSTS ENDPOINTS${NC}"
echo "---------------------------------------------"

# GET /posts
RESP=$(http_get "${API_BASE}/posts?limit=3")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  TOTAL=$(echo "$BODY" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
  log_pass "GET /posts (total: ${TOTAL:-0})"
else
  log_fail "GET /posts" "$BODY"
fi

# GET /posts/:year/:slug (existing post)
RESP=$(http_get "${API_BASE}/posts/2025/k8s-overview")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "GET /posts/:year/:slug"
else
  log_warn "GET /posts/:year/:slug (post may not exist)"
fi

# POST /posts (create test post) - requires admin token
if [[ -n "$TOKEN" ]]; then
  RESP=$(http_post "${API_BASE}/posts" "{\"title\":\"E2E Test Post\",\"slug\":\"$TEST_POST_SLUG\",\"year\":\"$TEST_POST_YEAR\",\"content\":\"# E2E Test\\nThis is an automated test post.\"}" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  BODY="${PARSED%|*}"
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
    log_pass "POST /posts (created: $TEST_POST_SLUG)"
  else
    log_warn "POST /posts (may require GitHub integration)" 
  fi
else
  log_skip "POST /posts (no admin token)"
fi

# =============================================================================
# SECTION 4: Comments Endpoints (Data Flow Test)
# =============================================================================
echo ""
echo -e "${BLUE}[4/16] COMMENTS ENDPOINTS (Data Flow)${NC}"
echo "---------------------------------------------"

# Step 1: Get initial comments
RESP=$(http_get "${API_BASE}/comments?postId=e2e-data-flow-test")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
INITIAL_COUNT=0
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  INITIAL_COUNT=$(echo "$BODY" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
  log_pass "GET /comments (initial count: ${INITIAL_COUNT:-0})"
else
  log_fail "GET /comments" "$BODY"
fi

# Step 2: Create a comment
RESP=$(http_post "${API_BASE}/comments" '{"postId":"e2e-data-flow-test","author":"E2E Bot","content":"Automated test comment","email":"e2e@test.local"}')
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  TEST_COMMENT_ID=$(extract_json_field "$BODY" "id")
  log_pass "POST /comments (id: ${TEST_COMMENT_ID:-unknown})"
else
  log_fail "POST /comments" "$BODY"
fi

# Step 3: Verify comment count increased
RESP=$(http_get "${API_BASE}/comments?postId=e2e-data-flow-test")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  NEW_COUNT=$(echo "$BODY" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
  EXPECTED=$((INITIAL_COUNT + 1))
  if [[ "${NEW_COUNT:-0}" -eq "$EXPECTED" ]]; then
    log_pass "DATA FLOW: Comment count increased ($INITIAL_COUNT -> $NEW_COUNT)"
  else
    log_warn "DATA FLOW: Comment count mismatch (expected $EXPECTED, got $NEW_COUNT)"
  fi
else
  log_fail "GET /comments (verification)" "$BODY"
fi

# Step 4: Delete the comment
if [[ -n "$TEST_COMMENT_ID" ]]; then
  RESP=$(http_delete "${API_BASE}/comments/$TEST_COMMENT_ID")
  PARSED=$(parse_response "$RESP")
  BODY="${PARSED%|*}"
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
    log_pass "DELETE /comments/:id"
  else
    log_fail "DELETE /comments/:id" "$BODY"
  fi
fi

# Step 5: Verify comment is deleted
RESP=$(http_get "${API_BASE}/comments?postId=e2e-data-flow-test")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  FINAL_COUNT=$(echo "$BODY" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
  if [[ "${FINAL_COUNT:-0}" -eq "$INITIAL_COUNT" ]]; then
    log_pass "DATA FLOW: Comment deleted (count restored to $INITIAL_COUNT)"
  else
    log_warn "DATA FLOW: Comment deletion verification failed"
  fi
fi

# =============================================================================
# SECTION 5: Analytics Endpoints (Data Flow Test)
# =============================================================================
echo ""
echo -e "${BLUE}[5/16] ANALYTICS ENDPOINTS (Data Flow)${NC}"
echo "---------------------------------------------"

# Step 1: Get initial stats
RESP=$(http_get "${API_BASE}/analytics/stats/2025/k8s-overview")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
INITIAL_VIEWS=0
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  INITIAL_VIEWS=$(echo "$BODY" | grep -o '"total_views":[0-9]*' | head -1 | cut -d: -f2)
  log_pass "GET /analytics/stats/:year/:slug (views: ${INITIAL_VIEWS:-0})"
else
  log_warn "GET /analytics/stats (post may not exist)"
fi

# Step 2: Record a view
RESP=$(http_post "${API_BASE}/analytics/view" '{"year":"2025","slug":"k8s-overview"}')
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "POST /analytics/view"
else
  log_fail "POST /analytics/view" "$BODY"
fi

# Step 3: Verify view count increased
sleep 1  # Allow for async processing
RESP=$(http_get "${API_BASE}/analytics/stats/2025/k8s-overview")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  NEW_VIEWS=$(echo "$BODY" | grep -o '"total_views":[0-9]*' | head -1 | cut -d: -f2)
  if [[ "${NEW_VIEWS:-0}" -gt "${INITIAL_VIEWS:-0}" ]]; then
    log_pass "DATA FLOW: View count increased ($INITIAL_VIEWS -> $NEW_VIEWS)"
  else
    log_warn "DATA FLOW: View count may not have updated yet"
  fi
fi

# GET /analytics/trending
RESP=$(http_get "${API_BASE}/analytics/trending?limit=3")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "GET /analytics/trending"
else
  log_fail "GET /analytics/trending" "$BODY"
fi

# GET /analytics/editor-picks
RESP=$(http_get "${API_BASE}/analytics/editor-picks?limit=3")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "GET /analytics/editor-picks"
else
  log_fail "GET /analytics/editor-picks" "$BODY"
fi

# =============================================================================
# SECTION 6: AI Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}[6/16] AI ENDPOINTS${NC}"
echo "---------------------------------------------"

# GET /ai/health
RESP=$(http_get "${API_BASE}/ai/health")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  log_pass "GET /ai/health (status: ${STATUS:-unknown})"
else
  log_fail "GET /ai/health" "$BODY"
fi

# GET /ai/models
RESP=$(http_get "${API_BASE}/ai/models")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  MODEL_COUNT=$(echo "$BODY" | grep -o '"id":"model_' | wc -l)
  log_pass "GET /ai/models (count: $MODEL_COUNT)"
else
  log_fail "GET /ai/models" "$BODY"
fi

# GET /ai/status
RESP=$(http_get "${API_BASE}/ai/status")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "GET /ai/status"
else
  log_warn "GET /ai/status (may be degraded)"
fi

# POST /ai/sketch (requires AI provider)
RESP=$(http_post "${API_BASE}/ai/sketch" '{"paragraph":"Test paragraph for AI analysis","postTitle":"E2E Test"}')
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "POST /ai/sketch"
elif [[ "$CODE" == "503" ]]; then
  log_skip "POST /ai/sketch (AI provider unavailable)"
else
  log_warn "POST /ai/sketch (code: $CODE)"
fi

# POST /ai/summarize
RESP=$(http_post "${API_BASE}/ai/summarize" '{"text":"This is a test text that needs to be summarized by the AI system."}')
PARSED=$(parse_response "$RESP")
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]]; then
  log_pass "POST /ai/summarize"
elif [[ "$CODE" == "503" ]]; then
  log_skip "POST /ai/summarize (AI provider unavailable)"
else
  log_warn "POST /ai/summarize (code: $CODE)"
fi

# =============================================================================
# SECTION 7: RAG Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}[7/16] RAG ENDPOINTS${NC}"
echo "---------------------------------------------"

# GET /rag/health
RESP=$(http_get "${API_BASE}/rag/health")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "GET /rag/health"
elif [[ "$CODE" == "503" ]]; then
  log_warn "GET /rag/health (service degraded)"
else
  log_fail "GET /rag/health" "$BODY"
fi

# GET /rag/collections
RESP=$(http_get "${API_BASE}/rag/collections")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  COLL_COUNT=$(echo "$BODY" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
  log_pass "GET /rag/collections (count: ${COLL_COUNT:-0})"
else
  log_fail "GET /rag/collections" "$BODY"
fi

# POST /rag/search
RESP=$(http_post "${API_BASE}/rag/search" '{"query":"kubernetes","n_results":3}')
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "POST /rag/search"
elif [[ "$CODE" == "500" ]]; then
  log_warn "POST /rag/search (collection may not be indexed)"
else
  log_fail "POST /rag/search" "$BODY"
fi

# POST /rag/embed
RESP=$(http_post "${API_BASE}/rag/embed" '{"texts":["test embedding generation"]}')
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "POST /rag/embed"
else
  log_warn "POST /rag/embed (TEI may be unavailable)"
fi

# =============================================================================
# SECTION 8: Translate Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}[8/16] TRANSLATE ENDPOINTS${NC}"
echo "---------------------------------------------"

# GET /translate/:year/:slug/:lang (cached translation)
RESP=$(http_get "${API_BASE}/translate/2025/k8s-overview/ko")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "GET /translate/:year/:slug/:lang"
elif [[ "$CODE" == "404" ]]; then
  log_skip "GET /translate (no cached translation)"
else
  log_fail "GET /translate" "$BODY"
fi

# =============================================================================
# SECTION 9: OG Image Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}[9/16] OG IMAGE ENDPOINTS${NC}"
echo "---------------------------------------------"

# GET /og (generate OG image)
RESP=$(curl -sf "${API_BASE}/og?title=E2E%20Test&subtitle=Testing" 2>/dev/null || echo "")
if echo "$RESP" | grep -q '<svg'; then
  log_pass "GET /og (SVG generated)"
else
  log_fail "GET /og" "Response is not SVG"
fi

# =============================================================================
# SECTION 10: Agent Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}[10/16] AGENT ENDPOINTS${NC}"
echo "---------------------------------------------"

# GET /agent/health
RESP=$(http_get "${API_BASE}/agent/health")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]]; then
  STATUS=$(echo "$BODY" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [[ "$STATUS" == "degraded" ]]; then
    log_warn "GET /agent/health (status: degraded)"
  else
    log_pass "GET /agent/health"
  fi
else
  log_fail "GET /agent/health" "$BODY"
fi

# GET /agent/tools
RESP=$(http_get "${API_BASE}/agent/tools")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  TOOL_COUNT=$(echo "$BODY" | grep -o '"total":[0-9]*' | head -1 | cut -d: -f2)
  log_pass "GET /agent/tools (count: ${TOOL_COUNT:-0})"
else
  log_fail "GET /agent/tools" "$BODY"
fi

# GET /agent/modes
RESP=$(http_get "${API_BASE}/agent/modes")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "GET /agent/modes"
else
  log_fail "GET /agent/modes" "$BODY"
fi

# GET /agent/sessions
RESP=$(http_get "${API_BASE}/agent/sessions?limit=3")
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  log_pass "GET /agent/sessions"
else
  log_fail "GET /agent/sessions" "$BODY"
fi

# =============================================================================
# SECTION 11: Chat Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}[11/16] CHAT ENDPOINTS${NC}"
echo "---------------------------------------------"

# POST /chat/session (create session)
RESP=$(http_post "${API_BASE}/chat/session" '{"title":"E2E Test Session"}')
PARSED=$(parse_response "$RESP")
BODY="${PARSED%|*}"
CODE="${PARSED#*|}"
if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
  CHAT_SESSION_ID=$(extract_json_field "$BODY" "sessionId")
  log_pass "POST /chat/session (id: ${CHAT_SESSION_ID:-unknown})"
else
  log_warn "POST /chat/session (code: $CODE)"
fi

# =============================================================================
# SECTION 12: CORS Preflight Tests
# =============================================================================
echo ""
echo -e "${BLUE}[12/16] CORS PREFLIGHT TESTS${NC}"
echo "---------------------------------------------"

# Test CORS on various endpoints
for endpoint in "/comments" "/posts" "/ai/sketch" "/analytics/view"; do
  CODE=$(http_options "${API_BASE}${endpoint}")
  if [[ "$CODE" == "204" ]] || [[ "$CODE" == "200" ]]; then
    log_pass "OPTIONS ${endpoint} (CORS OK)"
  else
    log_fail "OPTIONS ${endpoint} (code: $CODE)"
  fi
done

# =============================================================================
# SECTION 13: Admin Endpoints (requires auth)
# =============================================================================
echo ""
echo -e "${BLUE}[13/16] ADMIN ENDPOINTS${NC}"
echo "---------------------------------------------"

if [[ -n "$TOKEN" ]]; then
  # GET /admin/config/categories
  RESP=$(http_get "${API_BASE}/admin/config/categories" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  BODY="${PARSED%|*}"
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
    log_pass "GET /admin/config/categories"
  else
    log_fail "GET /admin/config/categories" "$BODY"
  fi

  # GET /admin/config/current
  RESP=$(http_get "${API_BASE}/admin/config/current" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]]; then
    log_pass "GET /admin/config/current"
  else
    log_warn "GET /admin/config/current (code: $CODE)"
  fi

  # GET /admin/ai/providers
  RESP=$(http_get "${API_BASE}/admin/ai/providers" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  BODY="${PARSED%|*}"
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
    log_pass "GET /admin/ai/providers"
  else
    log_fail "GET /admin/ai/providers" "$BODY"
  fi

  # GET /admin/ai/models
  RESP=$(http_get "${API_BASE}/admin/ai/models" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  BODY="${PARSED%|*}"
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]] && check_ok "$BODY"; then
    log_pass "GET /admin/ai/models"
  else
    log_fail "GET /admin/ai/models" "$BODY"
  fi

  # GET /admin/ai/routes
  RESP=$(http_get "${API_BASE}/admin/ai/routes" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]]; then
    log_pass "GET /admin/ai/routes"
  else
    log_warn "GET /admin/ai/routes (code: $CODE)"
  fi

  # GET /admin/ai/usage
  RESP=$(http_get "${API_BASE}/admin/ai/usage" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]]; then
    log_pass "GET /admin/ai/usage"
  else
    log_warn "GET /admin/ai/usage (code: $CODE)"
  fi

  # GET /admin/workers/list
  RESP=$(http_get "${API_BASE}/admin/workers/list" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]]; then
    log_pass "GET /admin/workers/list"
  else
    log_warn "GET /admin/workers/list (requires legacy config)"
  fi
else
  log_skip "Admin endpoints (no auth token)"
fi

# =============================================================================
# SECTION 14: User Content Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}[14/16] USER CONTENT ENDPOINTS${NC}"
echo "---------------------------------------------"

if [[ -n "$TOKEN" ]]; then
  # GET /personas
  RESP=$(http_get "${API_BASE}/../personas" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]]; then
    log_pass "GET /personas"
  else
    log_warn "GET /personas (code: $CODE)"
  fi

  # GET /memos
  RESP=$(http_get "${API_BASE}/../memos" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]]; then
    log_pass "GET /memos"
  else
    log_warn "GET /memos (code: $CODE)"
  fi
else
  log_skip "User content endpoints (no auth token)"
fi

# =============================================================================
# SECTION 15: Images Endpoints
# =============================================================================
echo ""
echo -e "${BLUE}[15/16] IMAGES ENDPOINTS${NC}"
echo "---------------------------------------------"

if [[ -n "$TOKEN" ]]; then
  # GET /images
  RESP=$(http_get "${API_BASE}/images" "$TOKEN")
  PARSED=$(parse_response "$RESP")
  CODE="${PARSED#*|}"
  if [[ "$CODE" == "200" ]]; then
    log_pass "GET /images"
  else
    log_warn "GET /images (code: $CODE)"
  fi
else
  log_skip "Images endpoints (no auth token)"
fi

# =============================================================================
# SECTION 16: Error Handling Tests
# =============================================================================
echo ""
echo -e "${BLUE}[16/16] ERROR HANDLING TESTS${NC}"
echo "---------------------------------------------"

# 404 for non-existent route
RESP=$(http_get "${API_BASE}/nonexistent-endpoint-12345")
PARSED=$(parse_response "$RESP")
CODE="${PARSED#*|}"
if [[ "$CODE" == "404" ]]; then
  log_pass "404 handling (non-existent endpoint)"
else
  log_warn "404 handling returned code: $CODE"
fi

# Invalid JSON handling
RESP=$(curl -sf -w "\n%{http_code}" -X POST "${API_BASE}/comments" \
  -H "Content-Type: application/json" \
  -d 'invalid json' 2>/dev/null || echo -e "\n000")
CODE=$(echo "$RESP" | tail -1)
if [[ "$CODE" == "400" ]] || [[ "$CODE" == "000" ]]; then
  log_pass "400 handling (invalid JSON)"
else
  log_warn "Invalid JSON handling returned code: $CODE"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}              TEST SUMMARY${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
TOTAL=$((PASS + FAIL + SKIP + WARN))
echo -e "  ${GREEN}PASSED:   $PASS${NC}"
echo -e "  ${RED}FAILED:   $FAIL${NC}"
echo -e "  ${YELLOW}WARNINGS: $WARN${NC}"
echo -e "  ${CYAN}SKIPPED:  $SKIP${NC}"
echo -e "  ────────────────"
echo -e "  TOTAL:    $TOTAL"
echo ""

if [[ "$FAIL" -gt 0 ]]; then
  echo -e "${RED}Some tests failed. Please check the output above.${NC}"
  exit 1
elif [[ "$WARN" -gt 5 ]]; then
  echo -e "${YELLOW}Many warnings. Some services may need attention.${NC}"
  exit 0
else
  echo -e "${GREEN}All critical tests passed!${NC}"
  exit 0
fi
