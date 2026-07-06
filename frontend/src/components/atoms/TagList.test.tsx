import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TagList } from './TagList';

describe('TagList', () => {
  it('sanitizes tag labels and calculates remaining count from safe tags', () => {
    render(
      <TagList
        tags={[
          '\u001b]0;Hidden tag\u0007\u001b[31mReact\u001b[0m\u0000',
          '\u0007',
          'TypeScript',
          'Security',
        ]}
        maxVisible={2}
        showIcon={false}
      />
    );

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.queryByText(/Hidden tag/)).not.toBeInTheDocument();
    expect(screen.queryByText('Security')).not.toBeInTheDocument();
  });

  it('does not render when all tags are empty after sanitization', () => {
    const { container } = render(
      <TagList tags={['\u001b[31m\u001b[0m', '\u0000']} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('sanitizes container accessibility labels and preserves styling props', () => {
    const { container } = render(
      <TagList
        tags={['Alpha', 'Beta', 'Gamma']}
        maxVisible={1}
        showIcon
        variant='outline'
        size='lg'
        className='custom-tags'
        label={'\u001b]0;Hidden label\u0007\u001b[32mPost tags\u0007'}
        title={'\u001b]0;Hidden title\u0007Tags\u0008 title'}
      />
    );

    const list = container.firstElementChild;
    const remaining = screen.getByText('+2');

    expect(list).toHaveAttribute('aria-label', 'Post tags');
    expect(list).toHaveAttribute('title', 'Tags title');
    expect(list).toHaveClass('custom-tags');
    expect(screen.getByText('Alpha')).toHaveClass('text-sm');
    expect(remaining).toHaveAttribute('aria-label', '2 more tags');
    expect(list?.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0007');
  });

  it('omits empty sanitized accessibility attributes', () => {
    const { container } = render(
      <TagList
        tags={['Alpha']}
        label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      />
    );

    const list = container.firstElementChild;

    expect(list).not.toHaveAttribute('aria-label');
    expect(list).not.toHaveAttribute('title');
  });
});
