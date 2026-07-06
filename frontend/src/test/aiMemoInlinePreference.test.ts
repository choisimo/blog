import { describe, expect, it } from 'vitest';
import {
  normalizeAiMemoInlineEnabledPreference,
  resolveAiMemoInlineEnabledPreference,
} from '@/utils/aiMemoInlinePreference';

describe('aiMemo inline preference', () => {
  it('normalizes JSON booleans and numeric aliases', () => {
    expect(normalizeAiMemoInlineEnabledPreference('true')).toBe(true);
    expect(normalizeAiMemoInlineEnabledPreference('false')).toBe(false);
    expect(normalizeAiMemoInlineEnabledPreference('1')).toBe(true);
    expect(normalizeAiMemoInlineEnabledPreference('0')).toBe(false);
  });

  it('rejects malformed or non-boolean stored values', () => {
    expect(normalizeAiMemoInlineEnabledPreference('"false"')).toBeUndefined();
    expect(normalizeAiMemoInlineEnabledPreference('null')).toBeUndefined();
    expect(normalizeAiMemoInlineEnabledPreference('{}')).toBeUndefined();
    expect(normalizeAiMemoInlineEnabledPreference('not-json')).toBeUndefined();
  });

  it('defaults to enabled when no valid stored preference exists', () => {
    expect(resolveAiMemoInlineEnabledPreference(null)).toBe(true);
    expect(resolveAiMemoInlineEnabledPreference('"false"')).toBe(true);
    expect(resolveAiMemoInlineEnabledPreference('false')).toBe(false);
  });
});
