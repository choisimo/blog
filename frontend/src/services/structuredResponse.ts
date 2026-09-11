import {
  hasStructuredResponseText,
  parseStructuredResponse,
} from '@blog/shared/runtime/structured-response';

const ENVELOPE_KEYS = ['data', 'result', 'output', 'payload', '_raw', 'text'] as const;

export function isFallbackStructuredResponse(value: unknown, depth = 0): boolean {
  if (depth > 12) return false;
  if (typeof value === 'string') {
    const parsed = parseStructuredResponse(value);
    return parsed !== null && parsed !== value && isFallbackStructuredResponse(parsed, depth + 1);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record._fallback === true || record.source === 'fallback' ||
    ENVELOPE_KEYS.some(key => key in record && isFallbackStructuredResponse(record[key], depth + 1));
}

/** Decode transport wrappers, then require the caller's domain schema. */
export function unwrapStructuredResponse<T>(
  value: unknown,
  validate: (value: unknown) => value is T,
  depth = 0,
): T | null {
  if (depth > 12) return null;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const envelope = value as Record<string, unknown>;
    if (envelope.ok === false || envelope._fallback === true || envelope.source === 'fallback') return null;
  }
  if (validate(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseStructuredResponse(value);
    return parsed !== null && parsed !== value
      ? unwrapStructuredResponse(parsed, validate, depth + 1)
      : null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.ok === false) return null;
  for (const key of ENVELOPE_KEYS) {
    if (!(key in record)) continue;
    const result = unwrapStructuredResponse(record[key], validate, depth + 1);
    if (result !== null) return result;
  }
  return null;
}

export function isSafeResponseRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && !hasStructuredResponseText(value);
}

export function normalizeChatTaskResponse(value: unknown, mode: string): Record<string, unknown> | null {
  const text = (entry: unknown): entry is string => typeof entry === 'string' && !!entry.trim();
  const list = (entry: unknown): entry is string[] => Array.isArray(entry) && entry.length > 0 && entry.every(text);
  return unwrapStructuredResponse(value, (entry): entry is Record<string, unknown> => {
    if (!isSafeResponseRecord(entry)) return false;
    switch (mode) {
      case 'sketch': return text(entry.mood) && list(entry.bullets);
      case 'prism': return Array.isArray(entry.facets) && entry.facets.length > 0 && entry.facets.every(
        facet => isSafeResponseRecord(facet) && text(facet.title) && list(facet.points),
      );
      case 'chain': return Array.isArray(entry.questions) && entry.questions.length > 0 && entry.questions.every(
        question => isSafeResponseRecord(question) && text(question.q) && text(question.why),
      );
      case 'summary': return text(entry.summary) && (entry.keyPoints === undefined ||
        (Array.isArray(entry.keyPoints) && entry.keyPoints.every(text)));
      default: return false;
    }
  });
}

/** Empty warming pages are valid; malformed cards must reach the hook's fallback. */
export function normalizeFeedResponse<T>(value: unknown, bodyKey: 'summary' | 'body'): T | null {
  return unwrapStructuredResponse(value, (candidate): candidate is T => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
    const record = candidate as Record<string, unknown>;
    return record.ok !== false && Array.isArray(record.items) && record.items.every(item =>
      isSafeResponseRecord(item) && typeof item.title === 'string' && item.title.trim() !== ''
      && typeof item[bodyKey] === 'string' && (item[bodyKey] as string).trim() !== '',
    );
  });
}
