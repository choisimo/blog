#!/bin/bash
# Purge Cloudflare cache for noblog.nodove.com
#
# Usage:
#   ./scripts/purge-cloudflare-cache.sh
#
# Prerequisites:
#   - CLOUDFLARE_API_TOKEN environment variable or ~/.cloudflare-token file
#   - curl and jq installed
#
# To get your Zone ID:
#   1. Go to https://dash.cloudflare.com
#   2. Select your domain (nodove.com)
#   3. Zone ID is shown on the right sidebar under "API"

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧹 Cloudflare Cache Purge Tool"
echo "==============================="

# Get API token
if [ -n "$CLOUDFLARE_API_TOKEN" ]; then
    API_TOKEN="$CLOUDFLARE_API_TOKEN"
elif [ -f ~/.cloudflare-token ]; then
    API_TOKEN=$(cat ~/.cloudflare-token)
else
    echo -e "${RED}Error: No Cloudflare API token found${NC}"
    echo ""
    echo "Please set CLOUDFLARE_API_TOKEN environment variable or create ~/.cloudflare-token"
    echo ""
    echo "To create an API token:"
    echo "  1. Go to https://dash.cloudflare.com/profile/api-tokens"
    echo "  2. Create a token with 'Zone.Cache Purge' permission"
    exit 1
fi

# Get Zone ID - first try environment variable, then try to fetch
if [ -n "$CLOUDFLARE_ZONE_ID" ]; then
    ZONE_ID="$CLOUDFLARE_ZONE_ID"
else
    echo "📡 Fetching Zone ID for nodove.com..."
    
    ZONES_RESPONSE=$(curl -s -X GET \
        "https://api.cloudflare.com/client/v4/zones?name=nodove.com" \
        -H "Authorization: Bearer ${API_TOKEN}" \
        -H "Content-Type: application/json")
    
    ZONE_ID=$(echo "$ZONES_RESPONSE" | jq -r '.result[0].id // empty')
    
    if [ -z "$ZONE_ID" ]; then
        echo -e "${RED}Error: Could not find Zone ID for nodove.com${NC}"
        echo "API Response: $ZONES_RESPONSE"
        echo ""
        echo "Please set CLOUDFLARE_ZONE_ID environment variable manually"
        exit 1
    fi
    
    echo -e "${GREEN}Found Zone ID: ${ZONE_ID}${NC}"
    echo ""
    echo "💡 Tip: Add this to GitHub Secrets for automated cache purge:"
    echo "   gh secret set CLOUDFLARE_ZONE_ID --body \"${ZONE_ID}\" --repo choisimo/blog"
fi

# Purge cache
echo ""
echo "🚀 Purging cache for noblog.nodove.com..."

PURGE_RESPONSE=$(curl -s -X POST \
    "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
    -H "Authorization: Bearer ${API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data '{"hosts":["noblog.nodove.com"]}')

SUCCESS=$(echo "$PURGE_RESPONSE" | jq -r '.success')

if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ Cache purged successfully!${NC}"
    echo ""
    echo "The site should now show the latest content."
    echo "Note: It may take a few seconds for changes to propagate globally."
else
    echo -e "${RED}❌ Cache purge failed${NC}"
    echo "Response: $PURGE_RESPONSE"
    exit 1
fi
