import { describe, expect, it } from 'vitest';
import {
  buildAIConfigExportFilename,
  normalizeAIConfigExportDate,
} from '@/components/features/admin/ai/usageExport';

describe('AI config export filename helpers', () => {
  it('uses valid ISO date segments in export filenames', () => {
    expect(normalizeAIConfigExportDate('2026-07-03T10:20:30.000Z')).toBe(
      '2026-07-03'
    );
    expect(buildAIConfigExportFilename('2026-07-03T10:20:30.000Z')).toBe(
      'ai-config-export-2026-07-03.json'
    );
  });

  it('falls back when exportedAt is malformed or filename-unsafe', () => {
    expect(normalizeAIConfigExportDate(undefined)).toBe('unknown-date');
    expect(normalizeAIConfigExportDate('')).toBe('unknown-date');
    expect(normalizeAIConfigExportDate('2026/07/03T10:20:30.000Z')).toBe(
      'unknown-date'
    );
    expect(normalizeAIConfigExportDate('2026-07-03\nsuffix')).toBe(
      'unknown-date'
    );
    expect(buildAIConfigExportFilename('not-a-date')).toBe(
      'ai-config-export-unknown-date.json'
    );
  });
});
