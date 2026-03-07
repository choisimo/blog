#!/bin/bash
# Test all API endpoints

API_URL="${1:-https://api.nodove.com}"
echo "Testing API endpoints at: $API_URL"
echo "================================================"

# Health check
echo -e "\n[1] Testing /healthz"
curl -s "$API_URL/healthz" | jq .

# Public config
echo -e "\n[2] Testing /public/config"
curl -s "$API_URL/public/config" | jq .

# Posts list
echo -e "\n[3] Testing /api/v1/posts"
curl -s "$API_URL/api/v1/posts?page=1&limit=5" | jq .

# Comments list
echo -e "\n[4] Testing /api/v1/comments"
curl -s "$API_URL/api/v1/comments?postId=test" | jq .

# AI Sketch
echo -e "\n[5] Testing /api/v1/ai/sketch"
curl -s -X POST "$API_URL/api/v1/ai/sketch" \
  -H "Content-Type: application/json" \
  -d '{"paragraph":"테스트 문단입니다.","postTitle":"테스트"}' \
  | jq .

# AI Summarize
echo -e "\n[6] Testing /api/v1/ai/summarize"
curl -s -X POST "$API_URL/api/v1/ai/summarize" \
  -H "Content-Type: application/json" \
  -d '{"input":"AI 요약 테스트","instructions":"요약해주세요"}' \
  | jq .

echo -e "\n================================================"
echo "All tests completed!"
