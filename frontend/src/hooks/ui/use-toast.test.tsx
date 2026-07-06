import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast, useToast } from './use-toast';

vi.mock('@/utils/ui/haptics', () => ({
  hapticSuccess: vi.fn(),
  hapticError: vi.fn(),
  hapticLight: vi.fn(),
}));

describe('use-toast state boundary', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useToast());
    result.current.dismiss();
  });

  it('sanitizes toast title and description before storing them in state', async () => {
    const { result } = renderHook(() => useToast());

    toast({
      title: '\u001b[31mSaved\u001b[0m\u0000',
      description: '\u001b[32mChanges persisted\u001b[0m\u0007',
    });

    await waitFor(() => {
      expect(result.current.toasts).toHaveLength(1);
    });
    expect(result.current.toasts[0].title).toBe('Saved');
    expect(result.current.toasts[0].description).toBe('Changes persisted');
  });

  it('sanitizes toast title and description on updates', async () => {
    const { result } = renderHook(() => useToast());

    const created = toast({
      title: 'Initial',
      description: 'Initial description',
    });
    created.update({
      id: created.id,
      title: '\u001b[31mUpdated\u001b[0m\u0000',
      description: '\u001b[32mUpdated description\u001b[0m\u0007',
    });

    await waitFor(() => {
      expect(result.current.toasts[0]?.title).toBe('Updated');
    });
    expect(result.current.toasts[0].description).toBe('Updated description');
  });
});
