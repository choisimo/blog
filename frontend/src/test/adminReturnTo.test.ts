import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_ADMIN_PATH,
  consumeAdminReturnPath,
  rememberAdminReturnPath,
  resolveAdminReturnPath,
} from '@/services/session/adminReturnTo';

describe('adminReturnTo service', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('stores and resolves only safe admin return paths', () => {
    expect(rememberAdminReturnPath('/admin/config/users?tab=roles#team')).toBe(
      '/admin/config/users?tab=roles#team',
    );
    expect(resolveAdminReturnPath()).toBe('/admin/config/users?tab=roles#team');

    expect(rememberAdminReturnPath('https://evil.test/admin/config')).toBe(DEFAULT_ADMIN_PATH);
    expect(rememberAdminReturnPath('/admin/login')).toBe(DEFAULT_ADMIN_PATH);
    expect(rememberAdminReturnPath('/blog')).toBe(DEFAULT_ADMIN_PATH);
    expect(rememberAdminReturnPath('/admin/config%0aLocation:%20/blog')).toBe(DEFAULT_ADMIN_PATH);
    expect(rememberAdminReturnPath('/admin/config%09tab')).toBe(DEFAULT_ADMIN_PATH);
    expect(rememberAdminReturnPath('/admin/config\u0000nul')).toBe(DEFAULT_ADMIN_PATH);
  });

  it('normalizes contaminated stored return paths without throwing', () => {
    sessionStorage.setItem('admin.returnTo', '/admin/auth/callback?next=/admin/config');

    expect(resolveAdminReturnPath()).toBe(DEFAULT_ADMIN_PATH);
    expect(sessionStorage.getItem('admin.returnTo')).toBe(DEFAULT_ADMIN_PATH);
  });

  it('keeps sessionStorage set failures non-fatal', () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

    expect(() => rememberAdminReturnPath('/admin/config/health')).not.toThrow();
    expect(setItemSpy).toHaveBeenCalled();
  });

  it('keeps sessionStorage get and remove failures non-fatal', () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
    const removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

    expect(resolveAdminReturnPath('/admin/config/health')).toBe('/admin/config/health');
    expect(consumeAdminReturnPath('/admin/config/health')).toBe('/admin/config/health');
    expect(getItemSpy).toHaveBeenCalled();
    expect(removeItemSpy).toHaveBeenCalled();
  });
});
