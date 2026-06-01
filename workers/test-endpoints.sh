#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'
# Test all API endpoints

API_URL="${1:-https://api.nodove.com}"
FAILURES=0

echo "Testing API endpoints at: $API_URL"
echo "================================================"

run_get_check() {
  local index="$1"
  local path="$2"

  echo -e "\n[${index}] Testing ${path}"
  if ! curl -fsS "${API_URL}${path}" | jq .; then
    echo "ERROR: ${path} failed" >&2
    FAILURES=$((FAILURES + 1))
  fi
}

run_post_check() {
  local index="$1"
  local path="$2"
  local payload="$3"

  echo -e "\n[${index}] Testing ${path}"
  if ! curl -fsS -X POST "${API_URL}${path}" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    | jq .; then
    echo "ERROR: ${path} failed" >&2
    FAILURES=$((FAILURES + 1))
  fi
}

run_get_check 1 "/healthz"
run_get_check 2 "/public/config"
run_get_check 3 "/api/v1/posts?page=1&limit=5"
run_get_check 4 "/api/v1/comments?postId=test"
run_post_check 5 "/api/v1/ai/sketch" '{"paragraph":"테스트 문단입니다.","postTitle":"테스트"}'
run_post_check 6 "/api/v1/ai/summarize" '{"input":"AI 요약 테스트","instructions":"요약해주세요"}'

echo -e "\n================================================"
if (( FAILURES > 0 )); then
  echo "Completed with ${FAILURES} failure(s)." >&2
  exit 1
fi

echo "All tests completed!"
