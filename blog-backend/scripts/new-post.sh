#!/bin/bash
# =====================================
# new-post.sh - 새 블로그 게시글 생성 스크립트
# =====================================
# 사용법: ./scripts/new-post.sh "게시글-제목" [카테고리]
# 예시: ./scripts/new-post.sh "kubernetes-deployment-guide" "DevOps"
#       ./scripts/new-post.sh "react-hooks-deep-dive"
# =====================================

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 프로젝트 루트 경로 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
POSTS_DIR="$PROJECT_ROOT/frontend/public/posts"
IMAGES_DIR="$PROJECT_ROOT/frontend/public/images"

# 현재 연도 가져오기
YEAR=$(date +%Y)
TODAY=$(date +%Y-%m-%d)

# 사용법 출력
usage() {
    echo -e "${BLUE}=======================================${NC}"
    echo -e "${BLUE}  새 블로그 게시글 생성 스크립트${NC}"
    echo -e "${BLUE}=======================================${NC}"
    echo ""
    echo -e "사용법: $0 \"게시글-제목\" [카테고리]"
    echo ""
    echo -e "예시:"
    echo -e "  $0 \"kubernetes-deployment-guide\" \"DevOps\""
    echo -e "  $0 \"react-hooks-deep-dive\" \"Web\""
    echo -e "  $0 \"my-first-post\"  # 카테고리 기본값: 기술"
    echo ""
    echo -e "카테고리 옵션:"
    echo -e "  기술, Java, DevOps, Algorithm, 시스템, 개발,"
    echo -e "  철학-and-사유, Network, Linux, Database, AI, Web"
    echo ""
    exit 1
}

# 인자 확인
if [ -z "$1" ]; then
    usage
fi

# 게시글 제목 (파일명용)
POST_SLUG="$1"
CATEGORY="${2:-기술}"

# 타이틀 생성 (slug에서 읽기 좋은 제목으로 변환)
TITLE=$(echo "$POST_SLUG" | sed 's/-/ /g' | sed 's/\b\(.\)/\u\1/g')

# 연도별 디렉토리 경로
POST_YEAR_DIR="$POSTS_DIR/$YEAR"
IMAGE_DIR="$IMAGES_DIR/$YEAR/$POST_SLUG"

# 파일 경로
POST_FILE="$POST_YEAR_DIR/$POST_SLUG.md"

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}  새 블로그 게시글 생성${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

# 이미 존재하는지 확인
if [ -f "$POST_FILE" ]; then
    echo -e "${RED}오류: 게시글이 이미 존재합니다!${NC}"
    echo -e "  파일: $POST_FILE"
    echo ""
    read -p "기존 파일을 열까요? (y/N): " open_existing
    if [[ "$open_existing" =~ ^[Yy]$ ]]; then
        code "$POST_FILE" 2>/dev/null || echo "VSCode로 열 수 없습니다: $POST_FILE"
    fi
    exit 1
fi

# 게시글 디렉토리 생성
if [ ! -d "$POST_YEAR_DIR" ]; then
    mkdir -p "$POST_YEAR_DIR"
    echo -e "${GREEN}✓ 게시글 디렉토리 생성: $POST_YEAR_DIR${NC}"
fi

# 이미지 디렉토리 생성
mkdir -p "$IMAGE_DIR"
echo -e "${GREEN}✓ 이미지 디렉토리 생성: $IMAGE_DIR${NC}"

# 게시글 템플릿 생성
cat > "$POST_FILE" << EOF
---
title: "$TITLE"
date: "$TODAY"
category: "$CATEGORY"
tags: ["$CATEGORY", "태그2", "태그3"]
excerpt: "게시글 요약을 작성하세요"
readTime: "5분"
---

# $TITLE

## 개요

여기에 개요를 작성하세요.

## 본문

본문 내용을 작성하세요.

### 이미지 삽입 예시

이미지를 드래그 앤 드랍하거나, 아래 형식으로 직접 삽입할 수 있습니다:

\`\`\`markdown
![이미지 설명](/images/$YEAR/$POST_SLUG/image-name.png)
\`\`\`

### 코드 블록 예시

\`\`\`javascript
// 코드를 작성하세요
console.log("Hello, Blog!");
\`\`\`

## 결론

결론을 작성하세요.

## 참고 자료

- [참고 링크 1](https://example.com)
- [참고 링크 2](https://example.com)
EOF

echo -e "${GREEN}✓ 게시글 파일 생성: $POST_FILE${NC}"

# README 파일 생성 (이미지 폴더에)
cat > "$IMAGE_DIR/.gitkeep" << EOF
# 이 파일은 빈 디렉토리를 Git에 포함시키기 위해 존재합니다.
# 이미지를 이 폴더에 추가하세요.
# 
# 게시글: $POST_SLUG
# 생성일: $TODAY
EOF

echo ""
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}  게시글 생성 완료!${NC}"
echo -e "${GREEN}=======================================${NC}"
echo ""
echo -e "게시글 파일: ${YELLOW}$POST_FILE${NC}"
echo -e "이미지 폴더: ${YELLOW}$IMAGE_DIR${NC}"
echo ""
echo -e "${BLUE}팁:${NC}"
echo -e "  1. VSCode에서 'newpost' 스니펫을 사용하여 템플릿을 빠르게 생성할 수 있습니다"
echo -e "  2. 이미지는 Ctrl+V로 붙여넣으면 자동으로 이미지 폴더에 저장됩니다"
echo -e "  3. 'img' 스니펫으로 이미지 경로를 빠르게 입력할 수 있습니다"
echo ""

# VSCode로 파일 열기 시도
if command -v code &> /dev/null; then
    read -p "VSCode에서 게시글을 열까요? (Y/n): " open_vscode
    if [[ ! "$open_vscode" =~ ^[Nn]$ ]]; then
        code "$POST_FILE"
        echo -e "${GREEN}✓ VSCode에서 게시글을 열었습니다${NC}"
    fi
else
    echo -e "${YELLOW}참고: VSCode CLI가 설치되어 있지 않습니다.${NC}"
    echo -e "게시글 파일을 수동으로 열어주세요: $POST_FILE"
fi
