import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIConsole, normalizeConsoleCitation } from './AIConsole';

const { consoleMocks } = vi.hoisted(() => ({
  consoleMocks: {
    isMobile: false,
    isTerminal: false,
    state: {
      mode: 'rag',
      input: '',
      isProcessing: false,
      messages: [],
      traces: [],
      error: null as string | null,
    },
    actions: {
      clearAll: vi.fn(),
      setInput: vi.fn(),
      setMode: vi.fn(),
      setProcessing: vi.fn(),
      addUserMessage: vi.fn(),
      createAbortController: vi.fn(() => new AbortController()),
      addTrace: vi.fn(),
      updateTrace: vi.fn(),
      setCitations: vi.fn(),
      addAssistantMessage: vi.fn(),
      appendAssistantContent: vi.fn(),
      finishAssistantMessage: vi.fn(),
      setError: vi.fn(),
      abort: vi.fn(),
    },
  },
}));

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => consoleMocks.isMobile,
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: consoleMocks.isTerminal }),
}));

vi.mock('@/services/discovery/rag', () => ({
  hybridSearch: vi.fn(),
}));

vi.mock('@/services/discovery/webSearch', () => ({
  searchWeb: vi.fn(),
}));

vi.mock('@/services/chat', () => ({
  streamChatEvents: vi.fn(),
}));

vi.mock('./useConsoleState', () => ({
  useConsoleState: () => ({
    state: consoleMocks.state,
    actions: consoleMocks.actions,
  }),
}));

vi.mock('./ConsoleMessages', () => ({
  ConsoleMessages: ({
    className,
  }: {
    className?: string;
  }) => <div data-testid='console-messages' className={className} />,
}));

vi.mock('./ConsoleInput', () => ({
  ConsoleInput: () => <div data-testid='console-input' />,
}));

vi.mock('./ConsoleTrace', () => ({
  ConsoleTrace: () => <div data-testid='console-trace' />,
}));

describe('AIConsole', () => {
  beforeEach(() => {
    consoleMocks.isMobile = false;
    consoleMocks.isTerminal = false;
    consoleMocks.state = {
      mode: 'rag',
      input: '',
      isProcessing: false,
      messages: [],
      traces: [],
      error: null,
    };
    Object.values(consoleMocks.actions).forEach((action) => {
      if (typeof action === 'function' && 'mockReset' in action) {
        action.mockReset();
      }
    });
    consoleMocks.actions.createAbortController.mockReturnValue(new AbortController());
  });

  it('sanitizes root and control accessibility labels while preserving callbacks', () => {
    const onClose = vi.fn();
    const onToggleMinimize = vi.fn();

    render(
      <AIConsole
        label={'\u001B]0;Hidden label\u0007\u001b[31mResearch console\u0000'}
        title={'\u001B]0;Hidden title\u0007Console\u0007 title'}
        clearLabel={'\u001B]0;Hidden clear\u0007\u001b[32mClear chat\u0008'}
        minimizeLabel={'\u001B]0;Hidden minimize\u0007Minimize\u0009 chat'}
        closeLabel={'\u001B]0;Hidden close\u0007\u001b[33mClose chat\u000a'}
        className='custom-console'
        onClose={onClose}
        onToggleMinimize={onToggleMinimize}
      />
    );

    const consoleRegion = screen.getByRole('region', {
      name: 'Research console',
    });
    const clearButton = screen.getByRole('button', { name: 'Clear chat' });
    const minimizeButton = screen.getByRole('button', { name: 'Minimize chat' });
    const closeButton = screen.getByRole('button', { name: 'Close chat' });

    expect(consoleRegion).toHaveAttribute('title', 'Console title');
    expect(consoleRegion).toHaveClass('custom-console');

    fireEvent.click(clearButton);
    fireEvent.click(minimizeButton);
    fireEvent.click(closeButton);

    expect(consoleMocks.actions.clearAll).toHaveBeenCalledTimes(1);
    expect(onToggleMinimize).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(consoleRegion.textContent).not.toContain('Hidden');
    expect(consoleRegion.textContent).not.toContain('\u001b');
  });

  it('sanitizes error banner text and hides minimized content', () => {
    consoleMocks.state.error =
      '\u001B]0;Hidden error\u0007\u001b[31mSearch failed\u0000';

    const { rerender } = render(<AIConsole />);

    expect(screen.getByText('Search failed')).toBeInTheDocument();
    expect(screen.getByTestId('console-messages')).toBeInTheDocument();

    rerender(<AIConsole isMinimized />);

    expect(screen.queryByTestId('console-messages')).not.toBeInTheDocument();
    expect(screen.queryByText('Search failed')).not.toBeInTheDocument();
  });

  it('strips OSC and CSI ANSI escape sequences from normalized citations', () => {
    expect(
      normalizeConsoleCitation({
        id: '\u001B]0;Hidden id\u0007\u001b[31mcite-1\u0000',
        title: '\u001B]0;Hidden title\u0007\u001b[32mSafe source\u0000',
        url: '\u001B]0;Hidden url\u0007https://example.com/source',
        slug: '\u001B]0;Hidden slug\u0007safe-post',
        year: '\u001B]0;Hidden year\u00072026',
        snippet: '\u001B]0;Hidden snippet\u0007Snippet\u000b body',
        category: '\u001B]0;Hidden category\u0007Guide',
        score: 0.5,
      }),
    ).toEqual({
      id: 'cite-1',
      title: 'Safe source',
      url: 'https://example.com/source',
      slug: 'safe-post',
      year: '2026',
      snippet: 'Snippet body',
      score: 0.5,
      category: 'Guide',
    });
  });
});
