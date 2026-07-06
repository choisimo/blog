export const AI_MEMO_INLINE_ENABLED_STORAGE_KEY = 'aiMemo.inline.enabled';

export function normalizeAiMemoInlineEnabledPreference(
  value: string | null
): boolean | undefined {
  if (value == null) return undefined;

  const trimmed = value.trim();
  if (trimmed === '1') return true;
  if (trimmed === '0') return false;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === true) return true;
    if (parsed === false) return false;
  } catch {
    return undefined;
  }

  return undefined;
}

export function resolveAiMemoInlineEnabledPreference(
  storedPreference: string | null
): boolean {
  return normalizeAiMemoInlineEnabledPreference(storedPreference) ?? true;
}
