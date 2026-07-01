import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
  it('labels the assistant send control', () => {
    renderBotChatPanel();

    expect(screen.getByRole('button', { name: 'Send assistant message' }))
      .toHaveAttribute('title', 'Send assistant message');
  });
});
