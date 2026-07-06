import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsoleMessages } from '@/components/features/console/ConsoleMessages';
import type { ConsoleMessage } from '@/components/features/console/types';

vi.mock('@/components/features/console/ConsoleCitations', () => ({
  ConsoleCitations: () => <div data-testid="citations" />,
}));

describe('ConsoleMessages', () => {
  it('normalizes rendered user and system message text', () => {
    const messages: ConsoleMessage[] = [
      {
        id: 'user-1',
        role: 'user',
        content: ' hello\u0000\r\nworld ',
        timestamp: 1,
      },
      {
        id: 'system-1',
        role: 'system',
        content: ' status\r\nok ',
        timestamp: 2,
      },
    ];

    render(<ConsoleMessages messages={messages} />);

    expect(screen.getByText('hello\nworld')).toBeTruthy();
    expect(screen.getByText('status ok')).toBeTruthy();
  });

  it('normalizes assistant error text before rendering', () => {
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'answer',
        error: ' failed\r\nbadly\u0000 ',
        timestamp: 1,
      },
    ] as ConsoleMessage[];

    render(<ConsoleMessages messages={messages} />);

    expect(screen.getByText('failed badly')).toBeTruthy();
    expect(screen.queryByText(/failed\r?\nbadly/)).toBeNull();
  });

  it('strips ANSI escape sequences from rendered message and error text', () => {
    const messages = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '\u001B[31manswer\u001B[0m',
        error: '\u001B[31mfailed\u001B[0m',
        timestamp: 1,
      },
    ] as ConsoleMessage[];

    render(<ConsoleMessages messages={messages} />);

    expect(screen.getByText('answer')).toBeTruthy();
    expect(screen.getByText('failed')).toBeTruthy();
    expect(screen.queryByText(/\[31m/)).toBeNull();
  });
});
