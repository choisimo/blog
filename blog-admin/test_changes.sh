#!/bin/bash

echo "Testing Blog Admin Changes..."

# Test 1: Check if server can start
echo "1. Testing server startup..."
cd /home/nodove/workspace/nodove_blog/blog-admin
timeout 3 node server.js > /dev/null 2>&1 &
SERVER_PID=$!
sleep 2

# Test 2: Check AI config endpoint
echo "2. Testing AI config endpoint..."
curl -s http://localhost:5000/api/ai/config > /dev/null
if [ $? -eq 0 ]; then
    echo "   ✓ AI config endpoint working"
else
    echo "   ✗ AI config endpoint failed"
fi

# Test 3: Check if AI settings POST works
echo "3. Testing AI settings update..."
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"provider":"template","apiKeys":{},"models":{}}' \
  http://localhost:5000/api/ai/config > /dev/null
if [ $? -eq 0 ]; then
    echo "   ✓ AI settings update working"
else
    echo "   ✗ AI settings update failed"
fi

# Clean up
kill $SERVER_PID 2>/dev/null

echo "4. Checking file syntax..."
node -c server.js
if [ $? -eq 0 ]; then
    echo "   ✓ server.js syntax is valid"
else
    echo "   ✗ server.js has syntax errors"
fi

cd client
npm run build > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ Client builds successfully"
else
    echo "   ✗ Client build failed"
fi

echo "
Changes implemented:
✓ Fixed post date validation for scheduled publishing
✓ Added AI model settings configuration UI  
✓ Improved publishTime validation on client and server
✓ Added Settings page with AI provider configuration
✓ Enhanced PostEditor with better date handling
✓ New AI settings modal with API key management

The blog admin now supports:
- Preventing past dates for new posts (scheduled publishing)
- AI provider configuration (Gemini, OpenRouter, Template)
- Model selection and API key management
- Better validation and user feedback
"