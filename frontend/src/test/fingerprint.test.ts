import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearSession,
  getCachedAdvancedVisitorId,
  getStoredFingerprintId,
  getStoredSessionToken,
  savePreference,
  validateSession,
} from '@/services/session/fingerprint';

describe('fingerprint session service storage boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('normalizes stored session and fingerprint identifiers before exposing them', () => {
    localStorage.setItem('nodove_session_token', ' session.token ');
    localStorage.setItem('nodove_fingerprint_id', ' fingerprint-id ');
    localStorage.setItem('nodove_adv_fingerprint', ' advanced-id ');

    expect(getStoredSessionToken()).toBe('session.token');
    expect(getStoredFingerprintId()).toBe('fingerprint-id');
    expect(getCachedAdvancedVisitorId()).toBe('advanced-id');

    localStorage.setItem('nodove_session_token', 'bad\ntoken');
    localStorage.setItem('nodove_fingerprint_id', 'bad\u0000id');
    localStorage.setItem('nodove_adv_fingerprint', 'bad id');

    expect(getStoredSessionToken()).toBeNull();
    expect(getStoredFingerprintId()).toBeNull();
    expect(getCachedAdvancedVisitorId()).toBeNull();
  });

  it('keeps localStorage read and remove failures non-fatal', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    expect(getStoredSessionToken()).toBeNull();
    expect(getStoredFingerprintId()).toBeNull();

    const removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

    expect(() => clearSession()).not.toThrow();
    expect(removeItemSpy).toHaveBeenCalled();
  });

  it('rejects invalid session tokens before making authenticated requests', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(validateSession('bad\ntoken')).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    localStorage.setItem('nodove_session_token', 'bad\ntoken');
    await expect(savePreference('theme', 'dark')).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
