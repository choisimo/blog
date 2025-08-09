#!/bin/bash

# Docker Compose Setup Script for Blog Admin
# 사용법: ./setup-docker.sh [blog-project-path]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Blog Admin Docker Setup${NC}"
echo "=============================="

# Get blog project path from argument or prompt
if [ -n "$1" ]; then
    BLOG_PATH="$1"
else
    echo -e "${YELLOW}실제 블로그 프로젝트의 경로를 입력하세요:${NC}"
    read -p "Path: " BLOG_PATH
fi

# Validate blog path
if [ ! -d "$BLOG_PATH" ]; then
    echo -e "${RED}Error: 지정된 경로가 존재하지 않습니다: $BLOG_PATH${NC}"
    exit 1
fi

# Convert to absolute path
BLOG_PATH=$(realpath "$BLOG_PATH")
echo -e "${GREEN}블로그 프로젝트 경로: $BLOG_PATH${NC}"

# Create .env file
echo -e "${YELLOW}환경 변수 파일 생성 중...${NC}"
cp .env.example .env

# Update BLOG_DIR in .env
sed -i "s|BLOG_DIR=.*|BLOG_DIR=$BLOG_PATH|" .env

# Create posts directory if it doesn't exist
POSTS_DIR="$BLOG_PATH/public/posts"
if [ ! -d "$POSTS_DIR" ]; then
    echo -e "${YELLOW}Creating posts directory: $POSTS_DIR${NC}"
    mkdir -p "$POSTS_DIR"
fi

# Update docker-compose.yml with the correct blog path
echo -e "${YELLOW}Docker Compose 설정 업데이트 중...${NC}"
sed -i "s|./posts:/app/blog/public/posts|$POSTS_DIR:/app/blog/public/posts|" docker-compose.yml

# Build the client first
echo -e "${YELLOW}클라이언트 빌드 중...${NC}"
cd client
npm install
npm run build
cd ..

# Stop any existing containers
echo -e "${YELLOW}기존 컨테이너 정리 중...${NC}"
docker-compose down --remove-orphans

# Build and start containers
echo -e "${YELLOW}Docker 컨테이너 빌드 및 시작 중...${NC}"
docker-compose up --build -d

# Wait for services to be ready
echo -e "${YELLOW}서비스 시작 대기 중...${NC}"
sleep 10

# Check container status
echo -e "${YELLOW}컨테이너 상태 확인 중...${NC}"
docker-compose ps

# Show access URLs
echo ""
echo -e "${GREEN}설정 완료!${NC}"
echo "=============================="
echo -e "${GREEN}접속 URL:${NC}"
echo "  - Frontend (Nginx): http://localhost"
echo "  - Frontend (Direct): http://localhost:3000"
echo "  - Backend API: http://localhost:5000"
echo ""
echo -e "${GREEN}유용한 명령어:${NC}"
echo "  - 로그 확인: docker-compose logs -f"
echo "  - 컨테이너 중지: docker-compose down"
echo "  - 컨테이너 재시작: docker-compose restart"
echo "  - 볼륨 포함 완전 제거: docker-compose down -v"
echo ""
echo -e "${YELLOW}블로그 프로젝트 경로: $BLOG_PATH${NC}"
echo -e "${YELLOW}포스트 저장 경로: $POSTS_DIR${NC}"