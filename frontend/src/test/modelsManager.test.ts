import { describe, expect, it } from 'vitest';
import {
  normalizeModelFormData,
  normalizeModelOptionalNonNegativeNumber,
  normalizeModelOptionalPositiveInteger,
  normalizeModelPriority,
} from '@/components/features/admin/ai/ModelsManager';

const baseModelFormData = {
  modelName: 'gpt-4o',
  displayName: 'GPT-4o',
  providerId: ' openai ',
  modelIdentifier: 'openai/gpt-4o',
  description: '',
  contextWindow: 128000,
  maxTokens: 4096,
  inputCostPer1k: 0.01,
  outputCostPer1k: 0.03,
  supportsVision: true,
  supportsStreaming: true,
  supportsFunctionCalling: false,
  priority: 2,
};

describe('ModelsManager normalization helpers', () => {
  it('normalizes model numeric fields before submission', () => {
    expect(
      normalizeModelFormData({
        ...baseModelFormData,
        contextWindow: Number.NaN,
        maxTokens: -1,
        inputCostPer1k: Number.POSITIVE_INFINITY,
        outputCostPer1k: -0.5,
        priority: 2.9,
      }),
    ).toEqual({
      ...baseModelFormData,
      providerId: 'openai',
      contextWindow: undefined,
      maxTokens: undefined,
      inputCostPer1k: undefined,
      outputCostPer1k: undefined,
      priority: 2,
    });
  });

  it('rejects unsafe provider IDs before model submission', () => {
    expect(
      normalizeModelFormData({
        ...baseModelFormData,
        providerId: 'openai%0Ainjected',
      }),
    ).toBeNull();
  });

  it('bounds individual numeric helpers', () => {
    expect(normalizeModelOptionalPositiveInteger(10.8)).toBe(10);
    expect(normalizeModelOptionalPositiveInteger(0)).toBeUndefined();
    expect(normalizeModelOptionalNonNegativeNumber(0)).toBe(0);
    expect(normalizeModelOptionalNonNegativeNumber(-0.01)).toBeUndefined();
    expect(normalizeModelPriority(-2)).toBe(0);
    expect(normalizeModelPriority(Number.NaN)).toBe(0);
  });
});
