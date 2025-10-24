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

export async function* streamChatMessage(input: { text: string }): AsyncGenerator<string, void, void> {
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
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ parts: [{ type: 'text', text: input.text }] }),
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
    return out;
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
          for (const ln of lines) if (ln.startsWith('data:')) datas.push(ln.slice(5).trim());
          const data = datas.join('\n');
          if (!data) continue;
          try {
            const obj = JSON.parse(data);
            const texts = extractTexts(obj);
            for (const t of texts) if (t) yield t;
          } catch {
            yield data;
          }
        }
      } else if (contentType.includes('ndjson') || contentType.includes('jsonl')) {
        while (true) {
          const nl = buffer.indexOf('\n');
          if (nl < 0) break;
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            const texts = extractTexts(obj);
            for (const t of texts) if (t) yield t;
          } catch {
            yield line;
          }
        }
      } else if (contentType.includes('application/json')) {
        // wait until end
      } else if (contentType.includes('text/plain')) {
        yield chunk;
        buffer = '';
      }
    }
    if (buffer) {
      if (contentType.includes('application/json')) {
        try {
          const obj = JSON.parse(buffer);
          const texts = extractTexts(obj);
          for (const t of texts) if (t) yield t;
        } catch {
          yield buffer;
        }
      } else if (contentType.includes('ndjson') || contentType.includes('jsonl')) {
        const lines = buffer.split('\n');
        for (const s of lines) {
          const line = s.trim();
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            const texts = extractTexts(obj);
            for (const t of texts) if (t) yield t;
          } catch {
            yield line;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
