import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockAdminApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/services/admin/apiClient', () => ({
  adminApiFetch: mockAdminApiFetch,
}));

import {
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
      'Emergency migration backup',
    );

    expect(response.ok).toBe(true);
    expect(mockAdminApiFetch).toHaveBeenCalledWith('/export?includeValues=true', {
      pathPrefix: '/api/v1/admin/secrets',
      headers: { 'X-Break-Glass-Reason': 'Emergency migration backup' },
    });
  });
});
