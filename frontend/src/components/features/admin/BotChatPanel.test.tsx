import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunBlogAgent = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => vi.fn());

vi.mock('@/services/session/agent', () => ({
  runBlogAgent: mockRunBlogAgent,
}));

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

import BotChatPanel from './BotChatPanel';

function renderBotChatPanel() {
  const noop = vi.fn();

  render(
    <BotChatPanel
      title="Draft"
      slug="draft"
      year="2026"
      category="dev"
      tags="ai"
      coverImage=""
      content="Draft content"
      setTitle={noop}
      setSlug={noop}
      setContent={noop}
      setTags={noop}
      setCategory={noop}
      setCoverImage={noop}
      onInsertMarkdown={noop}
    />,
  );
}

describe('BotChatPanel', () => {
  beforeEach(() => {
    mockRunBlogAgent.mockReset();
    mockToast.mockReset();
  });

  it('labels the assistant send control', () => {
    renderBotChatPanel();

    expect(screen.getByRole('button', { name: 'Send assistant message' }))
      .toHaveAttribute('title', 'Send assistant message');
  });

  it('prevents Enter key duplicate sends while an assistant request is running', async () => {
    const user = userEvent.setup();
    let resolveAgent: (
      value: Awaited<ReturnType<typeof mockRunBlogAgent>>,
    ) => void = () => undefined;
    mockRunBlogAgent.mockReturnValue(
      new Promise((resolve) => {
        resolveAgent = resolve;
      }),
    );

    renderBotChatPanel();

    const input = screen.getByPlaceholderText('AI에게 무엇이든 요청하세요...');
    await user.type(input, '초안 개선');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockRunBlogAgent).toHaveBeenCalledTimes(1);
    });

    await user.type(input, '다시 요청');
    await user.keyboard('{Enter}');

    expect(mockRunBlogAgent).toHaveBeenCalledTimes(1);

    resolveAgent({
      response: '처리되었습니다.',
      actions: [],
      toolsUsed: [],
    });
  });
});
