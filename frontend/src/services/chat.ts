import { getApiBaseUrl } from '@/utils/apiBase';

function getChatBaseUrl(): string {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const fromRuntime =
    w?.APP_CONFIG?.chatBaseUrl || w?.__APP_CONFIG?.chatBaseUrl;
  if (typeof fromRuntime === 'string' && fromRuntime) return fromRuntime;
  const fromEnv = (import.meta as any)?.env?.VITE_CHAT_BASE_URL as
    | string
    | undefined;
  if (typeof fromEnv === 'string' && fromEnv) return fromEnv;
  return '';
}

function getChatApiKey(): string {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const fromRuntime = w?.APP_CONFIG?.chatApiKey || w?.__APP_CONFIG?.chatApiKey;
  if (typeof fromRuntime === 'string' && fromRuntime) return fromRuntime;
  const fromEnv = (import.meta as any)?.env?.VITE_CHAT_API_KEY as
    | string
    | undefined;
  if (typeof fromEnv === 'string' && fromEnv) return fromEnv;
  return '';
}

function getBooleanFromUnknown(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    return lowered === '1' || lowered === 'true' || lowered === 'yes' || lowered === 'on';
  }
  return false;
}

export function isUnifiedTasksEnabled(): boolean {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const runtimeFlag =
    w?.APP_CONFIG?.aiUnified ?? w?.__APP_CONFIG?.aiUnified ?? undefined;
  if (runtimeFlag !== undefined) return getBooleanFromUnknown(runtimeFlag);

  const envFlag = (import.meta as any)?.env?.VITE_AI_UNIFIED as
    | string
    | boolean
    | undefined;
  return getBooleanFromUnknown(envFlag);
}

export type ChatSession = {
  sessionID: string;
};

export type ChatTaskMode =
  | 'catalyst'
  | 'sketch'
  | 'prism'
  | 'chain'
  | 'summary'
  | 'custom';

export type InvokeChatTaskInput = {
  mode: ChatTaskMode;
  prompt?: string;
  payload?: Record<string, unknown>;
  context?: { url?: string; title?: string };
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export type InvokeChatTaskResult<T = unknown> = {
  ok: boolean;
  status: number;
  data: T | null;
  raw: unknown;
};

export async function ensureSession(): Promise<string> {
  const key = 'nodove_chat_session_id';
  try {
    const existing = localStorage.getItem(key);
    if (existing && typeof existing === 'string' && existing.trim()) {
      return existing;
    }
  } catch {}

  const chatBase = getChatBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  let url = '';
  if (chatBase) {
    url = `${chatBase.replace(/\/$/, '')}/session`;
    const k = getChatApiKey();
    if (k) headers['X-API-KEY'] = k;
  } else {
    const base = getApiBaseUrl();
    url = `${base.replace(/\/$/, '')}/api/v1/chat/session`;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Nodove Blog Visitor Session' }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(
      `Failed to create session: ${res.status} ${t.slice(0, 180)}`
    );
  }
  const data = (await res.json().catch(() => ({}))) as any;
  const id =
    data?.sessionID || data?.id || data?.data?.sessionID || data?.data?.id;
  if (!id || typeof id !== 'string')
    throw new Error('Invalid session response');
  try {
    localStorage.setItem(key, id);
  } catch {}
  return id;
}

export type ChatStreamEvent =
  | { type: 'text'; text: string }
  | {
      type: 'sources';
      sources: Array<{
        title?: string;
        url?: string;
        score?: number;
        snippet?: string;
      }>;
    }
  | { type: 'followups'; questions: string[] }
  | { type: 'context'; page?: { url?: string; title?: string } }
  | { type: 'done' };

function getPageContext(): { url?: string; title?: string } {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const url = w?.location?.href as string | undefined;
  const title = w?.document?.title as string | undefined;
  return { url, title };
}

function getArticleTextSnippet(maxChars = 4000): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const pick = (selector: string): string | null => {
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return null;
      const text = (el.innerText || '').trim();
      return text && text.length > 40 ? text : null;
    };

    const candidates = [
      'article',
      'main article',
      'article.prose',
      '.prose article',
      '.prose',
      '#content',
    ];
    for (const sel of candidates) {
      const v = pick(sel);
      if (v) {
        if (v.length <= maxChars) return v;
        return `${v.slice(0, maxChars)}\n…(truncated)`;
      }
    }

    const bodyText = (document.body?.innerText || '').trim();
    if (!bodyText) return null;
    if (bodyText.length <= maxChars) return bodyText;
    return `${bodyText.slice(0, maxChars)}\n…(truncated)`;
  } catch {
    return null;
  }
}

export async function invokeChatTask<T = unknown>(
  input: InvokeChatTaskInput
): Promise<InvokeChatTaskResult<T>> {
  if (!isUnifiedTasksEnabled()) {
    throw new Error('Unified chat task API is disabled');
  }

  const sessionID = await ensureSession();
  const chatBase = getChatBaseUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/plain',
  };
  let url = '';
  if (chatBase) {
    url = `${chatBase.replace(/\/$/, '')}/session/${encodeURIComponent(
      sessionID
    )}/task`;
    const apiKey = getChatApiKey();
    if (apiKey) headers['X-API-KEY'] = apiKey;
  } else {
    const base = getApiBaseUrl();
    url = `${base.replace(/\/$/, '')}/api/v1/chat/session/${encodeURIComponent(
      sessionID
    )}/task`;
  }

  if (input.headers) Object.assign(headers, input.headers);

  const body = {
    mode: input.mode,
    prompt: input.prompt ?? '',
    payload: input.payload ?? {},
    context: input.context ?? getPageContext(),
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: input.signal,
  });

  const text = await res.text().catch(() => '');
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!res.ok) {
    const errorMessage =
      typeof parsed === 'object' && parsed !== null && 'error' in (parsed as any)
        ? String((parsed as any).error)
        : text.slice(0, 180) || `status ${res.status}`;
    const error = new Error(`Chat task error: ${errorMessage}`);
    (error as any).status = res.status;
    (error as any).response = parsed;
    throw error;
  }

  const dataCandidate =
    parsed && typeof parsed === 'object'
      ? (parsed as any).data ??
        (parsed as any).result ??
        (parsed as any).output ??
        (parsed as any).payload ??
        parsed
      : parsed;

  return {
    ok: true,
    status: res.status,
    data: (dataCandidate as T) ?? null,
    raw: parsed,
  };
}

export async function* streamChatEvents(input: {
  text: string;
  page?: { url?: string; title?: string };
  signal?: AbortSignal;
  onFirstToken?: (ms: number) => void;
  useArticleContext?: boolean;
  imageUrl?: string; // Optional: URL of an attached image for vision models
  imageAnalysis?: string | null; // Optional: AI vision analysis of the attached image
}): AsyncGenerator<ChatStreamEvent, void, void> {
  const sessionID = await ensureSession();
  const chatBase = getChatBaseUrl();
  let url = '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream, application/x-ndjson, text/plain',
  };
  if (chatBase) {
    url = `${chatBase.replace(/\/$/, '')}/session/${encodeURIComponent(sessionID)}/message`;
    const k = getChatApiKey();
    if (k) headers['X-API-KEY'] = k;
  } else {
    const base = getApiBaseUrl();
    url = `${base.replace(/\/$/, '')}/api/v1/chat/session/${encodeURIComponent(sessionID)}/message`;
  }
  const stylePrompt =
    '다음 지침을 따르세요: 말투는 귀엽고 상냥한 애니메이션 여캐릭터(botchi)처럼, 존댓말을 유지하고 과하지 않게 가벼운 말끝(예: ~에요, ~일까요?)과 가끔 이모지(^_^, ✨)를 섞습니다. 응답은 간결하고 핵심만 전합니다.';
  const page = input.page || getPageContext();
  const shouldUseArticleContext =
    input.useArticleContext !== undefined ? input.useArticleContext : true;
  const articleSnippet = shouldUseArticleContext
    ? getArticleTextSnippet(4000)
    : null;
  const contextPrompt = articleSnippet
    ? [
        '현재 보고 있는 페이지의 본문 일부를 함께 전달할게요.',
        '이 내용을 참고해서 사용자의 질문에 더 정확하게 답변해 주세요.',
        '',
        '[페이지 본문]',
        articleSnippet,
        '',
        '---',
        '',
      ].join('\n')
    : '';
  
  // Build content parts - text only (AI API only accepts text)
  const parts: Array<{ type: 'text'; text: string }> = [
    { type: 'text', text: stylePrompt },
  ];
  if (contextPrompt) parts.push({ type: 'text', text: contextPrompt });
  
  // If an image is provided, include analysis and/or link
  if (input.imageUrl) {
    let imageContext = '';
    
    // Include AI vision analysis if available
    if (input.imageAnalysis) {
      imageContext += `[첨부된 이미지 분석 결과]\n${input.imageAnalysis}\n\n`;
    }
    
    imageContext += `[이미지 링크: ${input.imageUrl}]\n\n`;
    imageContext += input.text || '이 이미지에 대해 설명해 주세요.';
    
    parts.push({ type: 'text', text: imageContext });
  } else {
    parts.push({ type: 'text', text: input.text });
  }
  
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ parts, context: { page } }),
    signal: input.signal,
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => '');
    throw new Error(`Chat error: ${res.status} ${t.slice(0, 180)}`);
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const extractTexts = (obj: any): string[] => {
    const out: string[] = [];
    if (!obj || typeof obj !== 'object') return out;
    if (typeof obj.content === 'string') out.push(obj.content);
    if (Array.isArray(obj.parts))
      for (const p of obj.parts)
        if (p) {
          if (typeof (p as any).text === 'string') out.push((p as any).text);
          else if (typeof (p as any).content === 'string')
            out.push((p as any).content);
        }
    if (obj.message && typeof obj.message.content === 'string')
      out.push(obj.message.content);
    if (Array.isArray(obj.choices))
      for (const c of obj.choices) {
        const delta = c?.delta?.content ?? c?.message?.content;
        if (typeof delta === 'string') out.push(delta);
      }
    if (typeof obj.delta === 'string') out.push(obj.delta);
    return out;
  };

  const started =
    typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  let firstEmitted = false;
  const markFirst = () => {
    if (!firstEmitted) {
      firstEmitted = true;
      const now =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      if (typeof input.onFirstToken === 'function')
        input.onFirstToken(Math.max(0, Math.round(now - started)));
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      buffer += chunk;

      if (contentType.includes('text/event-stream')) {
        while (true) {
          const sep = buffer.indexOf('\n\n');
          if (sep < 0) break;
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const lines = frame.split('\n');
          const datas: string[] = [];
          let evt: string | undefined;
          for (const ln of lines) {
            if (ln.startsWith('data:')) datas.push(ln.slice(5).trim());
            else if (ln.startsWith('event:')) evt = ln.slice(6).trim();
          }
          const data = datas.join('\n');
          if (!data) continue;
          if (data === '[DONE]' || evt === 'done') {
            yield { type: 'done' };
            continue;
          }
          try {
            const obj = JSON.parse(data);
            const texts = extractTexts(obj);
            for (const t of texts)
              if (t) {
                markFirst();
                yield { type: 'text', text: t };
              }
            const srcs = obj?.sources;
            if (Array.isArray(srcs)) yield { type: 'sources', sources: srcs };
            const fups = obj?.followups || obj?.suggestions;
            if (Array.isArray(fups))
              yield { type: 'followups', questions: fups };
            const ctx = obj?.context;
            if (ctx && typeof ctx === 'object')
              yield { type: 'context', page: ctx.page || ctx };
          } catch {
            markFirst();
            yield { type: 'text', text: data };
          }
        }
      } else if (
        contentType.includes('ndjson') ||
        contentType.includes('jsonl')
      ) {
        while (true) {
          const nl = buffer.indexOf('\n');
          if (nl < 0) break;
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          if (line === '[DONE]') {
            yield { type: 'done' };
            continue;
          }
          try {
            const obj = JSON.parse(line);
            const texts = extractTexts(obj);
            for (const t of texts)
              if (t) {
                markFirst();
                yield { type: 'text', text: t };
              }
            const srcs = obj?.sources;
            if (Array.isArray(srcs)) yield { type: 'sources', sources: srcs };
            const fups = obj?.followups || obj?.suggestions;
            if (Array.isArray(fups))
              yield { type: 'followups', questions: fups };
            const ctx = obj?.context;
            if (ctx && typeof ctx === 'object')
              yield { type: 'context', page: ctx.page || ctx };
          } catch {
            markFirst();
            yield { type: 'text', text: line };
          }
        }
      } else if (contentType.includes('application/json')) {
      } else if (contentType.includes('text/plain')) {
        markFirst();
        yield { type: 'text', text: chunk };
        buffer = '';
      }
    }
    if (buffer) {
      if (contentType.includes('application/json')) {
        try {
          const obj = JSON.parse(buffer);
          const texts = extractTexts(obj);
          for (const t of texts)
            if (t) {
              markFirst();
              yield { type: 'text', text: t };
            }
          const srcs = (obj as any)?.sources;
          if (Array.isArray(srcs)) yield { type: 'sources', sources: srcs };
          const fups = (obj as any)?.followups || (obj as any)?.suggestions;
          if (Array.isArray(fups)) yield { type: 'followups', questions: fups };
          const ctx = (obj as any)?.context;
          if (ctx && typeof ctx === 'object')
            yield { type: 'context', page: (ctx as any).page || ctx };
        } catch {
          markFirst();
          yield { type: 'text', text: buffer };
        }
      } else if (
        contentType.includes('ndjson') ||
        contentType.includes('jsonl')
      ) {
        const lines = buffer.split('\n');
        for (const s of lines) {
          const line = s.trim();
          if (!line) continue;
          if (line === '[DONE]') {
            yield { type: 'done' };
            continue;
          }
          try {
            const obj = JSON.parse(line);
            const texts = extractTexts(obj);
            for (const t of texts)
              if (t) {
                markFirst();
                yield { type: 'text', text: t };
              }
            const srcs = obj?.sources;
            if (Array.isArray(srcs)) yield { type: 'sources', sources: srcs };
            const fups = obj?.followups || obj?.suggestions;
            if (Array.isArray(fups))
              yield { type: 'followups', questions: fups };
            const ctx = obj?.context;
            if (ctx && typeof ctx === 'object')
              yield { type: 'context', page: ctx.page || ctx };
          } catch {
            markFirst();
            yield { type: 'text', text: line };
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* streamChatMessage(input: {
  text: string;
}): AsyncGenerator<string, void, void> {
  for await (const ev of streamChatEvents({ text: input.text })) {
    if (ev.type === 'text') yield ev.text;
  }
}

export type ChatImageUploadResult = {
  url: string;
  key: string;
  size: number;
  contentType: string;
  imageAnalysis?: string | null; // AI vision analysis result
};

export async function uploadChatImage(
  file: File,
  signal?: AbortSignal
): Promise<ChatImageUploadResult> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/images/chat-upload`;
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    signal,
  });

  const text = await res.text().catch(() => '');
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok || !parsed?.ok) {
    const message =
      (parsed && parsed.error && parsed.error.message) ||
      text.slice(0, 180) ||
      `status ${res.status}`;
    throw new Error(`Chat image upload error: ${message}`);
  }

  const data = parsed.data;
  if (!data || typeof data.url !== 'string') {
    throw new Error('Invalid chat image upload response');
  }
  return data as ChatImageUploadResult;
}

export async function invokeChatAggregate(input: {
  prompt: string;
  signal?: AbortSignal;
}): Promise<string> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}/api/v1/chat/aggregate`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: input.prompt }),
    signal: input.signal,
  });

  const text = await res.text().catch(() => '');
  let parsed: any = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (!res.ok || !parsed?.ok) {
    const message =
      (parsed && parsed.error && parsed.error.message) ||
      text.slice(0, 180) ||
      `status ${res.status}`;
    throw new Error(`Chat aggregate error: ${message}`);
  }

  const data = parsed.data;
  const value =
    (data && typeof data.text === 'string' && data.text) ||
    (typeof data === 'string' ? data : null);
  if (!value) {
    throw new Error('Invalid chat aggregate response');
  }
  return value;
}
