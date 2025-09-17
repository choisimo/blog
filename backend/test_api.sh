#!/bin/bash

# API Testing Script - Extracted from TESTING.md
# This script executes all curl commands for testing the blog backend API

set -e  # Exit on any error

# Configuration
BASE_URL="http://localhost:5080/api/v1"
TOKEN="${ADMIN_BEARER_TOKEN:-your-admin-token-here}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_section() {
    echo -e "\n${BLUE}=== $1 ===${NC}"
}

print_test() {
    echo -e "${YELLOW}Testing: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if server is running
check_server() {
    print_section "Server Health Check"
    if curl -s "$BASE_URL/healthz" > /dev/null 2>&1; then
        print_success "Server is running"
    else
        print_error "Server is not running at $BASE_URL"
        echo "Please start the server first"
        exit 1
    fi
}

# Test functions
test_healthcheck() {
    print_section "Health Check"
    print_test "GET /healthz"
    curl -s "$BASE_URL/healthz"
    echo
    print_success "Health check completed"
}

test_posts_list() {
    print_section "Posts API - List"
    print_test "GET /posts?year=2025&includeDrafts=true"
    curl -s "$BASE_URL/posts?year=2025&includeDrafts=true" | jq . 2>/dev/null || curl -s "$BASE_URL/posts?year=2025&includeDrafts=true"
    echo
    print_success "Posts list completed"
}

test_posts_create() {
    print_section "Posts API - Create"
    print_test "POST /posts (admin)"
    
    if [ "$TOKEN" = "your-admin-token-here" ]; then
        print_error "Please set ADMIN_BEARER_TOKEN environment variable"
        return 1
    fi
    
    curl -s -X POST "$BASE_URL/posts" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "title": "테스트 포스트",
            "year": "2025",
            "frontmatter": { "tags": ["test"], "category": "Dev" },
            "content": "본문입니다."
        }' | jq . 2>/dev/null || curl -s -X POST "$BASE_URL/posts" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "title": "테스트 포스트",
            "year": "2025",
            "frontmatter": { "tags": ["test"], "category": "Dev" },
            "content": "본문입니다."
        }'
    echo
    print_success "Post creation completed"
}

test_posts_get() {
    print_section "Posts API - Get Single"
    print_test "GET /posts/2025/testeuseu-poseuteu"
    curl -s "$BASE_URL/posts/2025/testeuseu-poseuteu" | jq . 2>/dev/null || curl -s "$BASE_URL/posts/2025/testeuseu-poseuteu"
    echo
    print_success "Single post get completed"
}

test_posts_update() {
    print_section "Posts API - Update"
    print_test "PUT /posts/2025/testeuseu-poseuteu (admin)"
    
    if [ "$TOKEN" = "your-admin-token-here" ]; then
        print_error "Please set ADMIN_BEARER_TOKEN environment variable"
        return 1
    fi
    
    curl -s -X PUT "$BASE_URL/posts/2025/testeuseu-poseuteu" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "frontmatter": { "published": false },
            "content": "수정된 본문입니다."
        }' | jq . 2>/dev/null || curl -s -X PUT "$BASE_URL/posts/2025/testeuseu-poseuteu" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "frontmatter": { "published": false },
            "content": "수정된 본문입니다."
        }'
    echo
    print_success "Post update completed"
}

test_posts_delete() {
    print_section "Posts API - Delete"
    print_test "DELETE /posts/2025/testeuseu-poseuteu (admin)"
    
    if [ "$TOKEN" = "your-admin-token-here" ]; then
        print_error "Please set ADMIN_BEARER_TOKEN environment variable"
        return 1
    fi
    
    curl -s -X DELETE "$BASE_URL/posts/2025/testeuseu-poseuteu" \
        -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null || curl -s -X DELETE "$BASE_URL/posts/2025/testeuseu-poseuteu" \
        -H "Authorization: Bearer $TOKEN"
    echo
    print_success "Post deletion completed"
}

test_posts_regenerate() {
    print_section "Posts API - Regenerate Manifests"
    print_test "POST /posts/regenerate-manifests (admin)"
    
    if [ "$TOKEN" = "your-admin-token-here" ]; then
        print_error "Please set ADMIN_BEARER_TOKEN environment variable"
        return 1
    fi
    
    curl -s -X POST "$BASE_URL/posts/regenerate-manifests" \
        -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null || curl -s -X POST "$BASE_URL/posts/regenerate-manifests" \
        -H "Authorization: Bearer $TOKEN"
    echo
    print_success "Manifest regeneration completed"
}

test_images_list() {
    print_section "Images API - List"
    print_test "GET /images?year=2025&slug=my-post"
    curl -s "$BASE_URL/images?year=2025&slug=my-post" | jq . 2>/dev/null || curl -s "$BASE_URL/images?year=2025&slug=my-post"
    echo
    
    print_test "GET /images?dir=covers"
    curl -s "$BASE_URL/images?dir=covers" | jq . 2>/dev/null || curl -s "$BASE_URL/images?dir=covers"
    echo
    print_success "Images list completed"
}

test_images_upload() {
    print_section "Images API - Upload"
    print_test "POST /images/upload (admin)"
    
    if [ "$TOKEN" = "your-admin-token-here" ]; then
        print_error "Please set ADMIN_BEARER_TOKEN environment variable"
        return 1
    fi
    
    # Create a dummy image file for testing
    if [ ! -f "/tmp/test_image.jpg" ]; then
        echo "Creating dummy test image..."
        echo "dummy image content" > /tmp/test_image.txt
    fi
    
    echo "Note: Image upload test requires a real image file. Skipping actual upload."
    echo "To test manually: curl -s -X POST $BASE_URL/images/upload -H \"Authorization: Bearer \$TOKEN\" -F \"year=2025\" -F \"slug=my-post\" -F \"files=@/path/to/image.jpg\""
    print_success "Image upload test noted"
}

test_images_delete() {
    print_section "Images API - Delete"
    print_test "DELETE /images/2025/my-post/cover.png (admin)"
    
    if [ "$TOKEN" = "your-admin-token-here" ]; then
        print_error "Please set ADMIN_BEARER_TOKEN environment variable"
        return 1
    fi
    
    curl -s -X DELETE "$BASE_URL/images/2025/my-post/cover.png" \
        -H "Authorization: Bearer $TOKEN" | jq . 2>/dev/null || curl -s -X DELETE "$BASE_URL/images/2025/my-post/cover.png" \
        -H "Authorization: Bearer $TOKEN"
    echo
    print_success "Image deletion completed"
}

# Main execution
main() {
    echo -e "${GREEN}Blog Backend API Testing Script${NC}"
    echo -e "${BLUE}Extracted from TESTING.md${NC}"
    echo
    
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help, -h     Show this help message"
        echo "  --token TOKEN  Set admin bearer token"
        echo "  --skip-admin   Skip admin-only endpoints"
        echo
        echo "Environment variables:"
        echo "  ADMIN_BEARER_TOKEN  Admin token for authenticated endpoints"
        echo
        exit 0
    fi
    
    if [ "$1" = "--token" ] && [ -n "$2" ]; then
        TOKEN="$2"
        echo "Using provided token"
    fi
    
    SKIP_ADMIN=false
    if [ "$1" = "--skip-admin" ]; then
        SKIP_ADMIN=true
        echo "Skipping admin-only endpoints"
    fi
    
    # Check server availability
    check_server
    
    # Run tests
    test_healthcheck
    test_posts_list
    
    if [ "$SKIP_ADMIN" = false ]; then
        test_posts_create
        test_posts_get
        test_posts_update
        test_posts_regenerate
        test_images_list
        test_images_upload
        test_images_delete
        test_posts_delete  # Delete the test post last
    else
        test_posts_get
        test_images_list
    fi
    
    echo
    print_success "All tests completed!"
    echo
    echo -e "${YELLOW}Note: Set ADMIN_BEARER_TOKEN environment variable to test admin endpoints${NC}"
    echo -e "${YELLOW}Example: ADMIN_BEARER_TOKEN=your-token ./test_api.sh${NC}"
}

# Run main function with all arguments
main "$@"