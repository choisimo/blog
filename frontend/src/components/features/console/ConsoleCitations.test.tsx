import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConsoleCitations } from './ConsoleCitations';

describe('ConsoleCitations', () => {
  it('sanitizes region labels, source text, and link accessibility names', () => {
    const { container } = render(
      <ConsoleCitations
        label={'\u001B]0;Hidden panel\u0007\u001b[31mSource panel\u0000'}
        title={'\u001B]0;Hidden title\u0007Panel\u0007 title'}
        sourcesLabel={'\u001B]0;Hidden sources\u0007\u001b[32mReferences\u0008'}
        className='custom-citations'
        citations={[
          {
            id: 'cite-1',
            title: '\u001B]0;Hidden source\u0007\u001b[33mSafe source\u0009',
            url: '\u001B]0;Hidden url\u0007https://example.com/source',
            snippet: '\u001B]0;Hidden snippet\u0007Snippet\u000a text',
            category: '\u001B]0;Hidden category\u0007\u001b[34mGuide\u000b',
            score: 0.72,
          },
        ]}
      />
    );

    const region = screen.getByRole('region', { name: 'Source panel' });
    const link = screen.getByRole('link', {
      name: 'Open source: Safe source',
    });

    expect(region).toHaveAttribute('title', 'Panel title');
    expect(region).toHaveClass('custom-citations');
    expect(screen.getByText('References')).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/source');
    expect(link).toHaveAttribute('title', 'Safe source');
    expect(screen.getByText('Snippet text')).toBeInTheDocument();
    expect(screen.getByText('Guide')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0009');
  });

  it('builds safe blog paths and rejects unsafe direct hrefs', () => {
    render(
      <ConsoleCitations
        citations={[
          {
            id: 'cite-1',
            title: 'Fallback source',
            url: 'javascript:alert(1)',
            year: '2026',
            slug: 'safe-post',
            snippet: '',
            score: 2,
          },
          {
            id: 'cite-2',
            title: 'Unsafe source',
            url: 'javascript:alert(1)',
            year: '2026%2Fadmin',
            slug: 'unsafe',
            snippet: '',
            score: -1,
          },
        ]}
      />
    );

    expect(
      screen.getByRole('link', { name: 'Open source: Fallback source' })
    ).toHaveAttribute('href', '/blog/2026/safe-post');
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Unsafe source')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Open source: Unsafe source' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders loading state with sanitized labels and nulls when empty idle', () => {
    const { container, rerender } = render(
      <ConsoleCitations
        isLoading
        citations={[]}
        label={'\u001B]0;Hidden loading\u0007\u001b[31mLoading sources\u0000'}
        sourcesLabel={'\u001B]0;Hidden label\u0007Loading\u0007'}
      />
    );

    expect(screen.getByRole('region', { name: 'Loading sources' })).toBeInTheDocument();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
    expect(container.textContent).not.toContain('\u001b');

    rerender(<ConsoleCitations citations={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
