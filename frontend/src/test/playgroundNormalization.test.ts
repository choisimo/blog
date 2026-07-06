import { describe, expect, it } from 'vitest';
import {
  normalizePlaygroundMaxTokens,
  normalizePlaygroundTemperature,
  parsePlaygroundMaxTokensInput,
} from '@/components/features/admin/ai/Playground';

describe('Playground numeric normalization', () => {
  it('bounds playground temperature to the supported slider range', () => {
    expect(normalizePlaygroundTemperature(0.2)).toBe(0.2);
    expect(normalizePlaygroundTemperature(-1)).toBe(0);
    expect(normalizePlaygroundTemperature(3)).toBe(2);
    expect(normalizePlaygroundTemperature(Number.NaN)).toBe(0.7);
    expect(normalizePlaygroundTemperature(null)).toBe(0.7);
  });

  it('allows only positive finite max token integers within the playground cap', () => {
    expect(normalizePlaygroundMaxTokens(4096)).toBe(4096);
    expect(normalizePlaygroundMaxTokens(12.8)).toBe(12);
    expect(normalizePlaygroundMaxTokens(0)).toBeUndefined();
    expect(normalizePlaygroundMaxTokens(-1)).toBeUndefined();
    expect(normalizePlaygroundMaxTokens(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(normalizePlaygroundMaxTokens(1_000_001)).toBeUndefined();
  });

  it('parses max token input without accepting exponent or malformed values', () => {
    expect(parsePlaygroundMaxTokensInput(' 2048 ')).toBe(2048);
    expect(parsePlaygroundMaxTokensInput('')).toBeUndefined();
    expect(parsePlaygroundMaxTokensInput('1e4')).toBeUndefined();
    expect(parsePlaygroundMaxTokensInput('12.5')).toBeUndefined();
    expect(parsePlaygroundMaxTokensInput('abc')).toBeUndefined();
  });
});
