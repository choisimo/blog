import { getApiBaseUrl } from '@/utils/apiBase';

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

  const base = getApiBaseUrl();
  const res = await fetch(`${base.replace(/\/$/, '')}/api/v1/chat/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Nodove Blog Visitor Session' }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Failed to create session: ${res.status} ${t.slice(0, 180)}`);
  }
  const data = (await res.json().catch(() => ({}))) as any;
  const id = data?.sessionID || data?.data?.sessionID;
  if (!id || typeof id !== 'string') throw new Error('Invalid session response');
  try { localStorage.setItem(key, id); } catch {}
  return id;
}

export async function* streamChatMessage(input: { text: string }): AsyncGenerator<string, void, void> {
  const base = getApiBaseUrl();
  const sessionID = await ensureSession();

  const url = `${base.replace(/\/$/, '')}/api/v1/chat/session/${encodeURIComponent(sessionID)}/message`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/plain' },
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
