import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockAdminApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/services/admin/apiClient', () => ({
  adminApiFetch: mockAdminApiFetch,
}));

import {
  useAuditLog,
  useSecrets,
  useSecretsExport,
} from '@/components/features/admin/secrets/hooks';

describe('admin secrets hooks', () => {
  afterEach(() => {
    mockAdminApiFetch.mockReset();
  });

  it('sends a break-glass reason when revealing a plaintext secret', async () => {
    mockAdminApiFetch.mockResolvedValue({
      ok: true,
      data: {
        id: 'sec_1',
        keyName: 'OPENAI_API_KEY',
        value: 'secret-value',
      },
    });

    const { result } = renderHook(() => useSecrets());
    const response = await result.current.revealSecret(
      'sec_1',
      'Rotating production provider key',
    );

    expect(response.ok).toBe(true);
    expect(mockAdminApiFetch).toHaveBeenCalledWith('/sec_1/reveal', {
      pathPrefix: '/api/v1/admin/secrets',
      method: 'POST',
      body: { reason: 'Rotating production provider key' },
    });
  });

  it('rejects polluted secret ids before revealing plaintext values', async () => {
    const { result } = renderHook(() => useSecrets());
    const response = await result.current.revealSecret(
      'sec_1\r\nX-Injected: yes',
      'Rotating production provider key',
    );

    expect(response).toEqual({
      ok: false,
      error: 'Invalid secret identifier',
    });
    expect(mockAdminApiFetch).not.toHaveBeenCalled();
  });

  it('normalizes audit log query filters before fetching logs', async () => {
    mockAdminApiFetch.mockResolvedValue({
      ok: true,
      data: {
        logs: [],
        pagination: { total: 0, limit: 20, offset: 0 },
      },
    });

    const { result } = renderHook(() => useAuditLog());
    await act(async () => {
      await result.current.fetchLogs({
        secretId: ' sec_1 ',
        action: ' Accessed ',
        limit: 20,
        offset: 0,
      });
    });

    expect(mockAdminApiFetch).toHaveBeenCalledWith(
      '/audit?secretId=sec_1&action=accessed&limit=20&offset=0',
      { pathPrefix: '/api/v1/admin/secrets' },
    );
  });

  it('rejects polluted audit log filters before API calls', async () => {
    const { result } = renderHook(() => useAuditLog());

    await act(async () => {
      await result.current.fetchLogs({
        secretId: 'sec_1',
        action: 'accessed\r\nX-Injected: yes',
      });
    });

    expect(result.current.error).toBe('Invalid audit log filter');
    expect(mockAdminApiFetch).not.toHaveBeenCalled();
  });

  it('sends a break-glass reason header when exporting plaintext values', async () => {
    mockAdminApiFetch.mockResolvedValue({
      ok: true,
      data: {
        exportedAt: '2026-07-01T00:00:00.000Z',
        categories: [],
        secrets: [],
      },
    });

    const { result } = renderHook(() => useSecretsExport());
    const response = await result.current.exportSecrets(
      true,
      'Emergency migration\r\nbackup',
    );

    expect(response.ok).toBe(true);
    expect(mockAdminApiFetch).toHaveBeenCalledWith('/export?includeValues=true', {
      pathPrefix: '/api/v1/admin/secrets',
      headers: { 'X-Break-Glass-Reason': 'Emergency migration backup' },
    });
  });

  it('rejects polluted secret import selector fields before API calls', async () => {
    const { result } = renderHook(() => useSecretsExport());

    const response = await result.current.importSecrets([
      {
        categoryId: 'general\r\nX-Injected: yes',
        keyName: 'API_KEY',
        displayName: 'API key',
        value: 'secret-value',
      },
    ]);

    expect(response).toEqual({
      ok: false,
      error: 'Invalid secret import payload',
    });
    expect(mockAdminApiFetch).not.toHaveBeenCalled();
  });

  it('normalizes secret generator payloads before API calls', async () => {
    mockAdminApiFetch.mockResolvedValue({
      ok: true,
      data: { value: 'generated-secret', type: 'apiKey' },
    });

    const { result } = renderHook(() => useSecrets());
    const response = await result.current.generateValue(
      'apiKey',
      32,
      ' Prod\r\nToken\u0000 ',
    );

    expect(response.ok).toBe(true);
    expect(mockAdminApiFetch).toHaveBeenCalledWith('/generate', {
      pathPrefix: '/api/v1/admin/secrets',
      method: 'POST',
      body: { type: 'apiKey', length: 32, prefix: 'Prod Token' },
    });
  });

  it('rejects invalid secret generator runtime inputs before API calls', async () => {
    const { result } = renderHook(() => useSecrets());
    const response = await result.current.generateValue(
      'apiKey\r\nX-Injected' as 'apiKey',
      -1,
      'prefix',
    );

    expect(response).toEqual({
      ok: false,
      error: 'Invalid secret generator payload',
    });
    expect(mockAdminApiFetch).not.toHaveBeenCalled();
  });
});
