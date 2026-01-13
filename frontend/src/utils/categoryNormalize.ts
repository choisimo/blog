/**
 * Category Normalization Utility
 *
 * 블로그 포스트의 카테고리 이름을 정규화하여
 * 다양한 형식의 카테고리 이름을 일관된 형태로 통합합니다.
 */

import type { BlogPost } from '@/types/blog';

/**
 * 카테고리 별칭 매핑
 * key: 정규화된 카테고리 이름
 * value: 해당 카테고리로 매핑될 수 있는 별칭들
 */
export const CATEGORY_ALIASES: Record<string, string[]> = {
  'AI & ML': [
    'AI/ML',
    'AI',
    'ML',
    'Machine Learning',
    'Artificial Intelligence',
    'ai-ml',
    'ai',
    'ml',
    'machine-learning',
    'Deep Learning',
    'deep-learning',
    'LLM',
    'llm',
    'NLP',
    'nlp',
  ],
  'Web Dev': [
    'Web Development',
    'Frontend',
    'Backend',
    'web-dev',
    'WebDev',
    'web',
    'frontend',
    'backend',
    'Full Stack',
    'fullstack',
    'React',
    'react',
    'Next.js',
    'nextjs',
    'Vue',
    'vue',
  ],
  'Algorithms': [
    'Algorithm',
    'Data Structures',
    'algorithms',
    'algorithm',
    'data-structures',
    'DSA',
    'dsa',
    'Coding',
    'coding',
    'Problem Solving',
    'problem-solving',
  ],
  'DevOps': [
    'Operations',
    'Infrastructure',
    'CI/CD',
    'devops',
    'ops',
    'infra',
    'cloud',
    'Cloud',
    'Docker',
    'docker',
    'Kubernetes',
    'k8s',
    'AWS',
    'aws',
    'GCP',
    'Azure',
  ],
  'System Design': [
    'Architecture',
    'system-design',
    'architecture',
    'Design',
    'design',
    'Distributed Systems',
    'distributed-systems',
  ],
  'Security': [
    'security',
    'Cybersecurity',
    'cybersecurity',
    'InfoSec',
    'infosec',
  ],
  'Database': [
    'database',
    'DB',
    'db',
    'SQL',
    'sql',
    'NoSQL',
    'nosql',
    'PostgreSQL',
    'MySQL',
    'MongoDB',
  ],
  'General': [
    'general',
    'Misc',
    'misc',
    'Other',
    'other',
    '기타',
  ],
};

// 역방향 매핑 캐시 (별칭 -> 정규화된 이름)
let reverseMapCache: Record<string, string> | null = null;

/**
 * 역방향 매핑 테이블 생성
 */
function getReverseMap(): Record<string, string> {
  if (reverseMapCache) return reverseMapCache;

  reverseMapCache = {};
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    // 정규화된 이름 자체도 매핑
    reverseMapCache[canonical.toLowerCase()] = canonical;
    // 모든 별칭 매핑
    for (const alias of aliases) {
      reverseMapCache[alias.toLowerCase()] = canonical;
    }
  }

  return reverseMapCache;
}

/**
 * 카테고리 이름을 정규화합니다.
 *
 * @param category - 원본 카테고리 이름
 * @returns 정규화된 카테고리 이름 (매핑이 없으면 원본 반환)
 *
 * @example
 * normalizeCategoryName('AI/ML') // 'AI & ML'
 * normalizeCategoryName('frontend') // 'Web Dev'
 * normalizeCategoryName('Unknown Category') // 'Unknown Category'
 */
export function normalizeCategoryName(category: string): string {
  if (!category) return 'General';

  const lower = category.toLowerCase().trim();
  const reverseMap = getReverseMap();

  return reverseMap[lower] || category;
}

/**
 * 블로그 포스트 배열에서 카테고리별 포스트 수를 계산합니다.
 * 카테고리 이름은 정규화되어 집계됩니다.
 *
 * @param posts - 블로그 포스트 배열
 * @returns 정규화된 카테고리 이름을 키로, 포스트 수를 값으로 하는 객체
 *
 * @example
 * const posts = [
 *   { category: 'AI/ML', ... },
 *   { category: 'AI & ML', ... },
 *   { category: 'frontend', ... },
 * ];
 * getCategoryCounts(posts)
 * // { 'AI & ML': 2, 'Web Dev': 1 }
 */
export function getCategoryCounts(posts: BlogPost[]): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const post of posts) {
    const normalized = normalizeCategoryName(post.category || 'General');
    counts[normalized] = (counts[normalized] || 0) + 1;
  }

  return counts;
}

/**
 * 카테고리별로 포스트를 그룹화합니다.
 * 카테고리 이름은 정규화됩니다.
 *
 * @param posts - 블로그 포스트 배열
 * @returns 정규화된 카테고리 이름을 키로, 포스트 배열을 값으로 하는 객체
 */
export function groupPostsByCategory(posts: BlogPost[]): Record<string, BlogPost[]> {
  const groups: Record<string, BlogPost[]> = {};

  for (const post of posts) {
    const normalized = normalizeCategoryName(post.category || 'General');
    if (!groups[normalized]) {
      groups[normalized] = [];
    }
    groups[normalized].push(post);
  }

  return groups;
}

/**
 * 모든 고유한 정규화된 카테고리 목록을 반환합니다.
 * 포스트 수를 기준으로 내림차순 정렬됩니다.
 *
 * @param posts - 블로그 포스트 배열
 * @returns 카테고리 이름 배열 (포스트 수 내림차순)
 */
export function getUniqueCategories(posts: BlogPost[]): string[] {
  const counts = getCategoryCounts(posts);

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);
}

/**
 * 주어진 카테고리의 원본 변형들을 찾습니다.
 * (디버깅/관리용)
 *
 * @param posts - 블로그 포스트 배열
 * @param normalizedCategory - 정규화된 카테고리 이름
 * @returns 해당 카테고리로 정규화되는 원본 카테고리 이름들
 */
export function findCategoryVariants(
  posts: BlogPost[],
  normalizedCategory: string
): string[] {
  const variants = new Set<string>();

  for (const post of posts) {
    const original = post.category || 'General';
    const normalized = normalizeCategoryName(original);

    if (normalized === normalizedCategory) {
      variants.add(original);
    }
  }

  return Array.from(variants);
}
