import { getApiBaseUrl } from '@/utils/apiBase';
import { useAuthStore } from '@/stores/useAuthStore';

export type Persona = {
  id: string;
  name: string;
  prompt: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  etag?: string | null;
};

export type MemoSource = {
  conversationId?: string;
  conversationTitle?: string;
  messageId?: string;
};

export type MemoNote = {
  id: string;
  originalContent: string;
  userNote: string;
  tags: string[];
  createdAt: string;
  updatedAt?: string;
  source?: MemoSource;
  etag?: string | null;
};

export type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  cursor?: string | null;
  hasMore?: boolean;
};

export type ListResponse<T> = {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
};

export type PersonaPayload = {
  id?: string;
  name: string;
  prompt: string;
  tags?: string[];
};

export type MemoPayload = {
  id?: string;
  originalContent: string;
  userNote?: string;
  tags?: string[];
  source?: MemoSource;
};

export type CreatePersonaInput = Omit<PersonaPayload, 'id'>;
export type UpdatePersonaInput = Omit<PersonaPayload, 'id'>;
export type CreateMemoInput = Omit<MemoPayload, 'id'>;
export type UpdateMemoInput = Omit<MemoPayload, 'id'>;

function getAuthToken(): string | null {
  const authToken = useAuthStore.getState().token;
  if (authToken && authToken.trim()) {
    return authToken.trim();
  }
  if (typeof window === 'undefined') return null;
  const candidates = [
    'aiMemo.authToken',
    'aiMemo.jwt',
    'auth.token',
    'aiMemoAuthToken',
  ];
  for (const key of candidates) {
    try {
      const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
        if (typeof raw === 'string' && raw.trim()) return raw.trim();
      }
    } catch {
      // ignore JSON parse errors
    }
  }
  return null;
}

async function request<T>(
  path: string,
  init?: RequestInit,
  expectJson = true
): Promise<ApiEnvelope<T>> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}${path}`;

  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = (data?.error?.message as string) ?? message;
    } catch {
      // ignore body parse errors
    }
    throw new Error(message);
  }

  if (!expectJson) {
    return { ok: true } as ApiEnvelope<T>;
  }

  const body = (await res.json()) as ApiEnvelope<T>;
  if (!body?.ok) {
    throw new Error(body?.error?.message || 'Request failed');
  }
  return body;
}

function normalisePersona(raw: any): Persona {
  return {
    id: String(raw.id),
    name: String(raw.name ?? ''),
    prompt: String(raw.prompt ?? ''),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
    etag: raw.etag ? String(raw.etag) : null,
  };
}

function normaliseMemo(raw: any): MemoNote {
  return {
    id: String(raw.id),
    originalContent: String(raw.originalContent ?? ''),
    userNote: String(raw.userNote ?? ''),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: raw.updatedAt ? String(raw.updatedAt) : undefined,
    source: raw.source ? { ...raw.source } : undefined,
    etag: raw.etag ? String(raw.etag) : null,
  };
}

export async function listPersonas(cursor?: string | null): Promise<ListResponse<Persona>> {
  const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const res = await request<any[]>(`/api/personas${params}`);
  const payload = Array.isArray(res.data) ? res.data : [];
  const personas = payload.map(normalisePersona);
  const cursorValue = (res.cursor ?? null) as string | null;
  const hasMore = Boolean(res.hasMore);
  return { items: personas, cursor: cursorValue, hasMore };
}

export async function createPersona(input: PersonaPayload): Promise<Persona> {
  const body = JSON.stringify(input);
  const res = await request<any>('/api/personas', {
    method: 'POST',
    body,
  });
  return normalisePersona(res.data ?? {});
}

export async function updatePersona(
  id: string,
  input: PersonaPayload,
  etag?: string | null
): Promise<Persona> {
  const headers: Record<string, string> = {};
  if (etag) headers['If-Match'] = etag;
  const res = await request<any>(`/api/personas/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });
  return normalisePersona(res.data ?? {});
}

export async function deletePersona(id: string, etag?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (etag) headers['If-Match'] = etag;
  await request(`/api/personas/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  }, false);
}

export async function listMemos(cursor?: string | null): Promise<ListResponse<MemoNote>> {
  const params = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  const res = await request<any[]>(`/api/memos${params}`);
  const payload = Array.isArray(res.data) ? res.data : [];
  const memos = payload.map(normaliseMemo);
  const cursorValue = (res.cursor ?? null) as string | null;
  const hasMore = Boolean(res.hasMore);
  return { items: memos, cursor: cursorValue, hasMore };
}

export async function createMemo(input: MemoPayload): Promise<MemoNote> {
  const res = await request<any>('/api/memos', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return normaliseMemo(res.data ?? {});
}

export async function updateMemo(
  id: string,
  input: MemoPayload,
  etag?: string | null
): Promise<MemoNote> {
  const headers: Record<string, string> = {};
  if (etag) headers['If-Match'] = etag;
  const res = await request<any>(`/api/memos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(input),
  });
  return normaliseMemo(res.data ?? {});
}

export async function deleteMemo(id: string, etag?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  if (etag) headers['If-Match'] = etag;
  await request(`/api/memos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers,
  }, false);
}

export const UserContentService = {
  listPersonas,
  createPersona,
  updatePersona,
  deletePersona,
  listMemos,
  createMemo,
  updateMemo,
  deleteMemo,
};
