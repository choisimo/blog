import { describe, expect, it } from 'vitest';

import {
  normalizeAdminSelector,
  normalizeDisplayText,
} from '@/components/features/admin/ai/TraceViewer';

describe('TraceViewer normalization helpers', () => {
  it('normalizes safe admin selectors and rejects unsafe trace identifiers', () => {
    expect(normalizeAdminSelector(' trace-123 ')).toBe('trace-123');
    expect(normalizeAdminSelector('trace_123.4')).toBe('trace_123.4');

    expect(normalizeAdminSelector('trace%0A123')).toBeNull();
    expect(normalizeAdminSelector('../trace')).toBeNull();
    expect(normalizeAdminSelector('trace\\id')).toBeNull();
    expect(normalizeAdminSelector('')).toBeNull();
  });

  it('falls back when display text contains raw or encoded controls', () => {
    expect(normalizeDisplayText(' model-A ', 'unknown')).toBe('model-A');

    expect(normalizeDisplayText('line\nbreak', 'unknown')).toBe('unknown');
    expect(normalizeDisplayText('line%0Abreak', 'unknown')).toBe('unknown');
    expect(normalizeDisplayText('bad\u0000value', 'unknown')).toBe('unknown');
    expect(normalizeDisplayText('\tindented', 'unknown')).toBe('unknown');
  });
});
