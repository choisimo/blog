import { BlogPost } from '@/types/blog';

// 실제 프로젝트에서는 이 데이터를 마크다운 파일에서 동적으로 로드할 수 있습니다
export const posts: BlogPost[] = [
  {
    id: '1',
    title: 'React와 TypeScript로 블로그 만들기',
    description: 'React와 TypeScript를 사용해서 정적 블로그를 만드는 방법을 알아보겠습니다.',
    date: '2024-01-15',
    category: 'Development',
    tags: ['React', 'TypeScript', 'Blog'],
    slug: 'react-typescript-blog',
    content: `# React와 TypeScript로 블로그 만들기

React와 TypeScript를 사용해서 정적 블로그를 만드는 것은 매우 흥미로운 프로젝트입니다.

## 왜 React로 블로그를 만들까요?

- **컴포넌트 기반**: 재사용 가능한 컴포넌트로 일관성 있는 UI 구축
- **TypeScript 지원**: 타입 안정성으로 더 안전한 코드 작성
- **생태계**: 풍부한 라이브러리와 도구들

## 구현 과정

1. 프로젝트 설정
2. 블로그 구조 설계
3. 마크다운 파싱
4. 라우팅 설정

\`\`\`typescript
interface BlogPost {
  id: string;
  title: string;
  content: string;
}
\`\`\`

이제 시작해보세요!`,
    readTime: 5
  },
  {
    id: '2',
    title: 'GitHub Pages 배포 자동화',
    description: 'GitHub Actions를 사용해서 자동으로 블로그를 배포하는 방법을 설명합니다.',
    date: '2024-01-10',
    category: 'DevOps',
    tags: ['GitHub Pages', 'CI/CD', 'Automation'],
    slug: 'github-pages-automation',
    content: `# GitHub Pages 배포 자동화

GitHub Actions를 사용하면 코드를 푸시할 때마다 자동으로 사이트가 배포됩니다.

## GitHub Actions 설정

\`.github/workflows/deploy.yml\` 파일을 생성하고 다음과 같이 설정합니다:

\`\`\`yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
\`\`\`

## 장점

- 자동화된 배포
- 빠른 피드백
- 안정적인 프로세스`,
    readTime: 3
  },
  {
    id: '3',
    title: 'CSS Grid와 Flexbox 마스터하기',
    description: 'Modern CSS 레이아웃 기법인 Grid와 Flexbox를 완전히 이해하고 실무에 적용하는 방법',
    date: '2024-01-08',
    category: 'CSS',
    tags: ['CSS', 'Grid', 'Flexbox', 'Layout'],
    slug: 'css-grid-flexbox-master',
    content: `# CSS Grid와 Flexbox 마스터하기

Modern CSS의 핵심인 Grid와 Flexbox를 완전히 마스터해보세요.

## CSS Grid

Grid는 2차원 레이아웃 시스템입니다.

\`\`\`css
.container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}
\`\`\`

## Flexbox

Flexbox는 1차원 레이아웃에 최적화되어 있습니다.

\`\`\`css
.flex-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
\`\`\``,
    readTime: 7
  }
];

export const getPostBySlug = (slug: string): BlogPost | undefined => {
  return posts.find(post => post.slug === slug);
};

export const getPostsByCategory = (category: string): BlogPost[] => {
  return posts.filter(post => post.category.toLowerCase() === category.toLowerCase());
};

export const getPostsByTag = (tag: string): BlogPost[] => {
  return posts.filter(post => 
    post.tags.some(t => t.toLowerCase() === tag.toLowerCase())
  );
};

export const getAllCategories = (): string[] => {
  const categories = new Set(posts.map(post => post.category));
  return Array.from(categories);
};

export const getAllTags = (): string[] => {
  const tags = new Set(posts.flatMap(post => post.tags));
  return Array.from(tags);
};