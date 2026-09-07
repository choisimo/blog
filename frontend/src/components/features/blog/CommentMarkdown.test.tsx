import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import CommentMarkdown from './CommentMarkdown';

describe('CommentMarkdown', () => {
  it('uses the comment profile, strips raw HTML and unwraps unsafe links', () => {
    const { container } = render(
      <CommentMarkdown
        content={'<script>alert(1)</script>\n\n[safe](/post) [bad](javascript:alert(1)) ![x](https://example.com/x.png)'}
      />,
    );

    expect(container.firstElementChild).toHaveAttribute(
      'data-markdown-profile',
      'comment',
    );
    expect(screen.getByRole('link', { name: 'safe' })).toHaveAttribute('href', '/post');
    expect(screen.queryByRole('link', { name: 'bad' })).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('alert(1)');
  });

  it('marks a partial AI comment busy without rewriting its source', () => {
    const { container } = render(
      <CommentMarkdown isStreaming content={'partial **draft'} />,
    );
    expect(container.firstElementChild).toHaveAttribute('aria-busy', 'true');
    expect(container).toHaveTextContent('partial **draft');
    expect(container.querySelector('strong')).not.toBeInTheDocument();
  });
});
