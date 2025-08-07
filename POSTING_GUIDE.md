# 블로그 게시글 작성 가이드

이 가이드는 블로그에 새로운 게시글을 작성하는 방법을 설명합니다.

## 📝 게시글 작성 방법

### 1. 파일 위치
새로운 게시글은 연도별 디렉토리에 Markdown 파일로 작성합니다:
```
public/posts/2025/your-post-title.md
```

### 2. 파일명 규칙
- 영문 소문자와 하이픈(-) 사용
- 공백 대신 하이픈 사용
- `.md` 확장자 필수

**예시:**
```
react-hooks-tutorial.md
javascript-performance-optimization.md
spring-boot-rest-api-guide.md
```

### 3. Frontmatter 작성
모든 게시글은 반드시 YAML frontmatter로 시작해야 합니다:

```yaml
---
title: "게시글 제목"
date: "2025-01-15"
category: "카테고리명"
tags: ["태그1", "태그2", "태그3"]
excerpt: "게시글 요약 (선택사항)"
readTime: 5
---
```

#### 필수 필드
- `title`: 게시글 제목 (따옴표로 감싸기)
- `date`: 작성일 (YYYY-MM-DD 형식)

#### 선택 필드
- `category`: 카테고리 (기본값: "기술")
- `tags`: 태그 배열
- `excerpt`: 게시글 요약 (없으면 본문 앞 200자 자동 생성)
- `readTime`: 예상 읽기 시간(분) (없으면 자동 계산)

### 4. 본문 작성
Frontmatter 다음에 Markdown으로 본문을 작성합니다:

```markdown
---
title: "React Hooks 완벽 가이드"
date: "2025-01-15"
category: "프론트엔드"
tags: ["React", "Hooks", "JavaScript"]
excerpt: "React Hooks의 기본 개념부터 고급 패턴까지 완벽 정리"
readTime: 10
---

# React Hooks 완벽 가이드

React Hooks는 함수형 컴포넌트에서 상태와 생명주기를 관리할 수 있게 해주는 강력한 기능입니다.

## useState Hook

useState는 가장 기본적인 Hook입니다:

\`\`\`javascript
import React, { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
    </div>
  );
}
\`\`\`

## useEffect Hook

useEffect는 사이드 이펙트를 처리합니다:

\`\`\`javascript
useEffect(() => {
  document.title = `Count: ${count}`;
}, [count]);
\`\`\`

## 결론

React Hooks를 잘 활용하면 더 깔끔하고 재사용 가능한 컴포넌트를 만들 수 있습니다.
```

## 🚀 게시글 발행 프로세스

### 자동 발행 (추천)
1. 새 Markdown 파일 작성
2. Git에 커밋 및 푸시
3. GitHub Actions가 자동으로 manifest 생성 및 배포

```bash
git add public/posts/2025/your-new-post.md
git commit -m "Add new post: Your Post Title"
git push origin main
```

### 수동 테스트 (선택사항)
로컬에서 테스트하고 싶다면:

```bash
# manifest 파일 생성
npm run generate-manifests

# 개발 서버 실행
npm run dev
```

## 📋 체크리스트

게시글 발행 전 확인사항:

- [ ] 파일명이 규칙에 맞는가? (소문자, 하이픈, .md)
- [ ] Frontmatter가 올바른 YAML 형식인가?
- [ ] `title`과 `date` 필드가 있는가?
- [ ] 코드 블록의 문법이 올바른가?
- [ ] 이미지 경로가 올바른가? (있는 경우)

## 💡 팁

### 카테고리 예시
- "프론트엔드"
- "백엔드" 
- "데이터베이스"
- "DevOps"
- "알고리즘"
- "리뷰"
- "일기"

### 태그 예시
- 기술: `["React", "JavaScript", "TypeScript"]`
- 언어: `["Python", "Java", "Go"]`
- 도구: `["Docker", "Git", "VS Code"]`

### 코드 하이라이팅
지원되는 언어:
```
javascript, typescript, python, java, go, rust, 
html, css, scss, json, yaml, bash, sql
```

### 이미지 추가 (선택사항)
이미지는 `public/images/` 디렉토리에 저장하고 다음과 같이 참조:

```markdown
![이미지 설명](/images/your-image.png)
```

## 🔧 문제 해결

### manifest.json 오류
만약 게시글이 표시되지 않는다면:
```bash
npm run generate-manifests
```

### 개발 서버 오류
캐시 문제인 경우:
```bash
rm -rf node_modules/.vite
npm run dev
```

## 📚 참고

- [Markdown 문법 가이드](https://www.markdownguide.org/)
- [YAML Frontmatter 가이드](https://jekyllrb.com/docs/front-matter/)
- [React Markdown 지원 문법](https://github.com/remarkjs/react-markdown)

---

게시글 작성에 문제가 있거나 제안사항이 있다면 이슈를 등록해 주세요.