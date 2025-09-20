#!/bin/bash

# Blog Backend API Integration Test Script
# Supports local or remote ("real deployment") targets.
# Enhancements:
#  - BASE_URL override via env or --base-url
#  - Optional automatic JWT admin login (ADMIN_USERNAME / ADMIN_PASSWORD)
#  - Negative auth checks (unauthorized create)
#  - Manifest + regeneration verification
#  - Structured exit codes (fails fast on critical errors)
#  - Minimal dependency on jq (graceful fallback)

set -euo pipefail
IFS=$'\n\t'

# ---------- Configuration & Argument Parsing ----------
COLOR=${COLOR:-1}

if [ "${COLOR}" = "1" ]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

default_base="http://localhost:5080/api/v1"
BASE_URL="${BASE_URL:-$default_base}"
ADMIN_BEARER_TOKEN="${ADMIN_BEARER_TOKEN:-your-admin-token-here}"
ADMIN_USERNAME="${ADMIN_USERNAME:-}"  # for JWT login flow
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"  # for JWT login flow
YEAR="${TEST_YEAR:-$(date +%Y)}"
TEST_SLUG="testeuseu-poseuteu"  # matches Korean example slug usage
SKIP_ADMIN=false
KEEP_POST=false
VERBOSE=0

print_usage() {
  cat <<USAGE
Usage: $0 [options]
Options:
  -b, --base-url URL      Target base URL (default: $default_base)
  -t, --token TOKEN       Explicit admin bearer/JWT token
  -u, --user USERNAME     Admin username (JWT auth flow)
  -p, --pass PASSWORD     Admin password (JWT auth flow)
  --skip-admin            Skip admin-only endpoints
  --keep-post             Do not delete test post at end
  -y, --year YYYY         Override test year (default: current)
  -v, --verbose           Verbose curl output
  -h, --help              Show this help
Environment variables:
  BASE_URL, ADMIN_BEARER_TOKEN, ADMIN_USERNAME, ADMIN_PASSWORD, COLOR=0|1
Exit codes:
  0 success, non-zero on first critical failure.
USAGE
}

while [ $# -gt 0 ]; do
  case "$1" in
    -b|--base-url) BASE_URL="$2"; shift 2;;
    -t|--token) ADMIN_BEARER_TOKEN="$2"; shift 2;;
    -u|--user) ADMIN_USERNAME="$2"; shift 2;;
    -p|--pass) ADMIN_PASSWORD="$2"; shift 2;;
    --skip-admin) SKIP_ADMIN=true; shift;;
    --keep-post) KEEP_POST=true; shift;;
    -y|--year) YEAR="$2"; shift 2;;
    -v|--verbose) VERBOSE=1; shift;;
    -h|--help) print_usage; exit 0;;
    *) echo "Unknown argument: $1" >&2; print_usage; exit 1;;
  esac
done

# Normalize BASE_URL (strip trailing slash)
BASE_URL="${BASE_URL%/}"
API_HEALTH="$BASE_URL/healthz"

# ---------- Helper Output Functions ----------
print_section() { echo -e "\n${BLUE}=== $1 ===${NC}"; }
print_test()    { echo -e "${YELLOW}-- $1${NC}"; }
print_ok()      { echo -e "${GREEN}✓ $1${NC}"; }
print_fail()    { echo -e "${RED}✗ $1${NC}"; }

# Curl wrapper (captures status code)
_curl() {
  local method="$1"; shift
  local url="$1"; shift
  local authHeader=()
  if [ -n "${ADMIN_BEARER_TOKEN}" ] && [ "${ADMIN_BEARER_TOKEN}" != "your-admin-token-here" ]; then
    authHeader=(-H "Authorization: Bearer ${ADMIN_BEARER_TOKEN}")
  fi
  local verboseFlag=()
  [ $VERBOSE -eq 1 ] && verboseFlag=(-v)
  curl -s -o /tmp/resp.json "${verboseFlag[@]}" -w "%{http_code}" -X "$method" "$url" "${authHeader[@]}" "$@"
}

show_response_pretty() {
  if command -v jq >/dev/null 2>&1; then
    jq . /tmp/resp.json || cat /tmp/resp.json
  else
    cat /tmp/resp.json
  fi
}

# ---------- Authentication (Optional JWT Login) ----------
maybe_login_jwt() {
  if [ "${ADMIN_BEARER_TOKEN}" != "your-admin-token-here" ]; then
    print_ok "Using provided token"
    return 0
  fi
  if [ -z "$ADMIN_USERNAME" ] || [ -z "$ADMIN_PASSWORD" ]; then
    print_section "Auth"; print_fail "No token and no credentials; proceeding without admin auth"; return 0
  fi
  print_section "Auth (JWT login)"
  print_test "POST /auth/login"
  local status
  status=$(curl -s -o /tmp/login.json -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")
  if [ "$status" != "200" ]; then
    cat /tmp/login.json; print_fail "Login failed (status $status)"; return 1
  fi
  if command -v jq >/dev/null 2>&1; then
    ADMIN_BEARER_TOKEN=$(jq -r '.data.token // empty' /tmp/login.json)
  else
    ADMIN_BEARER_TOKEN=$(sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' /tmp/login.json | head -n1)
  fi
  if [ -z "$ADMIN_BEARER_TOKEN" ]; then
    print_fail "Could not extract token"; return 1
  fi
  print_ok "Obtained JWT token"
}

# ---------- Tests ----------
check_server() {
  print_section "Health"
  print_test "GET /healthz"
  local status
  status=$(_curl GET "$API_HEALTH")
  show_response_pretty
  if [ "$status" != "200" ]; then
    print_fail "Health endpoint status $status"; exit 1
  fi
  print_ok "Server reachable"
}

posts_list() {
  print_section "Posts List"
  print_test "GET /posts?year=$YEAR&includeDrafts=true"
  local status
  status=$(_curl GET "$BASE_URL/posts?year=$YEAR&includeDrafts=true")
  show_response_pretty
  [ "$status" = "200" ] && print_ok "List fetched" || { print_fail "List failed ($status)"; exit 1; }
}

posts_create_requires_auth() {
  print_section "Auth Guard (Negative)"
  print_test "POST /posts without Authorization header"
  if [ "${ADMIN_BEARER_TOKEN}" != "your-admin-token-here" ]; then
    print_ok "Skipping negative test (token already set)"; return 0
  fi
  local status
  status=$(curl -s -o /tmp/neg.json -w "%{http_code}" -X POST "$BASE_URL/posts" -H 'Content-Type: application/json' -d '{"title":"neg test","year":"'$YEAR'"}')
  if [ "$status" = "401" ]; then
    print_ok "Unauthorized correctly rejected"
  else
    print_fail "Expected 401 got $status (protection may be disabled)"
  fi
}

posts_create() {
  print_section "Post Create"
  print_test "POST /posts (admin)"
  local payload
  payload='{\n  "title": "통합 테스트 포스트",\n  "slug": "'$TEST_SLUG'",\n  "year": "'$YEAR'",\n  "frontmatter": { "tags": ["integration"], "category": "Dev" },\n  "content": "본문입니다."\n}'
  local status
  status=$(_curl POST "$BASE_URL/posts" -H 'Content-Type: application/json' -d "$payload")
  show_response_pretty
  [ "$status" = "201" ] && print_ok "Post created" || { print_fail "Create failed ($status)"; exit 1; }
}

posts_get_single() {
  print_section "Post Get"
  print_test "GET /posts/$YEAR/$TEST_SLUG"
  local status
  status=$(_curl GET "$BASE_URL/posts/$YEAR/$TEST_SLUG")
  show_response_pretty
  [ "$status" = "200" ] && print_ok "Post retrieved" || { print_fail "Get failed ($status)"; exit 1; }
}

posts_update() {
  print_section "Post Update"
  print_test "PUT /posts/$YEAR/$TEST_SLUG set published=false"
  local payload
  payload='{ "frontmatter": { "published": false }, "content": "수정된 본문입니다." }'
  local status
  status=$(_curl PUT "$BASE_URL/posts/$YEAR/$TEST_SLUG" -H 'Content-Type: application/json' -d "$payload")
  show_response_pretty
  [ "$status" = "200" ] && print_ok "Post updated" || { print_fail "Update failed ($status)"; exit 1; }
}

posts_regenerate() {
  print_section "Manifest Regenerate"
  print_test "POST /posts/regenerate-manifests"
  local status
  status=$(_curl POST "$BASE_URL/posts/regenerate-manifests")
  show_response_pretty
  [ "$status" = "200" ] && print_ok "Manifests regenerated" || { print_fail "Regenerate failed ($status)"; exit 1; }
}

images_list() {
  print_section "Images List"
  print_test "GET /images?year=$YEAR&slug=$TEST_SLUG"
  local status
  status=$(_curl GET "$BASE_URL/images?year=$YEAR&slug=$TEST_SLUG")
  show_response_pretty
  [ "$status" = "200" ] && print_ok "Images list ok" || { print_fail "Images list failed ($status)"; exit 1; }
}

posts_delete() {
  print_section "Post Delete"
  print_test "DELETE /posts/$YEAR/$TEST_SLUG"
  local status
  status=$(_curl DELETE "$BASE_URL/posts/$YEAR/$TEST_SLUG")
  show_response_pretty
  [ "$status" = "200" ] && print_ok "Post deleted" || { print_fail "Delete failed ($status)"; exit 1; }
}

summary() {
  print_section "Summary"
  print_ok "All selected tests completed successfully"
  echo "Target: $BASE_URL"
  if [ "${ADMIN_BEARER_TOKEN}" != "your-admin-token-here" ]; then
    echo "Auth Mode: token used"
  else
    echo "Auth Mode: unprotected or not provided"
  fi
}

# ---------- Execution Flow ----------
check_server
maybe_login_jwt
posts_list
posts_create_requires_auth
if [ "$SKIP_ADMIN" = false ]; then
  posts_create
  posts_get_single
  posts_update
  posts_regenerate
  images_list || true
  if [ "$KEEP_POST" = false ]; then
    posts_delete
  else
    print_section "Cleanup"; print_ok "KEEP_POST=true -> skipping deletion"
  fi
fi
summary
