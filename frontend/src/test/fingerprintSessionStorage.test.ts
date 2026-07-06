import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSession,
  getCachedAdvancedVisitorId,
  getStoredFingerprintId,
  getStoredSessionToken,
} from '@/services/session/fingerprint';

vi.mock('@fingerprintjs/fingerprintjs', () => ({
  default: {
    load: vi.fn(),
  },
}));

vi.mock('@/utils/fingerprint', () => ({
  getAudioFingerprint: vi.fn(),
  getCanvasFingerprint: vi.fn(),
  getWebGLFingerprint: vi.fn(),
  sha256: vi.fn(),
}));

const SESSION_TOKEN_KEY = 'nodove_session_token';
const FINGERPRINT_ID_KEY = 'nodove_fingerprint_id';
const ADV_FINGERPRINT_KEY = 'nodove_adv_fingerprint';

describe('fingerprint session storage boundaries', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearSession();
  });

  afterEach(() => {
    clearSession();
    window.localStorage.clear();
  });

  it('returns valid stored session identifiers without clearing them', () => {
    window.localStorage.setItem(SESSION_TOKEN_KEY, 'session-token');
    window.localStorage.setItem(FINGERPRINT_ID_KEY, 'fingerprint-id');
    window.localStorage.setItem(ADV_FINGERPRINT_KEY, 'advanced-fingerprint-id');

    expect(getStoredSessionToken()).toBe('session-token');
    expect(getStoredFingerprintId()).toBe('fingerprint-id');
    expect(getCachedAdvancedVisitorId()).toBe('advanced-fingerprint-id');
    expect(window.localStorage.getItem(SESSION_TOKEN_KEY)).toBe('session-token');
    expect(window.localStorage.getItem(FINGERPRINT_ID_KEY)).toBe(
      'fingerprint-id'
    );
    expect(window.localStorage.getItem(ADV_FINGERPRINT_KEY)).toBe(
      'advanced-fingerprint-id'
    );
  });

  it('removes invalid stored session identifiers after rejecting them', () => {
    window.localStorage.setItem(SESSION_TOKEN_KEY, 'session token');
    window.localStorage.setItem(FINGERPRINT_ID_KEY, 'fingerprint\nid');
    window.localStorage.setItem(ADV_FINGERPRINT_KEY, '');

    expect(getStoredSessionToken()).toBeNull();
    expect(getStoredFingerprintId()).toBeNull();
    expect(getCachedAdvancedVisitorId()).toBeNull();
    expect(window.localStorage.getItem(SESSION_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(FINGERPRINT_ID_KEY)).toBeNull();
    expect(window.localStorage.getItem(ADV_FINGERPRINT_KEY)).toBeNull();
  });
});
