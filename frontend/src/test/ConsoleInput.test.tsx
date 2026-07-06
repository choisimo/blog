import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsoleInput } from '@/components/features/console/ConsoleInput';

function renderConsoleInput(overrides: Partial<React.ComponentProps<typeof ConsoleInput>> = {}) {
  return render(
    <ConsoleInput
      value=""
      onChange={vi.fn()}
      onSubmit={vi.fn()}
      onStop={vi.fn()}
      isProcessing={false}
      mode="rag"
      onModeChange={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ConsoleInput', () => {
  it('normalizes non-string runtime values before submit checks', () => {
    const onSubmit = vi.fn();

    renderConsoleInput({
      value: 42 as any,
      onSubmit,
    });

    expect(screen.getByRole('textbox')).toHaveValue('42');

    const submitButton = screen.getByRole('button', { name: 'Send message' });
    expect(submitButton).not.toBeDisabled();

    fireEvent.click(submitButton);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does not submit Enter while IME composition is active', () => {
    const onSubmit = vi.fn();

    renderConsoleInput({
      value: '검색어',
      onSubmit,
    });

    const textarea = screen.getByRole('textbox');
    fireEvent.keyDown(textarea, { key: 'Enter', isComposing: true });
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('falls back to the RAG tab for polluted runtime mode values', () => {
    renderConsoleInput({
      mode: 'rag\u0000' as any,
    });

    const ragTab = screen.getByRole('button', { name: /RAG/i });
    expect(ragTab.className).toContain('border-primary');
  });
});
