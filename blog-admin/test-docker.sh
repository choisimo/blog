#!/bin/bash

# Quick test script for Docker setup
echo "Testing Docker setup..."

# Check if docker and docker-compose are available
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed"  
    exit 1
fi

echo "✓ Docker and Docker Compose are available"

# Create a test blog directory structure
TEST_BLOG_DIR="/tmp/test-blog"
mkdir -p "$TEST_BLOG_DIR/public/posts"
echo "✓ Created test blog directory: $TEST_BLOG_DIR"

# Run setup with test directory
echo "Running setup with test directory..."
./setup-docker.sh "$TEST_BLOG_DIR"

echo "✓ Setup completed. Check http://localhost for the application."