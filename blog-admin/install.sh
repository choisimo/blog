#!/bin/bash

echo "🚀 Blog Admin 설치 중..."

# 루트 디렉토리 의존성 설치
echo "📦 서버 의존성 설치 중..."
npm install

# 클라이언트 의존성 설치
echo "📦 클라이언트 의존성 설치 중..."
cd client
npm install
cd ..

echo "✅ 설치 완료!"
echo ""
echo "사용법:"
echo "  npm run dev:full  - 전체 개발 서버 실행 (서버 + 클라이언트)"
echo "  npm run dev       - 서버만 실행"
echo "  npm run client    - 클라이언트만 실행"
echo "  npm run build     - 프로덕션 빌드"
echo ""
echo "서버: http://localhost:5000"
echo "클라이언트: http://localhost:3000"