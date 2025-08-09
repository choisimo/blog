# Blog Admin Panel

블로그 게시글 관리를 위한 웹 기반 관리자 패널

## 기능

- ✨ **게시글 CRUD**: 생성, 읽기, 수정, 삭제
- 📝 **마크다운 에디터**: 실시간 미리보기 지원
- 🏷️ **메타데이터 관리**: 제목, 카테고리, 태그, 요약 등
- 📋 **Frontmatter 자동 생성**: YAML 형식으로 메타데이터 자동 생성
- 📑 **Manifest 자동 업데이트**: 새 게시글 추가 시 자동으로 목록 업데이트
- 🔍 **검색 및 필터링**: 제목, 내용, 카테고리별 검색
- 🎯 **Git 통합**: Add, Commit, Push 원클릭 배포
- 📱 **반응형 디자인**: 데스크톱과 모바일 지원

## 설치 및 실행

### 1. 설치
```bash
chmod +x install.sh
./install.sh
```

### 2. 개발 서버 실행
```bash
# 전체 실행 (서버 + 클라이언트)
npm run dev:full

# 서버만 실행
npm run dev

# 클라이언트만 실행
npm run client
```

### 3. 접속
- **관리자 패널**: http://localhost:3000
- **API 서버**: http://localhost:5000

## 사용법

### 새 게시글 작성
1. 사이드바에서 "새 게시글" 클릭
2. 제목, 카테고리, 태그 등 메타데이터 입력
3. 마크다운으로 내용 작성
4. 미리보기 탭에서 확인
5. "저장" 버튼 클릭

### Git으로 배포
1. "Git 관리" 메뉴 이동
2. 변경사항 확인
3. 커밋 메시지 입력
4. "배포하기" 버튼 클릭 (Add → Commit → Push 자동 실행)

## 프로젝트 구조

```
blog-admin/
├── server.js                 # Express 서버
├── package.json              # 서버 의존성
├── client/                   # React 클라이언트
│   ├── src/
│   │   ├── components/       # React 컴포넌트
│   │   │   ├── Sidebar.js    # 사이드바
│   │   │   ├── PostList.js   # 게시글 목록
│   │   │   ├── PostEditor.js # 게시글 에디터
│   │   │   └── GitPanel.js   # Git 관리 패널
│   │   ├── App.js           # 메인 앱
│   │   └── index.js         # 진입점
│   └── package.json         # 클라이언트 의존성
└── README.md                # 이 파일
```

## API 엔드포인트

### 게시글
- `GET /api/posts` - 모든 게시글 조회
- `GET /api/posts/:year/:slug` - 특정 게시글 조회
- `POST /api/posts` - 새 게시글 생성
- `PUT /api/posts/:year/:slug` - 게시글 수정
- `DELETE /api/posts/:year/:slug` - 게시글 삭제

### Git
- `GET /api/git/status` - Git 상태 조회
- `POST /api/git/add` - 파일 스테이징
- `POST /api/git/commit` - 커밋
- `POST /api/git/push` - 푸시

### 메타데이터
- `GET /api/metadata` - 카테고리, 태그 목록 조회

## 자동 생성 기능

### Frontmatter
새 게시글 저장 시 자동으로 YAML frontmatter 생성:
```yaml
---
title: "게시글 제목"
excerpt: "게시글 요약..."
date: "2025-01-09"
category: "기술"
tags: ['React', 'JavaScript', 'Web']
readTime: "5분"
---
```

### Manifest 업데이트
새 게시글 추가 시 해당 연도의 `manifest.json` 자동 업데이트

### 슬러그 생성
제목에서 URL 친화적인 슬러그 자동 생성 (한글 → 영문 변환)

## 기술 스택

### 백엔드
- Node.js + Express
- simple-git (Git 작업)
- gray-matter (Frontmatter 처리)
- fs-extra (파일 시스템)

### 프론트엔드
- React 18
- React Router (라우팅)
- Axios (HTTP 클라이언트)
- React Markdown (마크다운 렌더링)
- React Syntax Highlighter (코드 하이라이팅)
- React Hot Toast (알림)
- Heroicons (아이콘)
- Tailwind CSS (스타일링)

## 주의사항

1. **Git 권한**: 서버가 블로그 디렉토리에 대한 Git 권한이 있어야 합니다.
2. **파일 권한**: 블로그 디렉토리에 대한 읽기/쓰기 권한이 필요합니다.
3. **포트**: 5000번(서버), 3000번(클라이언트) 포트가 사용 가능해야 합니다.

## 라이선스

MIT License