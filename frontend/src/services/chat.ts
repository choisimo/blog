import { getApiBaseUrl } from '@/utils/apiBase';

function getChatBaseUrl(): string {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const fromRuntime = w?.APP_CONFIG?.chatBaseUrl || w?.__APP_CONFIG?.chatBaseUrl;
  if (typeof fromRuntime === 'string' && fromRuntime) return fromRuntime;
  const fromEnv = (import.meta as any)?.env?.VITE_CHAT_BASE_URL as string | undefined;
  if (typeof fromEnv === 'string' && fromEnv) return fromEnv;
  return '';
}

function getChatApiKey(): string {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const fromRuntime = w?.APP_CONFIG?.chatApiKey || w?.__APP_CONFIG?.chatApiKey;
  if (typeof fromRuntime === 'string' && fromRuntime) return fromRuntime;
  const fromEnv = (import.meta as any)?.env?.VITE_CHAT_API_KEY as string | undefined;
  if (typeof fromEnv === 'string' && fromEnv) return fromEnv;
  return '';
}

export type ChatSession = {
  sessionID: string;
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
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
    throw new Error(`Failed to create session: ${res.status} ${t.slice(0, 180)}`);
  }
  const data = (await res.json().catch(() => ({}))) as any;
  const id = data?.sessionID || data?.id || data?.data?.sessionID || data?.data?.id;
  if (!id || typeof id !== 'string') throw new Error('Invalid session response');
  try { localStorage.setItem(key, id); } catch {}
  return id;
}

export type ChatStreamEvent =
  | { type: 'text'; text: string }
  | { type: 'sources'; sources: Array<{ title?: string; url?: string; score?: number; snippet?: string }> }
  | { type: 'followups'; questions: string[] }
  | { type: 'context'; page?: { url?: string; title?: string } }
  | { type: 'done' };

function getPageContext(): { url?: string; title?: string } {
  const w = typeof window !== 'undefined' ? (window as any) : null;
  const url = w?.location?.href as string | undefined;
  const title = w?.document?.title as string | undefined;
  return { url, title };
}

export async function* streamChatEvents(input: {
  text: string;
  page?: { url?: string; title?: string };
  signal?: AbortSignal;
  onFirstToken?: (ms: number) => void;
}): AsyncGenerator<ChatStreamEvent, void, void> {
  const sessionID = await ensureSession();
  const chatBase = getChatBaseUrl();
  let url = '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'text/event-stream, application/x-ndjson, text/plain' };
  if (chatBase) {
    url = `${chatBase.replace(/\/$/, '')}/session/${encodeURIComponent(sessionID)}/message`;
    const k = getChatApiKey();
    if (k) headers['X-API-KEY'] = k;
  } else {
    const base = getApiBaseUrl();
    url = `${base.replace(/\/$/, '')}/api/v1/chat/session/${encodeURIComponent(sessionID)}/message`;
  }
  const stylePrompt = '다음 지침을 따르세요: 말투는 귀엽고 상냥한 애니메이션 여캐릭터(botchi)처럼, 존댓말을 유지하고 과하지 않게 가벼운 말끝(예: ~에요, ~일까요?)과 가끔 이모지(^_^, ✨)를 섞습니다. 응답은 간결하고 핵심만 전합니다.';
  const parts = [
    { type: 'text', text: stylePrompt },
    { type: 'text', text: input.text },
  ];
  const page = input.page || getPageContext();
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
    if (Array.isArray(obj.parts)) for (const p of obj.parts) if (p) {
      if (typeof (p as any).text === 'string') out.push((p as any).text);
      else if (typeof (p as any).content === 'string') out.push((p as any).content);
    }
    if (obj.message && typeof obj.message.content === 'string') out.push(obj.message.content);
    if (Array.isArray(obj.choices)) for (const c of obj.choices) {
      const delta = c?.delta?.content ?? c?.message?.content;
      if (typeof delta === 'string') out.push(delta);
    }
    if (typeof obj.delta === 'string') out.push(obj.delta);
    return out;
  };

  const started = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  let firstEmitted = false;
  const markFirst = () => {
    if (!firstEmitted) {
      firstEmitted = true;
      const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (typeof input.onFirstToken === 'function') input.onFirstToken(Math.max(0, Math.round(now - started)));
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
          if (data === '[DONE]' || evt === 'done') { yield { type: 'done' }; continue; }
          try {
            const obj = JSON.parse(data);
            const texts = extractTexts(obj);
            for (const t of texts) if (t) { markFirst(); yield { type: 'text', text: t }; }
            const srcs = obj?.sources;
            if (Array.isArray(srcs)) yield { type: 'sources', sources: srcs };
            const fups = obj?.followups || obj?.suggestions;
            if (Array.isArray(fups)) yield { type: 'followups', questions: fups };
            const ctx = obj?.context;
            if (ctx && typeof ctx === 'object') yield { type: 'context', page: ctx.page || ctx };
          } catch {
            markFirst();
            yield { type: 'text', text: data };
          }
        }
      } else if (contentType.includes('ndjson') || contentType.includes('jsonl')) {
        while (true) {
          const nl = buffer.indexOf('\n');
          if (nl < 0) break;
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          if (line === '[DONE]') { yield { type: 'done' }; continue; }
          try {
            const obj = JSON.parse(line);
            const texts = extractTexts(obj);
            for (const t of texts) if (t) { markFirst(); yield { type: 'text', text: t }; }
            const srcs = obj?.sources;
            if (Array.isArray(srcs)) yield { type: 'sources', sources: srcs };
            const fups = obj?.followups || obj?.suggestions;
            if (Array.isArray(fups)) yield { type: 'followups', questions: fups };
            const ctx = obj?.context;
            if (ctx && typeof ctx === 'object') yield { type: 'context', page: ctx.page || ctx };
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
          for (const t of texts) if (t) { markFirst(); yield { type: 'text', text: t }; }
          const srcs = (obj as any)?.sources;
          if (Array.isArray(srcs)) yield { type: 'sources', sources: srcs };
          const fups = (obj as any)?.followups || (obj as any)?.suggestions;
          if (Array.isArray(fups)) yield { type: 'followups', questions: fups };
          const ctx = (obj as any)?.context;
          if (ctx && typeof ctx === 'object') yield { type: 'context', page: (ctx as any).page || ctx };
        } catch {
          markFirst();
          yield { type: 'text', text: buffer };
        }
      } else if (contentType.includes('ndjson') || contentType.includes('jsonl')) {
        const lines = buffer.split('\n');
        for (const s of lines) {
          const line = s.trim();
          if (!line) continue;
          if (line === '[DONE]') { yield { type: 'done' }; continue; }
          try {
            const obj = JSON.parse(line);
            const texts = extractTexts(obj);
            for (const t of texts) if (t) { markFirst(); yield { type: 'text', text: t }; }
            const srcs = obj?.sources;
            if (Array.isArray(srcs)) yield { type: 'sources', sources: srcs };
            const fups = obj?.followups || obj?.suggestions;
            if (Array.isArray(fups)) yield { type: 'followups', questions: fups };
            const ctx = obj?.context;
            if (ctx && typeof ctx === 'object') yield { type: 'context', page: ctx.page || ctx };
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

export async function* streamChatMessage(input: { text: string }): AsyncGenerator<string, void, void> {
  for await (const ev of streamChatEvents({ text: input.text })) {
    if (ev.type === 'text') yield ev.text;
  }
}
