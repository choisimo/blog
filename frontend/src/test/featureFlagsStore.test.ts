import { afterEach, describe, expect, it } from 'vitest';
import {
  mergeFeatureFlags,
  useFeatureFlagsStore,
} from '@/stores/runtime/useFeatureFlagsStore';

describe('feature flags store boundaries', () => {
  afterEach(() => {
    useFeatureFlagsStore.getState().resetToDefaults();
  });

  it('accepts only boolean feature flag values when merging runtime config', () => {
    expect(
      mergeFeatureFlags({
        aiEnabled: true,
        ragEnabled: 'true' as unknown as boolean,
        terminalEnabled: 1 as unknown as boolean,
        aiInline: false,
        codeExecutionEnabled: null as unknown as boolean,
        commentsEnabled: true,
      })
    ).toEqual({
      aiEnabled: true,
      ragEnabled: false,
      terminalEnabled: false,
      aiInline: false,
      codeExecutionEnabled: false,
      commentsEnabled: true,
    });
  });

  it('normalizes manual store overrides before updating flags', () => {
    useFeatureFlagsStore.getState().setFlags({
      aiEnabled: true,
      commentsEnabled: 'yes' as unknown as boolean,
    });

    expect(useFeatureFlagsStore.getState().flags).toMatchObject({
      aiEnabled: true,
      commentsEnabled: false,
    });
  });
});
