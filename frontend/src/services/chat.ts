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
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'text/plain' };
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

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) yield chunk;
    }
  } finally {
    reader.releaseLock();
  }
}
