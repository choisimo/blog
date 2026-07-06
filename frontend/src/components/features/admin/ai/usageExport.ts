const EXPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeAIConfigExportDate(value: unknown): string {
  if (typeof value !== 'string') return 'unknown-date';

  const candidate = value.trim();
  if (!candidate || /[\u0000-\u001F\u007F\s\\/]/.test(candidate)) {
    return 'unknown-date';
  }

  const dateSegment = candidate.split('T')[0];
  return EXPORT_DATE_PATTERN.test(dateSegment) ? dateSegment : 'unknown-date';
}

export function buildAIConfigExportFilename(exportedAt: unknown): string {
  return `ai-config-export-${normalizeAIConfigExportDate(exportedAt)}.json`;
}
