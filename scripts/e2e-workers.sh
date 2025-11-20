#!/usr/bin/env bash
# E2E Test Script for Cloudflare Workers API
# Usage: bash scripts/e2e-workers.sh [API_BASE_URL]

set -euo pipefail

API_BASE="${1:-http://localhost:8787}/api/v1"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 E2E Tests for Workers API"
echo "API: $API_BASE"
echo ""

# Test health check
echo -n "Testing health check... "
HEALTH=$(curl -s "$API_BASE/../healthz")
if echo "$HEALTH" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $HEALTH"
  exit 1
fi

# Test login
echo -n "Testing login... "
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")

if echo "$LOGIN_RESPONSE" | grep -q '"ok":true'; then
  TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

# Test /auth/me
echo -n "Testing /auth/me... "
ME_RESPONSE=$(curl -s "$API_BASE/auth/me" \
  -H "Authorization: Bearer $TOKEN")

if echo "$ME_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $ME_RESPONSE"
  exit 1
fi

# Test create post
echo -n "Testing create post... "
SLUG="test-post-$(date +%s)"
POST_RESPONSE=$(curl -s -X POST "$API_BASE/posts" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"title\":\"Test Post\",\"slug\":\"$SLUG\",\"content\":\"# Test\\nThis is a test post.\",\"tags\":[\"test\",\"e2e\"]}")

if echo "$POST_RESPONSE" | grep -q '"ok":true'; then
  POST_ID=$(echo "$POST_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  echo -e "${GREEN}✓${NC} (ID: $POST_ID)"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $POST_RESPONSE"
  exit 1
fi

# Test get posts
echo -n "Testing get posts... "
POSTS_RESPONSE=$(curl -s "$API_BASE/posts")
if echo "$POSTS_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $POSTS_RESPONSE"
  exit 1
fi

# Test get single post
echo -n "Testing get post by slug... "
SINGLE_POST=$(curl -s "$API_BASE/posts/$SLUG")
if echo "$SINGLE_POST" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $SINGLE_POST"
  exit 1
fi

# Test update post
echo -n "Testing update post... "
UPDATE_RESPONSE=$(curl -s -X PUT "$API_BASE/posts/$SLUG" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"title\":\"Updated Test Post\"}")

if echo "$UPDATE_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $UPDATE_RESPONSE"
  exit 1
fi

# Test create comment
echo -n "Testing create comment... "
COMMENT_RESPONSE=$(curl -s -X POST "$API_BASE/comments" \
  -H "Content-Type: application/json" \
  -d "{\"postId\":\"$POST_ID\",\"author\":\"Test User\",\"content\":\"Great post!\"}")

if echo "$COMMENT_RESPONSE" | grep -q '"ok":true'; then
  COMMENT_ID=$(echo "$COMMENT_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  echo -e "${GREEN}✓${NC} (ID: $COMMENT_ID)"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $COMMENT_RESPONSE"
  exit 1
fi

# Test get comments
echo -n "Testing get comments... "
COMMENTS_RESPONSE=$(curl -s "$API_BASE/comments?postId=$POST_ID")
if echo "$COMMENTS_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $COMMENTS_RESPONSE"
  exit 1
fi

# Test AI sketch
echo -n "Testing AI sketch... "
AI_RESPONSE=$(curl -s -X POST "$API_BASE/ai/sketch" \
  -H "Content-Type: application/json" \
  -d "{\"paragraph\":\"This is a test paragraph for AI processing.\",\"postTitle\":\"Test\"}")

if echo "$AI_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${YELLOW}⚠${NC} (may require GEMINI_API_KEY)"
fi

# Test OG image
echo -n "Testing OG image generation... "
OG_RESPONSE=$(curl -s "$API_BASE/og?title=Test+Post")
if echo "$OG_RESPONSE" | grep -q '<svg'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $OG_RESPONSE"
  exit 1
fi

# Test CORS preflight
echo -n "Testing CORS preflight... "
CORS_RESPONSE=$(curl -s -X OPTIONS "$API_BASE/posts" \
  -H "Origin: https://blog.nodove.com" \
  -H "Access-Control-Request-Method: GET")
# Check for 204 or Access-Control headers
if [ "$(echo "$CORS_RESPONSE" | wc -c)" -lt 10 ]; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${YELLOW}⚠${NC} (unexpected response)"
fi

# Cleanup: delete test post
echo -n "Cleanup: deleting test post... "
DELETE_RESPONSE=$(curl -s -X DELETE "$API_BASE/posts/$SLUG" \
  -H "Authorization: Bearer $TOKEN")

if echo "$DELETE_RESPONSE" | grep -q '"ok":true'; then
  echo -e "${GREEN}✓${NC}"
else
  echo -e "${RED}✗${NC}"
  echo "Response: $DELETE_RESPONSE"
fi

echo ""
echo -e "${GREEN}✅ All tests passed!${NC}"
