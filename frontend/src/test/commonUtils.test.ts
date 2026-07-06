import { describe, expect, it } from 'vitest';

import {
  formatFileSize,
  isValidEmail,
  isValidUrl,
  stripMarkdown,
} from '@/utils/shared/common';

describe('shared common utilities', () => {
  it('formats invalid or non-positive file sizes as zero bytes', () => {
    expect(formatFileSize(Number.NaN)).toBe('0 B');
    expect(formatFileSize(Number.POSITIVE_INFINITY)).toBe('0 B');
    expect(formatFileSize(-1)).toBe('0 B');
  });

  it('bounds very large file sizes to the largest known unit', () => {
    expect(formatFileSize(1024 ** 6)).toBe('1024 TB');
  });

  it('fails closed for invalid email runtime inputs', () => {
    expect(isValidEmail(null as unknown as string)).toBe(false);
    expect(isValidEmail(' user@example.com ')).toBe(true);
  });

  it('accepts only http and https URLs', () => {
    expect(isValidUrl(' https://example.com ')).toBe(true);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl(null as unknown as string)).toBe(false);
  });

  it('rejects URLs with internal whitespace or control characters', () => {
    expect(isValidUrl('https://example.com/a b')).toBe(false);
    expect(isValidUrl('https://example.com/\npath')).toBe(false);
    expect(isValidUrl('https://example.com/\u0000path')).toBe(false);
  });

  it('handles invalid markdown input and max lengths safely', () => {
    expect(stripMarkdown(null as unknown as string)).toBe('');
    expect(stripMarkdown('**Hello** world', Number.NaN)).toBe('Hello world');
    expect(stripMarkdown('**Hello** world', -1)).toBe('');
  });
});
