import { getApiBaseUrl } from '@/utils/network/apiBase';
import { getPrincipalHeaders } from '@/services/session/userContentAuth';

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

const MAX_USER_CONTENT_ID_LENGTH = 160;
const MAX_USER_CONTENT_TEXT_LENGTH = 100000;
const MAX_USER_CONTENT_SINGLE_LINE_LENGTH = 500;
const MAX_USER_CONTENT_TAGS = 50;
const USER_CONTENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

function decodeSelector(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

function normalizeUserContentId(value: unknown, label = 'id'): string {
  if (typeof value !== 'string') throw new Error(`Invalid user content ${label}`);
  const normalized = decodeSelector(value);
  if (
    !normalized ||
    normalized.length > MAX_USER_CONTENT_ID_LENGTH ||
    !USER_CONTENT_ID_PATTERN.test(normalized)
  ) {
    throw new Error(`Invalid user content ${label}`);
  }
  return normalized;
}

function normalizeOptionalSelector(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return normalizeUserContentId(value, label);
}

function normalizeSingleLineText(value: unknown, label: string, maxLength = MAX_USER_CONTENT_SINGLE_LINE_LENGTH): string {
  if (typeof value !== 'string') throw new Error(`Invalid user content ${label}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\r\n]/.test(normalized)) {
    throw new Error(`Invalid user content ${label}`);
  }
  return normalized;
}

function normalizeOptionalSingleLineText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  return normalizeSingleLineText(value, label);
}

function normalizeMultilineText(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new Error(`Invalid user content ${label}`);
  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (!normalized || normalized.length > MAX_USER_CONTENT_TEXT_LENGTH) {
    throw new Error(`Invalid user content ${label}`);
  }
  return normalized;
}

function normalizeOptionalBlankMultilineText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`Invalid user content ${label}`);

  const normalized = value.replace(/\r\n?/g, '\n').trim();
  if (normalized.length > MAX_USER_CONTENT_TEXT_LENGTH) {
    throw new Error(`Invalid user content ${label}`);
  }

  return normalized;
}

function normalizeTags(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error('Invalid user content tags');

  return value
    .slice(0, MAX_USER_CONTENT_TAGS)
    .map(tag => normalizeSingleLineText(tag, 'tag', 80));
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized || /[\r\n]/.test(normalized)) return undefined;
  return Number.isFinite(Date.parse(normalized)) ? normalized : undefined;
}

function normalizeEtag(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return normalizeSingleLineText(value, 'etag', 256);
}

function normalizeCursor(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return normalizeSingleLineText(value, 'cursor', 256);
}

function normalizeErrorMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 500 || /[\r\n]/.test(normalized)) return null;
  return normalized;
}

function normalizePersonaPayload(input: PersonaPayload): PersonaPayload {
  return {
    ...(input.id ? { id: normalizeUserContentId(input.id) } : {}),
    name: normalizeSingleLineText(input.name, 'persona name'),
    prompt: normalizeMultilineText(input.prompt, 'persona prompt'),
    tags: normalizeTags(input.tags),
  };
}

export function normalizeMemoSource(value: unknown): MemoSource | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid user content memo source');
  }

  const source = value as MemoSource;
  const conversationId = normalizeOptionalSelector(source.conversationId, 'conversation id');
  const conversationTitle = normalizeOptionalSingleLineText(
    source.conversationTitle,
    'conversation title',
  );
  const messageId = normalizeOptionalSelector(source.messageId, 'message id');
  const normalized: MemoSource = {
    ...(conversationId ? { conversationId } : {}),
    ...(conversationTitle ? { conversationTitle } : {}),
    ...(messageId ? { messageId } : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeMemoPayload(input: MemoPayload): MemoPayload {
  return {
    ...(input.id ? { id: normalizeUserContentId(input.id) } : {}),
    originalContent: normalizeMultilineText(input.originalContent, 'memo original content'),
    ...(normalizeOptionalBlankMultilineText(input.userNote, 'memo note') !== undefined
      ? { userNote: normalizeOptionalBlankMultilineText(input.userNote, 'memo note') }
      : {}),
    tags: normalizeTags(input.tags),
    ...(normalizeMemoSource(input.source) ? { source: normalizeMemoSource(input.source) } : {}),
  };
}

async function request<T>(
  path: string,
  init?: RequestInit,
  expectJson = true
): Promise<ApiEnvelope<T>> {
  const base = getApiBaseUrl();
  const url = `${base.replace(/\/$/, '')}${path}`;

  const headers = await getPrincipalHeaders(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = normalizeErrorMessage(data?.error?.message) ?? message;
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
    throw new Error(normalizeErrorMessage(body?.error?.message) || 'Request failed');
  }
  return body;
}

function normalisePersona(raw: Record<string, unknown>): Persona | null {
  try {
    const id = normalizeUserContentId(raw.id);
    const name = normalizeSingleLineText(raw.name, 'persona name');
    const prompt = normalizeMultilineText(raw.prompt, 'persona prompt');
    const createdAt = normalizeTimestamp(raw.createdAt);
    if (!createdAt) return null;

    return {
      id,
      name,
      prompt,
      tags: normalizeTags(raw.tags),
      createdAt,
      updatedAt: normalizeTimestamp(raw.updatedAt),
      etag: normalizeEtag(raw.etag),
    };
  } catch {
    return null;
  }
}

function normaliseMemo(raw: Record<string, unknown>): MemoNote | null {
  try {
    const id = normalizeUserContentId(raw.id);
    const originalContent = normalizeMultilineText(raw.originalContent, 'memo original content');
    const userNote = normalizeOptionalBlankMultilineText(raw.userNote, 'memo note') ?? '';
    const createdAt = normalizeTimestamp(raw.createdAt);
    if (!createdAt) return null;

    return {
      id,
      originalContent,
      userNote,
      tags: normalizeTags(raw.tags),
      createdAt,
      updatedAt: normalizeTimestamp(raw.updatedAt),
      source: normalizeMemoSource(raw.source),
      etag: normalizeEtag(raw.etag),
    };
  } catch {
    return null;
  }
}

function requireNormalisedPersona(raw: Record<string, unknown>, fallback: string): Persona {
  const persona = normalisePersona(raw);
  if (!persona) throw new Error(fallback);
  return persona;
}

function requireNormalisedMemo(raw: Record<string, unknown>, fallback: string): MemoNote {
  const memo = normaliseMemo(raw);
  if (!memo) throw new Error(fallback);
  return memo;
}

function requireRecordWithId(
  value: unknown,
  fallback: string,
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof (value as Record<string, unknown>).id !== 'string' ||
    !(value as Record<string, unknown>).id
  ) {
    throw new Error(fallback);
  }

  try {
    normalizeUserContentId((value as Record<string, unknown>).id);
    return value as Record<string, unknown>;
  } catch {
    throw new Error(fallback);
  }
}

export async function listPersonas(cursor?: string | null): Promise<ListResponse<Persona>> {
  const cursorValue = normalizeCursor(cursor);
  const params = cursorValue ? `?cursor=${encodeURIComponent(cursorValue)}` : '';
  const res = await request<Record<string, unknown>[]>(`/api/v1/personas${params}`);
  const payload = Array.isArray(res.data) ? res.data : [];
  const personas = payload
    .map(normalisePersona)
    .filter((persona): persona is Persona => Boolean(persona));
  const nextCursor = normalizeCursor(res.cursor);
  const hasMore = Boolean(res.hasMore);
  return { items: personas, cursor: nextCursor, hasMore };
}

export async function createPersona(input: PersonaPayload): Promise<Persona> {
  const body = JSON.stringify(normalizePersonaPayload(input));
  const res = await request<Record<string, unknown>>('/api/v1/personas', {
    method: 'POST',
    body,
  });
  return requireNormalisedPersona(
    requireRecordWithId(res.data, 'Persona response missing id'),
    'Persona response missing id',
  );
}

export async function updatePersona(
  id: string,
  input: PersonaPayload,
  etag?: string | null
): Promise<Persona> {
  const headers: Record<string, string> = {};
  const personaId = normalizeUserContentId(id);
  const normalizedEtag = normalizeEtag(etag);
  if (normalizedEtag) headers['If-Match'] = normalizedEtag;
  const res = await request<Record<string, unknown>>(`/api/v1/personas/${encodeURIComponent(personaId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(normalizePersonaPayload(input)),
  });
  return requireNormalisedPersona(
    requireRecordWithId(res.data, 'Persona response missing id'),
    'Persona response missing id',
  );
}

export async function deletePersona(id: string, etag?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  const personaId = normalizeUserContentId(id);
  const normalizedEtag = normalizeEtag(etag);
  if (normalizedEtag) headers['If-Match'] = normalizedEtag;
  await request(`/api/v1/personas/${encodeURIComponent(personaId)}`, {
    method: 'DELETE',
    headers,
  }, false);
}

export async function listMemos(cursor?: string | null): Promise<ListResponse<MemoNote>> {
  const cursorValue = normalizeCursor(cursor);
  const params = cursorValue ? `?cursor=${encodeURIComponent(cursorValue)}` : '';
  const res = await request<Record<string, unknown>[]>(`/api/v1/user-content/memos${params}`);
  const payload = Array.isArray(res.data) ? res.data : [];
  const memos = payload
    .map(normaliseMemo)
    .filter((memo): memo is MemoNote => Boolean(memo));
  const nextCursor = normalizeCursor(res.cursor);
  const hasMore = Boolean(res.hasMore);
  return { items: memos, cursor: nextCursor, hasMore };
}

export async function createMemo(input: MemoPayload): Promise<MemoNote> {
  const res = await request<Record<string, unknown>>('/api/v1/user-content/memos', {
    method: 'POST',
    body: JSON.stringify(normalizeMemoPayload(input)),
  });
  return requireNormalisedMemo(
    requireRecordWithId(res.data, 'Memo response missing id'),
    'Memo response missing id',
  );
}

export async function updateMemo(
  id: string,
  input: MemoPayload,
  etag?: string | null
): Promise<MemoNote> {
  const headers: Record<string, string> = {};
  const memoId = normalizeUserContentId(id);
  const normalizedEtag = normalizeEtag(etag);
  if (normalizedEtag) headers['If-Match'] = normalizedEtag;
  const res = await request<Record<string, unknown>>(`/api/v1/user-content/memos/${encodeURIComponent(memoId)}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(normalizeMemoPayload(input)),
  });
  return requireNormalisedMemo(
    requireRecordWithId(res.data, 'Memo response missing id'),
    'Memo response missing id',
  );
}

export async function deleteMemo(id: string, etag?: string | null): Promise<void> {
  const headers: Record<string, string> = {};
  const memoId = normalizeUserContentId(id);
  const normalizedEtag = normalizeEtag(etag);
  if (normalizedEtag) headers['If-Match'] = normalizedEtag;
  await request(`/api/v1/user-content/memos/${encodeURIComponent(memoId)}`, {
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
