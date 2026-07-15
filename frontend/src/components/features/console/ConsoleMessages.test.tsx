import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConsoleMessages } from './ConsoleMessages';

vi.mock('./ConsoleCitations', () => ({
  ConsoleCitations: () => <div data-testid='console-citations' />,
}));

describe('ConsoleMessages', () => {
  it('sanitizes message log labels, message bodies, and errors', () => {
    const { container } = render(
      <ConsoleMessages
        label={'\u001B]0;Hidden log\u0007\u001b[31mConversation log\u0000'}
        title={'\u001B]0;Hidden title\u0007Messages\u0007 title'}
        className='custom-messages'
        messages={[
          {
            id: 'user-1',
            role: 'user',
            content: '\u001B]0;Hidden question\u0007\u001b[32mQuestion\u0008 body',
            timestamp: 0,
          },
          {
            id: 'assistant-1',
            role: 'assistant',
            content: '\u001B]0;Hidden answer\u0007Answer\u0009 body',
            timestamp: 0,
            error: '\u001B]0;Hidden error\u0007\u001b[33mFailed\u000a',
            citations: [{ id: 'cite-1', title: 'Citation', snippet: 'Snippet', score: 1 }],
          },
        ]}
      />
    );

    const log = screen.getByRole('log', { name: 'Conversation log' });

    expect(log).toHaveAttribute('title', 'Messages title');
    expect(log).toHaveClass('custom-messages');
    expect(screen.getByText('Question body')).toBeInTheDocument();
    expect(screen.getByText('Answer body')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByTestId('console-citations')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0008');
  });

  it('sanitizes empty state copy and preserves terminal styling path', () => {
    const { container } = render(
      <ConsoleMessages
        messages={[]}
        isTerminal
        emptyTitle={'\u001B]0;Hidden empty\u0007\u001b[31mEmpty console\u0000'}
        emptyDescription={'\u001B]0;Hidden description\u0007Ask\u0007 now'}
      />
    );

    expect(screen.getByRole('heading', { name: 'Empty console' })).toBeInTheDocument();
    expect(screen.getByText('Ask now')).toBeInTheDocument();
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).not.toContain('\u001b');
  });

  it('shows decorative streaming indicator when assistant content is empty', () => {
    const { container } = render(
      <ConsoleMessages
        messages={[
          {
            id: 'assistant-stream',
            role: 'assistant',
            content: '',
            timestamp: 0,
            isStreaming: true,
          },
        ]}
      />
    );

    expect(screen.getByRole('log', { name: 'Console messages' })).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });
});
