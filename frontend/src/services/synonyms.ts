/**
 * 기술 용어 동의어 사전
 * 
 * RAG 검색 품질 향상을 위한 용어 매핑 테이블
 * - 약어 ↔ 전체 이름
 * - 한국어 ↔ 영어
 * - 관련 개념 클러스터
 */

// ============================================================================
// Types
// ============================================================================

export interface SynonymEntry {
  /** 메인 키워드 */
  term: string;
  /** 동의어/관련어 목록 */
  synonyms: string[];
  /** 카테고리 (분류용) */
  category?: string;
}

// ============================================================================
// 동의어 사전 데이터
// ============================================================================

const SYNONYM_MAP: SynonymEntry[] = [
  // --- AI/ML ---
  {
    term: 'AI',
    synonyms: ['인공지능', 'artificial intelligence', '에이아이', 'machine learning', 'ML', '기계학습', '딥러닝', 'deep learning'],
    category: 'ai',
  },
  {
    term: 'LLM',
    synonyms: ['대규모 언어 모델', 'large language model', 'GPT', 'Claude', 'ChatGPT', '언어 모델', 'language model', 'transformer'],
    category: 'ai',
  },
  {
    term: 'RAG',
    synonyms: ['retrieval augmented generation', '검색 증강 생성', '검색 기반 생성', 'vector search', '벡터 검색'],
    category: 'ai',
  },
  {
    term: 'embedding',
    synonyms: ['임베딩', '벡터', 'vector', '표현 학습', 'representation'],
    category: 'ai',
  },
  {
    term: 'prompt',
    synonyms: ['프롬프트', '지시문', '명령어', 'prompt engineering', '프롬프트 엔지니어링'],
    category: 'ai',
  },
  {
    term: 'fine-tuning',
    synonyms: ['파인튜닝', '미세조정', '모델 튜닝', 'PEFT', 'LoRA'],
    category: 'ai',
  },
  {
    term: 'inference',
    synonyms: ['추론', '인퍼런스', 'model inference', '모델 추론'],
    category: 'ai',
  },
  
  // --- 생명과학 ---
  {
    term: 'DNA',
    synonyms: ['유전자', 'gene', 'genetics', '유전학', 'genome', '게놈', 'deoxyribonucleic acid', '디옥시리보핵산', 'RNA', '핵산'],
    category: 'biology',
  },
  {
    term: 'protein',
    synonyms: ['단백질', '아미노산', 'amino acid', 'peptide', '펩타이드'],
    category: 'biology',
  },
  {
    term: 'cell',
    synonyms: ['세포', '셀', 'cellular', '세포학', 'cytology'],
    category: 'biology',
  },
  
  // --- 프로그래밍/개발 ---
  {
    term: 'React',
    synonyms: ['리액트', 'ReactJS', 'React.js', 'JSX', 'hooks', '훅', '컴포넌트', 'component'],
    category: 'frontend',
  },
  {
    term: 'TypeScript',
    synonyms: ['타입스크립트', 'TS', '타스', 'JavaScript', 'JS', '자바스크립트'],
    category: 'frontend',
  },
  {
    term: 'API',
    synonyms: ['에이피아이', 'REST', 'RESTful', 'GraphQL', 'endpoint', '엔드포인트', 'HTTP', 'request'],
    category: 'backend',
  },
  {
    term: 'database',
    synonyms: ['데이터베이스', 'DB', '디비', 'SQL', 'NoSQL', 'PostgreSQL', 'MySQL', 'SQLite', 'D1'],
    category: 'backend',
  },
  {
    term: 'Docker',
    synonyms: ['도커', 'container', '컨테이너', 'containerization', 'Kubernetes', 'k8s', '쿠버네티스'],
    category: 'devops',
  },
  {
    term: 'CI/CD',
    synonyms: ['CICD', 'continuous integration', 'continuous deployment', '지속적 통합', '지속적 배포', 'GitHub Actions', 'pipeline'],
    category: 'devops',
  },
  {
    term: 'Cloudflare',
    synonyms: ['클라우드플레어', 'Workers', 'Edge', 'CDN', '엣지 컴퓨팅', 'edge computing', 'D1', 'R2', 'KV'],
    category: 'cloud',
  },
  
  // --- 네트워크/보안 ---
  {
    term: 'authentication',
    synonyms: ['인증', 'auth', 'login', '로그인', 'JWT', 'OAuth', 'SSO', 'session'],
    category: 'security',
  },
  {
    term: 'encryption',
    synonyms: ['암호화', 'crypto', '암호', 'SSL', 'TLS', 'HTTPS', 'AES', 'RSA'],
    category: 'security',
  },
  
  // --- 성능 ---
  {
    term: 'performance',
    synonyms: ['성능', '퍼포먼스', 'optimization', '최적화', 'latency', '지연시간', 'throughput', '처리량'],
    category: 'performance',
  },
  {
    term: 'caching',
    synonyms: ['캐싱', '캐시', 'cache', 'memoization', '메모이제이션', 'Redis'],
    category: 'performance',
  },
  
  // --- 일반 기술 용어 ---
  {
    term: 'algorithm',
    synonyms: ['알고리즘', 'algo', '알고', 'data structure', '자료구조'],
    category: 'cs',
  },
  {
    term: 'architecture',
    synonyms: ['아키텍처', '설계', 'design pattern', '디자인 패턴', 'system design', '시스템 설계'],
    category: 'cs',
  },
  {
    term: 'debugging',
    synonyms: ['디버깅', 'debug', '버그', 'bug', 'error', '에러', 'troubleshooting', '문제해결'],
    category: 'development',
  },
  {
    term: 'refactoring',
    synonyms: ['리팩토링', 'refactor', '리팩터', 'code quality', '코드 품질', 'clean code'],
    category: 'development',
  },
  
  // --- 블로그 관련 ---
  {
    term: 'blog',
    synonyms: ['블로그', 'post', '포스트', 'article', '글', '게시글', 'writing'],
    category: 'content',
  },
  {
    term: 'tutorial',
    synonyms: ['튜토리얼', 'guide', '가이드', 'how-to', '강좌', '강의', 'walkthrough'],
    category: 'content',
  },
];

// ============================================================================
// 빠른 조회를 위한 인덱스 생성
// ============================================================================

/** 모든 용어를 소문자로 정규화한 맵 */
const normalizedIndex = new Map<string, Set<string>>();

// 인덱스 초기화
function initializeIndex() {
  for (const entry of SYNONYM_MAP) {
    const allTerms = [entry.term, ...entry.synonyms];
    const normalizedTerms = allTerms.map(t => t.toLowerCase().trim());
    
    // 각 용어가 다른 모든 용어를 가리키도록 설정
    for (const term of normalizedTerms) {
      if (!normalizedIndex.has(term)) {
        normalizedIndex.set(term, new Set());
      }
      const synonymSet = normalizedIndex.get(term)!;
      for (const synonym of normalizedTerms) {
        if (synonym !== term) {
          synonymSet.add(synonym);
        }
      }
    }
  }
}

// 모듈 로드 시 인덱스 초기화
initializeIndex();

// ============================================================================
// Public API
// ============================================================================

/**
 * 주어진 용어의 동의어/관련어 목록 반환
 * 
 * @param term - 검색할 용어
 * @returns 동의어 배열 (원본 용어 제외)
 * 
 * @example
 * getSynonyms('DNA') // ['유전자', 'gene', 'genetics', '유전학', 'genome', ...]
 * getSynonyms('LLM') // ['대규모 언어 모델', 'GPT', 'Claude', ...]
 */
export function getSynonyms(term: string): string[] {
  const normalized = term.toLowerCase().trim();
  const synonyms = normalizedIndex.get(normalized);
  return synonyms ? Array.from(synonyms) : [];
}

/**
 * 쿼리에서 모든 용어의 동의어를 수집하여 확장 쿼리 후보 생성
 * 
 * @param query - 원본 검색 쿼리
 * @returns 확장된 쿼리 후보 배열 (원본 포함)
 * 
 * @example
 * expandQueryWithSynonyms('DNA 분석')
 * // ['DNA 분석', '유전자 분석', 'gene 분석', 'genetics 분석', ...]
 */
export function expandQueryWithSynonyms(query: string): string[] {
  const expanded: Set<string> = new Set([query]);
  const words = query.split(/\s+/);
  
  // 각 단어에 대해 동의어 확인
  for (const word of words) {
    const synonyms = getSynonyms(word);
    
    // 동의어로 대체한 쿼리 생성 (상위 3개만)
    for (const synonym of synonyms.slice(0, 3)) {
      const expandedQuery = query.replace(new RegExp(escapeRegExp(word), 'gi'), synonym);
      expanded.add(expandedQuery);
    }
  }
  
  // 2-gram, 3-gram 체크 (복합 용어)
  const queryLower = query.toLowerCase();
  for (const [term, synonyms] of normalizedIndex) {
    if (term.includes(' ') && queryLower.includes(term)) {
      for (const synonym of Array.from(synonyms).slice(0, 2)) {
        const expandedQuery = query.replace(new RegExp(escapeRegExp(term), 'gi'), synonym);
        expanded.add(expandedQuery);
      }
    }
  }
  
  return Array.from(expanded);
}

/**
 * 쿼리에서 키워드 추출 후 관련 키워드 반환
 * (검색 필터링에 사용)
 * 
 * @param query - 원본 검색 쿼리
 * @returns 관련 키워드 배열
 */
export function getRelatedKeywords(query: string): string[] {
  const keywords: Set<string> = new Set();
  const words = query.toLowerCase().split(/\s+/);
  
  for (const word of words) {
    keywords.add(word);
    const synonyms = getSynonyms(word);
    synonyms.forEach(s => keywords.add(s));
  }
  
  return Array.from(keywords);
}

/**
 * 카테고리 추론 (쿼리 기반)
 * 
 * @param query - 검색 쿼리
 * @returns 추론된 카테고리 목록
 */
export function inferCategories(query: string): string[] {
  const categories: Set<string> = new Set();
  const queryLower = query.toLowerCase();
  
  for (const entry of SYNONYM_MAP) {
    const allTerms = [entry.term, ...entry.synonyms];
    for (const term of allTerms) {
      if (queryLower.includes(term.toLowerCase())) {
        if (entry.category) {
          categories.add(entry.category);
        }
        break;
      }
    }
  }
  
  return Array.from(categories);
}

// ============================================================================
// Utilities
// ============================================================================

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 동의어 사전 통계 반환 (디버깅용)
 */
export function getSynonymStats(): { totalEntries: number; totalTerms: number; categories: string[] } {
  const categories = new Set<string>();
  for (const entry of SYNONYM_MAP) {
    if (entry.category) categories.add(entry.category);
  }
  
  return {
    totalEntries: SYNONYM_MAP.length,
    totalTerms: normalizedIndex.size,
    categories: Array.from(categories),
  };
}
