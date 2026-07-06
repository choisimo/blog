import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SafeDescriptionMarkdown } from '@/components/features/blog/SafeDescriptionMarkdown';

describe('SafeDescriptionMarkdown', () => {
  it('normalizes description markdown text before rendering', () => {
    render(<SafeDescriptionMarkdown text={' Hello\u0000\r\n**world** '} />);

    expect(screen.getByText(/Hello/)).toBeInTheDocument();
    expect(screen.getByText('world')).toBeInTheDocument();
    expect(screen.queryByText(/\u0000/)).not.toBeInTheDocument();
  });

  it('renders safe links with normalized hrefs and unwraps unsafe links', () => {
    render(
      <SafeDescriptionMarkdown
        text={[
          '[External]( https://example.com/path )',
          '[Relative]( /blog/2026/post )',
          '[Unsafe](javascript:alert(1))',
          '[Protocol](//evil.test/path)',
          '[EncodedControl](https://example.com/%0a)',
          '[EncodedSeparator](/blog/2026%2Fpost)',
          '[Credential](https://user:pass@example.com/path)',
        ].join('\n\n')}
      />,
    );

    expect(screen.getByRole('link', { name: 'External' })).toHaveAttribute(
      'href',
      'https://example.com/path',
    );
    expect(screen.getByRole('link', { name: 'Relative' })).toHaveAttribute(
      'href',
      '/blog/2026/post',
    );
    expect(screen.queryByRole('link', { name: 'Unsafe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Protocol' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'EncodedControl' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'EncodedSeparator' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Credential' })).not.toBeInTheDocument();
    expect(screen.getByText('Unsafe')).toBeInTheDocument();
    expect(screen.getByText('Protocol')).toBeInTheDocument();
    expect(screen.getByText('EncodedControl')).toBeInTheDocument();
    expect(screen.getByText('EncodedSeparator')).toBeInTheDocument();
    expect(screen.getByText('Credential')).toBeInTheDocument();
  });

  it('allows mailto and fragment links but strips html image output', () => {
    render(
      <SafeDescriptionMarkdown text={'[Mail](mailto:test@example.com) [Jump](#section)\n\n![x](/x.png)'} />,
    );

    expect(screen.getByRole('link', { name: 'Mail' })).toHaveAttribute(
      'href',
      'mailto:test@example.com',
    );
    expect(screen.getByRole('link', { name: 'Jump' })).toHaveAttribute('href', '#section');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
