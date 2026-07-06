export const FAB_ENABLED_STORAGE_KEY = "aiMemo.fab.enabled";

export function normalizeFabEnabledPreference(
  value: string | null,
): boolean | undefined {
  if (value == null) return undefined;

  const trimmed = value.trim();
  if (trimmed === "1") return true;
  if (trimmed === "0") return false;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed === true) return true;
    if (parsed === false) return false;
  } catch {
    return undefined;
  }

  return undefined;
}

export function resolveFabEnabledPreference(
  storedPreference: string | null,
  envFlag: string | undefined,
): boolean {
  const normalizedStored = normalizeFabEnabledPreference(storedPreference);
  if (normalizedStored !== undefined) return normalizedStored;

  if (envFlag != null) {
    return envFlag === "true" || envFlag === "1";
  }

  return true;
}
