import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAudioFingerprint } from '@/utils/fingerprint/audio';

const originalOfflineAudioContext = window.OfflineAudioContext;
const originalWebkitOfflineAudioContext = (
  window as Window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }
).webkitOfflineAudioContext;

function audioParam() {
  return { setValueAtTime: vi.fn() };
}

class MockOfflineAudioContext {
  currentTime = 0;
  destination = {};
  private readonly samples: unknown;

  constructor(_channels: number, _length: number, _sampleRate: number) {
    this.samples = MockOfflineAudioContext.nextSamples;
  }

  static nextSamples: unknown = new Float32Array([0.1, 0.2, 0.3]);

  createOscillator() {
    return {
      type: 'sine',
      frequency: audioParam(),
      connect: vi.fn(),
      start: vi.fn(),
    };
  }

  createDynamicsCompressor() {
    return {
      threshold: audioParam(),
      knee: audioParam(),
      ratio: audioParam(),
      attack: audioParam(),
      release: audioParam(),
      connect: vi.fn(),
    };
  }

  async startRendering() {
    return {
      getChannelData: () => this.samples,
    };
  }
}

describe('audio fingerprint utility', () => {
  afterEach(() => {
    Object.defineProperty(window, 'OfflineAudioContext', {
      configurable: true,
      value: originalOfflineAudioContext,
    });
    Object.defineProperty(window, 'webkitOfflineAudioContext', {
      configurable: true,
      value: originalWebkitOfflineAudioContext,
    });
    MockOfflineAudioContext.nextSamples = new Float32Array([0.1, 0.2, 0.3]);
    vi.restoreAllMocks();
  });

  it('fails closed when OfflineAudioContext is unavailable', async () => {
    Object.defineProperty(window, 'OfflineAudioContext', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, 'webkitOfflineAudioContext', {
      configurable: true,
      value: undefined,
    });

    await expect(getAudioFingerprint()).resolves.toBe('');
  });

  it('fails closed when rendered audio samples are malformed', async () => {
    Object.defineProperty(window, 'OfflineAudioContext', {
      configurable: true,
      value: MockOfflineAudioContext,
    });
    MockOfflineAudioContext.nextSamples = [0.1, Number.NaN];

    await expect(getAudioFingerprint()).resolves.toBe('');
  });

  it('hashes finite rendered audio samples', async () => {
    Object.defineProperty(window, 'OfflineAudioContext', {
      configurable: true,
      value: MockOfflineAudioContext,
    });

    await expect(getAudioFingerprint()).resolves.toMatch(/^[0-9a-f]+$/);
  });
});
