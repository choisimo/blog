import { describe, expect, it } from 'vitest';
import {
  normalizeRouteFormData,
  normalizeRouteRetries,
  normalizeRouteTimeoutSeconds,
} from '@/components/features/admin/ai/RoutesManager';

const baseRouteFormData = {
  name: ' default ',
  description: 'Default route',
  routingStrategy: 'latency-based-routing' as const,
  primaryModelId: ' model-primary ',
  fallbackModelIds: ['model-primary', ' model-fallback ', 'model-fallback'],
  contextWindowFallbackIds: [' context-model ', 'bad/model'],
  numRetries: 2,
  timeoutSeconds: 120,
  isDefault: false,
};

describe('RoutesManager normalization helpers', () => {
  it('normalizes route form selector lists and numeric bounds', () => {
    expect(
      normalizeRouteFormData({
        ...baseRouteFormData,
        numRetries: 999,
        timeoutSeconds: -1,
      }),
    ).toEqual({
      ...baseRouteFormData,
      name: 'default',
      primaryModelId: 'model-primary',
      fallbackModelIds: ['model-fallback'],
      contextWindowFallbackIds: ['context-model'],
      numRetries: 10,
      timeoutSeconds: 10,
    });
  });

  it('rejects route forms with unsafe required selectors', () => {
    expect(
      normalizeRouteFormData({
        ...baseRouteFormData,
        name: 'default%0Ainjected',
      }),
    ).toBeNull();
    expect(
      normalizeRouteFormData({
        ...baseRouteFormData,
        primaryModelId: '../model',
      }),
    ).toBeNull();
  });

  it('bounds retry and timeout helpers', () => {
    expect(normalizeRouteRetries(Number.NaN)).toBe(3);
    expect(normalizeRouteRetries(-1)).toBe(0);
    expect(normalizeRouteRetries(12.8)).toBe(10);
    expect(normalizeRouteTimeoutSeconds(Number.POSITIVE_INFINITY)).toBe(120);
    expect(normalizeRouteTimeoutSeconds(3)).toBe(10);
    expect(normalizeRouteTimeoutSeconds(700.9)).toBe(600);
  });
});
