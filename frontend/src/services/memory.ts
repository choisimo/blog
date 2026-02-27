/**
 * Memory Service
 *
 * 사용자 메모리 저장 및 RAG 기반 검색 서비스
 * - D1 데이터베이스에 메모리 저장 (Workers API)
 * - ChromaDB에 임베딩 저장 (Backend RAG API)
 * - 채팅 컨텍스트에 관련 메모리 주입
 */

import { getApiBaseUrl } from '@/utils/apiBase';
import { MEMORY_DEFAULTS } from '@/config/defaults';

// ============================================================================
// Types
// ============================================================================

export interface UserMemory {
  id: string;
  userId: string;
  memoryType: 'fact' | 'preference' | 'context' | 'summary';
  category?: string;
  content: string;
  sourceType?: 'chat' | 'memo' | 'manual';
  sourceId?: string;
  importanceScore: number;
  accessCount: number;
  lastAccessedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title?: string;
  summary?: string;
  questionMode: 'general' | 'article';
  articleSlug?: string;
  messageCount: number;
  totalTokens: number;
  isArchived: boolean;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentType: 'text' | 'image' | 'code' | 'error';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface MemorySearchResult {
  id: string;
  document: string;
  metadata: {
    user_id: string;
    memory_type: string;
    category?: string;
    created_at: string;
  };
  distance: number;
  similarity: number;
}

// ============================================================================
// User ID Management
// ============================================================================

const USER_ID_KEY = 'memory.userId';

/**
 * 현재 사용자 ID 가져오기 (없으면 생성)
 */
export function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    userId = `user-${crypto.randomUUID()}`;
    localStorage.setItem(USER_ID_KEY, userId);
  }
  return userId;
}

/**
 * 사용자 ID 설정 (로그인 시)
 */
export function setUserId(id: string): void {
  localStorage.setItem(USER_ID_KEY, id);
}

// ============================================================================
// Memory CRUD API (Workers D1)
// ============================================================================

/**
 * 사용자 메모리 목록 조회
 */
export async function getMemories(options: {
  type?: string;
  category?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
} = {}): Promise<{ memories: UserMemory[]; total: number }> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (options.type) params.set('type', options.type);
  if (options.category) params.set('category', options.category);
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));

  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}?${params}`;

  const res = await fetch(url, {
    method: 'GET',
    signal: options.signal,
  });

  if (!res.ok) {
    throw new Error(`Failed to get memories: ${res.status}`);
  }

  const data = await res.json();
  return data.data || { memories: [], total: 0 };
}

/**
 * 메모리 생성
 */
export async function createMemory(memory: {
  content: string;
  memoryType?: string;
  category?: string;
  sourceType?: string;
  sourceId?: string;
  importanceScore?: number;
}): Promise<{ id: string }> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memory),
  });

  if (!res.ok) {
    throw new Error(`Failed to create memory: ${res.status}`);
  }

  const data = await res.json();
  const memoryId = data.data?.id;

  // 임베딩도 저장 (백그라운드)
  if (memoryId) {
    upsertMemoryEmbedding([{
      id: memoryId,
      content: memory.content,
      memoryType: memory.memoryType || 'fact',
      category: memory.category,
    }]).catch(console.error);
  }

  return data.data || { id: '' };
}

/**
 * 여러 메모리 일괄 생성
 */
export async function createMemoriesBatch(memories: Array<{
  content: string;
  memoryType?: string;
  category?: string;
  sourceType?: string;
  sourceId?: string;
  importanceScore?: number;
}>): Promise<{ ids: string[]; created: number }> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}/batch`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memories }),
  });

  if (!res.ok) {
    throw new Error(`Failed to create memories batch: ${res.status}`);
  }

  const data = await res.json();
  const result = data.data || { ids: [], created: 0 };

  // 임베딩도 저장 (백그라운드)
  if (result.ids.length > 0) {
    const memoriesToEmbed = memories.slice(0, result.ids.length).map((m, i) => ({
      id: result.ids[i],
      content: m.content,
      memoryType: m.memoryType || 'fact',
      category: m.category,
    }));
    upsertMemoryEmbedding(memoriesToEmbed).catch(console.error);
  }

  return result;
}

/**
 * 메모리 삭제
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}/${memoryId}`;

  const res = await fetch(url, { method: 'DELETE' });

  if (!res.ok) {
    throw new Error(`Failed to delete memory: ${res.status}`);
  }

  // 임베딩도 삭제 (백그라운드)
  deleteMemoryEmbedding(memoryId).catch(console.error);
}

// ============================================================================
// Memory RAG API (Backend ChromaDB)
// ============================================================================

/**
 * 메모리 임베딩 저장/업데이트
 */
export async function upsertMemoryEmbedding(memories: Array<{
  id: string;
  content: string;
  memoryType: string;
  category?: string;
}>): Promise<void> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/rag/memories/upsert`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, memories }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('Failed to upsert memory embedding:', res.status, text);
  }
}

/**
 * 메모리 임베딩 삭제
 */
export async function deleteMemoryEmbedding(memoryId: string): Promise<void> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/rag/memories/${userId}/${memoryId}`;

  const res = await fetch(url, { method: 'DELETE' });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn('Failed to delete memory embedding:', res.status, text);
  }
}

/**
 * 메모리 시맨틱 검색 (RAG)
 */
export async function searchMemories(
  query: string,
  options: {
    n_results?: number;
    memoryType?: string;
    category?: string;
    signal?: AbortSignal;
  } = {}
): Promise<MemorySearchResult[]> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/rag/memories/search`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        query,
        n_results: options.n_results || 10,
        memoryType: options.memoryType,
        category: options.category,
      }),
      signal: options.signal,
    });

    if (!res.ok) {
      console.warn('Memory search failed:', res.status);
      return [];
    }

    const data = await res.json();
    return data.data?.results || [];
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') return [];
    console.warn('Memory search error:', err);
    return [];
  }
}

// ============================================================================
// Chat Session API (Workers D1)
// ============================================================================

/**
 * 채팅 세션 목록 조회
 */
export async function getChatSessions(options: {
  limit?: number;
  offset?: number;
  includeArchived?: boolean;
  signal?: AbortSignal;
} = {}): Promise<{ sessions: ChatSession[] }> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.offset) params.set('offset', String(options.offset));
  if (options.includeArchived) params.set('includeArchived', 'true');

  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}/sessions?${params}`;

  const res = await fetch(url, {
    method: 'GET',
    signal: options.signal,
  });

  if (!res.ok) {
    throw new Error(`Failed to get chat sessions: ${res.status}`);
  }

  const data = await res.json();
  return data.data || { sessions: [] };
}

/**
 * 채팅 세션 생성
 */
export async function createChatSession(options: {
  title?: string;
  questionMode?: 'general' | 'article';
  articleSlug?: string;
}): Promise<{ id: string }> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}/sessions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    throw new Error(`Failed to create chat session: ${res.status}`);
  }

  const data = await res.json();
  return data.data || { id: '' };
}

/**
 * 채팅 세션 상세 조회 (메시지 포함)
 */
export async function getChatSession(sessionId: string, options: {
  limit?: number;
  signal?: AbortSignal;
} = {}): Promise<{ session: ChatSession; messages: ChatMessage[] }> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));

  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}/sessions/${sessionId}?${params}`;

  const res = await fetch(url, {
    method: 'GET',
    signal: options.signal,
  });

  if (!res.ok) {
    throw new Error(`Failed to get chat session: ${res.status}`);
  }

  const data = await res.json();
  return data.data || { session: null, messages: [] };
}

/**
 * 채팅 세션에 메시지 추가
 */
export async function addChatMessage(
  sessionId: string,
  message: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    contentType?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ id: string }> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}/sessions/${sessionId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    throw new Error(`Failed to add chat message: ${res.status}`);
  }

  const data = await res.json();
  return data.data || { id: '' };
}

/**
 * 여러 메시지 일괄 추가
 */
export async function addChatMessagesBatch(
  sessionId: string,
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    contentType?: string;
    metadata?: Record<string, unknown>;
  }>
): Promise<{ ids: string[]; created: number }> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}/sessions/${sessionId}/messages/batch`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    throw new Error(`Failed to add chat messages batch: ${res.status}`);
  }

  const data = await res.json();
  return data.data || { ids: [], created: 0 };
}

/**
 * 채팅 세션 업데이트 (제목, 요약, 아카이브)
 */
export async function updateChatSession(
  sessionId: string,
  updates: {
    title?: string;
    summary?: string;
    isArchived?: boolean;
  }
): Promise<void> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}/sessions/${sessionId}`;

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    throw new Error(`Failed to update chat session: ${res.status}`);
  }
}

/**
 * 채팅 세션 삭제
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  const userId = getUserId();
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/memories/${userId}/sessions/${sessionId}`;

  const res = await fetch(url, { method: 'DELETE' });

  if (!res.ok) {
    throw new Error(`Failed to delete chat session: ${res.status}`);
  }
}

// ============================================================================
// Context Building for Chat
// ============================================================================

export async function getMemoryContextForChat(
  userQuery: string,
  maxTokens: number = MEMORY_DEFAULTS.CONTEXT_MAX_TOKENS
): Promise<string | null> {
  const results = await searchMemories(userQuery, { n_results: 10 });

  if (results.length === 0) return null;

  const contextParts: string[] = [];
  let currentLength = 0;

  for (const result of results) {
    if (result.similarity < MEMORY_DEFAULTS.SIMILARITY_THRESHOLD) continue;

    const memType = result.metadata.memory_type || 'fact';
    const category = result.metadata.category ? `/${result.metadata.category}` : '';
    const entry = `[${memType}${category}] ${result.document}`;
    const entryTokens = Math.ceil(entry.length / MEMORY_DEFAULTS.CHARS_PER_TOKEN);

    if (currentLength + entryTokens > maxTokens) break;

    contextParts.push(entry);
    currentLength += entryTokens;
  }

  if (contextParts.length === 0) return null;

  return [
    '[사용자 기억 데이터]',
    '다음은 이 사용자에 대해 알고 있는 정보입니다. 답변 시 참고하세요:',
    '',
    ...contextParts,
    '',
  ].join('\n');
}

// ============================================================================
// Memory Extraction from Conversations
// ============================================================================

/**
 * 대화에서 메모리 추출 (AI 기반)
 * 챗봇 응답 후 호출하여 중요 정보를 메모리로 저장
 *
 * @param userMessage - 사용자 메시지
 * @param assistantResponse - AI 응답
 * @param sessionId - 채팅 세션 ID
 */
export async function extractAndSaveMemories(
  userMessage: string,
  assistantResponse: string,
  sessionId?: string
): Promise<void> {
  // 간단한 휴리스틱으로 메모리 추출
  // TODO: 실제로는 LLM을 사용하여 더 정교하게 추출
  
  const memories: Array<{
    content: string;
    memoryType: string;
    category?: string;
    importanceScore: number;
  }> = [];

  // 선호도 관련 키워드 감지
  const preferencePatterns = [
    /(?:좋아하|선호하|즐기|관심)/,
    /(?:싫어하|피하|불편)/,
  ];
  
  if (preferencePatterns.some(p => p.test(userMessage))) {
    memories.push({
      content: userMessage.slice(0, 500),
      memoryType: 'preference',
      category: 'interest',
      importanceScore: 0.7,
    });
  }

  // 개인정보 관련 (이름, 직업 등)
  const personalPatterns = [
    /(?:제 이름은|저는 .+(?:입니다|이에요|예요))/,
    /(?:직업|일|회사|학교)/,
    /(?:살고 있|거주)/,
  ];

  if (personalPatterns.some(p => p.test(userMessage))) {
    memories.push({
      content: userMessage.slice(0, 500),
      memoryType: 'fact',
      category: 'personal',
      importanceScore: 0.8,
    });
  }

  // 목표/계획 관련
  const goalPatterns = [
    /(?:목표|계획|하고 싶|배우고 싶|만들고 싶)/,
    /(?:도전|시도|프로젝트)/,
  ];

  if (goalPatterns.some(p => p.test(userMessage))) {
    memories.push({
      content: userMessage.slice(0, 500),
      memoryType: 'context',
      category: 'goal',
      importanceScore: 0.6,
    });
  }

  // 메모리가 있으면 저장
  if (memories.length > 0) {
    const memoriesWithSource = memories.map(m => ({
      ...m,
      sourceType: 'chat' as const,
      sourceId: sessionId,
    }));
    
    try {
      await createMemoriesBatch(memoriesWithSource);
    } catch (err) {
      console.warn('Failed to save extracted memories:', err);
    }
  }
}
