import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BotChatPanel from '@/components/features/admin/BotChatPanel';

const agentMocks = vi.hoisted(() => ({
  runBlogAgent: vi.fn(),
  toast: vi.fn(),
}));

vi.mock('@/services/session/agent', () => ({
  runBlogAgent: agentMocks.runBlogAgent,
}));

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: () => ({ toast: agentMocks.toast }),
}));

function renderPanel(overrides: Partial<React.ComponentProps<typeof BotChatPanel>> = {}) {
  const props: React.ComponentProps<typeof BotChatPanel> = {
    title: '',
    slug: '',
    year: '2026',
    category: '',
    tags: '',
    coverImage: '',
    content: '',
    setTitle: vi.fn(),
    setSlug: vi.fn(),
    setContent: vi.fn(),
    setTags: vi.fn(),
    setCategory: vi.fn(),
    setCoverImage: vi.fn(),
    onInsertMarkdown: vi.fn(),
    ...overrides,
  };

  render(<BotChatPanel {...props} />);
  return props;
}

describe('BotChatPanel editor actions', () => {
  beforeEach(() => {
    agentMocks.runBlogAgent.mockReset();
    agentMocks.toast.mockReset();
  });

  it('normalizes unsafe AI-provided slug actions before updating editor state', async () => {
    const setSlug = vi.fn();
    agentMocks.runBlogAgent.mockResolvedValue({
      response: 'updated',
      toolsUsed: [],
      actions: [
        {
          type: 'set_slug',
          value: '../Draft Title\r\nX-Injected: yes%2Fsafe',
        },
      ],
    });

    renderPanel({ setSlug });

    fireEvent.change(screen.getByPlaceholderText('AI에게 무엇이든 요청하세요...'), {
      target: { value: 'set the slug' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Send assistant message' })
    );

    await waitFor(() => {
      expect(setSlug).toHaveBeenCalledWith('draft-title-x-injected-yes-safe');
    });
  });
});
