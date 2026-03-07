import { config } from '../config.js';
import { openaiEmbeddings } from './ai/openai-client.service.js';

const CHROMA_TENANT = 'default_tenant';
const CHROMA_DATABASE = 'default_database';
const ragCollectionCache = new Map();

const sessions = new Map();

function getChromaCollectionsBase() {
  return `${config.rag.chromaUrl}/api/v2/tenants/${CHROMA_TENANT}/databases/${CHROMA_DATABASE}/collections`;
}

async function getCollectionUUID(collectionName) {
  if (ragCollectionCache.has(collectionName)) {
    return ragCollectionCache.get(collectionName);
  }
  
  try {
    const collectionsUrl = getChromaCollectionsBase();
    const listResp = await fetch(collectionsUrl, { method: 'GET' });
    
    if (!listResp.ok) return null;
    
    const collections = await listResp.json();
    const collection = collections.find(c => c.name === collectionName);
    
    if (collection) {
      ragCollectionCache.set(collectionName, collection.id);
      return collection.id;
    }
  } catch {
    return null;
  }
  return null;
}

async function getEmbeddings(texts) {
  const result = await openaiEmbeddings(texts, {
    model: config.rag.embeddingModel,
    baseUrl: config.rag.embeddingUrl,
    apiKey: config.rag.embeddingApiKey,
  });

  return result.embeddings;
}

async function queryChroma(embedding, nResults = 5) {
  const collectionName = config.rag.chromaCollection;
  const collectionsBase = getChromaCollectionsBase();
  
  const collectionUUID = await getCollectionUUID(collectionName);
  if (!collectionUUID) {
    throw new Error(`Collection not found: ${collectionName}`);
  }
  
  const queryUrl = `${collectionsBase}/${collectionUUID}/query`;
  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query_embeddings: [embedding],
      n_results: nResults,
      include: ['documents', 'metadatas', 'distances'],
    }),
  });
  
  if (!response.ok) {
    throw new Error(`ChromaDB error: ${response.status}`);
  }
  
  return response.json();
}

export async function performRAGSearch(query, topK = 5) {
  try {
    const [embedding] = await getEmbeddings([query]);
    const chromaResult = await queryChroma(embedding, topK);
    
    const sources = [];
    const contextParts = [];
    
    if (chromaResult.documents && chromaResult.documents[0]) {
      const docs = chromaResult.documents[0];
      const metas = chromaResult.metadatas?.[0] || [];
      const dists = chromaResult.distances?.[0] || [];
      
      for (let i = 0; i < docs.length; i++) {
        const meta = metas[i] || {};
        const distance = dists[i];
        const score = distance != null ? Math.max(0, 1 - distance) : null;
        
        sources.push({
          title: meta.title || meta.post_title || 'Untitled',
          url: meta.slug ? `/posts/${meta.year || new Date().getFullYear()}/${meta.slug}` : undefined,
          score,
          snippet: docs[i]?.slice(0, 200) || '',
        });
        
        const title = meta.title || meta.post_title || '';
        contextParts.push(`[${i + 1}] ${title ? `"${title}": ` : ''}${docs[i]}`);
      }
    }
    
    const context = contextParts.length > 0
      ? `다음은 관련 블로그 포스트에서 발췌한 내용입니다:\n\n${contextParts.join('\n\n')}\n\n위 내용을 참고하여 답변해주세요.`
      : null;
    
    return { context, sources };
  } catch (err) {
    console.warn('RAG search failed:', err.message);
    return { context: null, sources: [] };
  }
}

export function createSession(title = '') {
  const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  sessions.set(sessionId, {
    id: sessionId,
    title: title || `Session ${sessionId.slice(-6)}`,
    messages: [],
    createdAt: new Date().toISOString(),
  });
  return sessionId;
}

export function getSession(sessionId) {
  return sessions.get(sessionId);
}

export function addMessageToSession(sessionId, message) {
  const session = sessions.get(sessionId);
  if (session) {
    session.messages.push(message);
  }
}

export function clearSession(sessionId) {
  sessions.delete(sessionId);
}

const VALID_TASK_MODES = ['sketch', 'prism', 'chain', 'catalyst', 'summary', 'custom'];

export function isValidTaskMode(mode) {
  return VALID_TASK_MODES.includes(mode);
}

export function buildTaskPrompt(mode, payload) {
  const { paragraph, content, postTitle, persona, prompt } = payload;
  const text = paragraph || content || prompt || '';
  const title = postTitle || '';

  switch (mode) {
    case 'sketch':
      return {
        prompt: [
          'You are a helpful writing companion. Return STRICT JSON only matching the schema.',
          '{"mood":"string","bullets":["string", "string", "..."]}',
          '',
          `Persona: ${persona || 'default'}`,
          `Post: ${title.slice(0, 120)}`,
          'Paragraph:',
          text.slice(0, 1600),
          '',
          'Task: Capture the emotional sketch. Select a concise mood (e.g., curious, excited, skeptical) and 3-6 short bullets in the original language of the text.',
        ].join('\n'),
        temperature: 0.3,
      };

    case 'prism':
      return {
        prompt: [
          'Return STRICT JSON only for idea facets.',
          '{"facets":[{"title":"string","points":["string","string"]}]}',
          `Post: ${title.slice(0, 120)}`,
          'Paragraph:',
          text.slice(0, 1600),
          '',
          'Task: Provide 2-3 facets (titles) with 2-4 concise points each, in the original language.',
        ].join('\n'),
        temperature: 0.2,
      };

    case 'chain':
      return {
        prompt: [
          'Return STRICT JSON only for tail questions.',
          '{"questions":[{"q":"string","why":"string"}]}',
          `Post: ${title.slice(0, 120)}`,
          'Paragraph:',
          text.slice(0, 1600),
          '',
          'Task: Generate 3-5 short follow-up questions and a brief why for each, in the original language.',
        ].join('\n'),
        temperature: 0.2,
      };

    case 'summary':
      return {
        prompt: `Summarize the following content in Korean, concise but faithful to key points.\n\n${text}`,
        temperature: 0.2,
      };

    case 'catalyst':
      return {
        prompt: [
          'Return STRICT JSON for catalyst suggestions.',
          '{"suggestions":[{"idea":"string","reason":"string"}]}',
          `Post: ${title.slice(0, 120)}`,
          'Content:',
          text.slice(0, 1600),
          '',
          'Task: Provide 2-4 creative suggestions or alternative perspectives, in the original language.',
        ].join('\n'),
        temperature: 0.4,
      };

    case 'custom':
    default:
      return {
        prompt: text,
        temperature: 0.2,
      };
  }
}

export function getFallbackData(mode, payload) {
  const text = payload.paragraph || payload.content || payload.prompt || '';
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  switch (mode) {
    case 'sketch':
      return {
        mood: 'curious',
        bullets: sentences.slice(0, 4).map((s) => (s.length > 140 ? `${s.slice(0, 138)}...` : s)),
      };
    case 'prism':
      return {
        facets: [
          { title: '핵심 요점', points: [text.slice(0, 140)] },
          { title: '생각해볼 점', points: ['관점 A', '관점 B'] },
        ],
      };
    case 'chain':
      return {
        questions: [
          { q: '무엇이 핵심 주장인가?', why: '핵심을 명료화' },
          { q: '어떤 가정이 있는가?', why: '숨은 전제 확인' },
          { q: '적용 예시는?', why: '구체화' },
        ],
      };
    case 'summary':
      return { summary: text.slice(0, 300) + (text.length > 300 ? '...' : '') };
    case 'catalyst':
      return {
        suggestions: [
          { idea: '다른 관점에서 접근', reason: '새로운 시각 제공' },
        ],
      };
    default:
      return { text: 'Unable to process request' };
  }
}

export function extractTextFromParts(parts) {
  if (Array.isArray(parts)) {
    return parts
      .filter((p) => p?.type === 'text')
      .map((p) => p.text)
      .join('\n');
  } else if (typeof parts === 'string') {
    return parts;
  }
  return '';
}

export function addPageContext(message, pageContext) {
  if (pageContext?.url || pageContext?.title) {
    return `[Context: ${pageContext.title || ''} - ${pageContext.url || ''}]\n\n${message}`;
  }
  return message;
}
