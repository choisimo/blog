import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsoleInput } from './ConsoleInput';

const baseProps = () => ({
  value: '',
  onChange: vi.fn(),
  onSubmit: vi.fn(),
  onStop: vi.fn(),
  isProcessing: false,
  mode: 'rag' as const,
  onModeChange: vi.fn(),
});

describe('ConsoleInput', () => {
  it('sanitizes root, textarea, button, and helper text labels', () => {
    const props = baseProps();
    const { container } = render(
      <ConsoleInput
        {...props}
        value='question'
        className='custom-console-input'
        label={'\u001b]0;Hidden label\u0007\u001b[31mAsk console\u0000'}
        title={'\u001b]0;Hidden title\u0007Console\u0007 input'}
        inputLabel={'\u001b]0;Hidden input\u0007\u001b[32mQuestion box\u0008'}
        placeholder={'\u001b]0;Hidden placeholder\u0007Ask\u0009 here'}
        submitLabel={'\u001b]0;Hidden submit\u0007\u001b[33mSend query\u000a'}
        newlineHint={'\u001b]0;Hidden hint\u0007Shift\u000b enter'}
      />
    );

    const root = container.firstElementChild;
    const textarea = screen.getByLabelText('Question box');
    const submitButton = screen.getByRole('button', { name: 'Send query' });

    expect(root).toHaveAttribute('aria-label', 'Ask console');
    expect(root).toHaveAttribute('title', 'Console input');
    expect(root).toHaveClass('custom-console-input');
    expect(textarea).toHaveAttribute('placeholder', 'Ask here');
    expect(screen.getByText('Shift enter')).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
    expect(root?.textContent).not.toContain('Hidden');
    expect(root?.textContent).not.toContain('\u001b');
    expect(root?.textContent).not.toContain('\u000b');
  });

  it('falls back to default text when sanitized labels are empty', () => {
    render(
      <ConsoleInput
        {...baseProps()}
        label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        inputLabel={'\u0007'}
        placeholder={'\u001b]0;Hidden placeholder\u0007\u001b[32m\u0008'}
        submitLabel={'\u0009'}
      />
    );

    expect(screen.getByLabelText('Console query')).toHaveAttribute(
      'placeholder',
      'Ask about blog content...'
    );
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

  it('preserves submit, stop, mode change, and keyboard behavior', () => {
    const props = baseProps();
    const { rerender } = render(<ConsoleInput {...props} value='question' />);

    fireEvent.keyDown(screen.getByLabelText('Console query'), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Agent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(props.onSubmit).toHaveBeenCalledTimes(2);
    expect(props.onModeChange).toHaveBeenCalledWith('agent');

    rerender(
      <ConsoleInput
        {...props}
        value='question'
        isProcessing
        stopLabel={'\u001b]0;Hidden stop\u0007\u001b[31mStop now\u0000'}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Stop now' }));

    expect(props.onStop).toHaveBeenCalledTimes(1);
  });

  it('marks active mode tabs and hides mode icons from assistive text', () => {
    render(<ConsoleInput {...baseProps()} mode='web' isMobile />);

    expect(screen.getByRole('button', { name: 'Web' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: 'RAG' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.queryByText('Shift+Enter for newline')).not.toBeInTheDocument();
  });
});
