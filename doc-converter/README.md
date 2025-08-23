# 문서 → 블로그 변환기 (Document to Blog Converter)

GitHub Pages 블로그를 위한 브라우저 기반 문서 변환 도구입니다. DOCX, PDF 문서를 개인적 경험담 스타일의 Markdown 블로그 포스트로 변환할 수 있습니다.

## ✨ 주요 기능

- **📄 문서 파싱**: DOCX, PDF 파일을 브라우저에서 직접 파싱
- **🤖 지능형 분할**: 문서를 여러 개의 블로그 포스트로 자동 분할
- **✍️ 스타일 변환**: 기술 문서를 개인적 경험담으로 변환
- **🌐 다국어 지원**: 한국어/영어 포스트 생성
- **📝 실시간 편집**: 생성된 포스트를 즉시 편집 가능
- **📦 일괄 다운로드**: ZIP 파일로 모든 포스트를 한번에 다운로드
- **🔒 프라이버시**: 100% 클라이언트 사이드 처리 (서버 전송 없음)

## 🚀 사용 방법

### 1. 문서 업로드

- DOCX 또는 PDF 파일을 드래그 앤 드롭하거나 파일 선택
- 최대 50MB까지 지원

### 2. 변환 설정

- 생성할 포스트 수 (1-15개)
- 언어 선택 (한국어/English)
- 글쓰기 스타일 선택:
  - 개인 경험담 (Personal Experience)
  - 학습 여정 (Learning Journey)
  - 문제 해결기 (Problem Solving)
  - 기술 회고 (Tech Reflection)

### 3. 포스트 생성 및 편집

- 자동으로 생성된 포스트 미리보기
- 필요시 각 포스트 개별 편집
- Frontmatter 및 내용 수정 가능

### 4. 다운로드 및 배포

- ZIP 파일로 모든 포스트 다운로드
- README와 배포 가이드 포함
- GitHub Pages에 바로 업로드 가능

## 🛠 기술 스택

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Document Parsing**:
  - Mammoth.js (DOCX)
  - PDF.js (PDF)
- **File Processing**: JSZip, FileSaver.js
- **Icons**: Lucide React

## 📦 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 빌드된 파일 미리보기
npm run preview
```

## 🏗 프로젝트 구조

```
doc-converter/
├── src/
│   ├── components/          # React 컴포넌트
│   │   ├── DocumentUploader.jsx
│   │   ├── DocumentPreview.jsx
│   │   ├── ConversionSettings.jsx
│   │   ├── PostGenerator.jsx
│   │   ├── PostPreview.jsx
│   │   └── PostDownloader.jsx
│   ├── utils/              # 유틸리티 함수
│   │   ├── browserDocumentParser.js
│   │   └── markdownGenerator.js
│   ├── stores/             # 상태 관리
│   │   └── documentStore.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## 🎯 주요 특징

### 브라우저 기반 처리

- 모든 문서 처리가 브라우저에서 실행
- 파일이 서버로 전송되지 않아 보안성 확보
- 오프라인에서도 작동 가능

### 지능형 문서 분할

- 섹션 헤더 자동 감지
- 적절한 길이로 포스트 분할
- 내용의 연관성을 고려한 그룹핑

### 경험담 스타일 변환

- 기술적 명령어를 개인적 경험으로 변환
- 읽기 쉬운 스토리텔링 형식
- 자연스러운 한국어/영어 표현

## 📝 생성되는 Markdown 형식

```markdown
---
title: '시리즈명 Part 1: 주요 토픽'
date: 2025-01-01
tags: ['docker', 'guide', 'experience']
series: '시리즈명'
part: 1
totalParts: 5
language: 'ko'
author: 'nodove'
category: 'infrastructure'
description: '실제 경험을 바탕으로 한 가이드입니다...'
---

이번에 새로운 시리즈를 시작하게 되었습니다...

## 주요 섹션

실제로 진행하면서 경험한 내용을 바탕으로...

다음 포스트에서 계속 이어가겠습니다...
```

## 🚀 GitHub Pages 배포

1. 생성된 ZIP 파일 다운로드
2. 압축 해제 후 `.md` 파일들을 블로그 저장소에 복사
3. Git commit & push
4. GitHub Actions가 자동으로 빌드 및 배포

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 라이선스

MIT License - 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

## 🙏 감사의 말

- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) - DOCX 파싱
- [PDF.js](https://mozilla.github.io/pdf.js/) - PDF 파싱
- [JSZip](https://stuk.github.io/jszip/) - ZIP 파일 생성
- [Tailwind CSS](https://tailwindcss.com/) - 스타일링
- [Lucide](https://lucide.dev/) - 아이콘

---

Made with ❤️ for GitHub Pages bloggers
