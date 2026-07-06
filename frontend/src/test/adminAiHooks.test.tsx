import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockAdminApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/services/admin/apiClient', () => ({
  adminApiFetch: mockAdminApiFetch,
}));

import { useUsage } from '@/components/features/admin/ai/hooks';

describe('admin AI hooks', () => {
  afterEach(() => {
    mockAdminApiFetch.mockReset();
  });

  it('rejects control-contaminated usage date filters before API calls', async () => {
    const { result } = renderHook(() => useUsage());

    await act(async () => {
      await result.current.fetchUsage({
        startDate: '2026-07-03\u0000',
      });
    });

    expect(result.current.error).toBe('Invalid usage start date');
    expect(mockAdminApiFetch).not.toHaveBeenCalled();
  });
});
