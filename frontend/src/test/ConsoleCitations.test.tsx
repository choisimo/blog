import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConsoleCitations } from '@/components/features/console/ConsoleCitations';

describe('ConsoleCitations', () => {
  it('renders unsafe direct citation URLs as plain text', () => {
    render(
      <ConsoleCitations
        citations={[
          {
            id: 'unsafe-url',
            title: ' Unsafe\nSource\u0000Title ',
            url: 'javascript:alert(1)',
            score: Number.NaN,
            snippet: ' First line\nsecond line ',
            category: ' AI\nSearch ',
          } as any,
        ]}
      />,
    );

    expect(screen.queryByRole('link', { name: /Unsafe Source Title/i })).not.toBeInTheDocument();
    expect(screen.getByText('Unsafe Source Title')).toBeInTheDocument();
    expect(screen.getByText('First line second line')).toBeInTheDocument();
    expect(screen.getByText('AI Search')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('builds a safe blog link from normalized citation year and slug', () => {
    render(
      <ConsoleCitations
        citations={[
          {
            id: 'local-post',
            title: 'Local source',
            year: '2026',
            slug: 'console-hardening',
            score: 1.25,
          } as any,
        ]}
      />,
    );

    const link = screen.getByRole('link', { name: /Local source/i });
    expect(link).toHaveAttribute('href', '/blog/2026/console-hardening');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('rejects encoded controls, encoded separators, and credentialed citation links', () => {
    render(
      <ConsoleCitations
        citations={[
          {
            id: 'encoded-url',
            title: 'Encoded URL',
            url: '/blog/2026/post%00x',
            score: 0.5,
          } as any,
          {
            id: 'encoded-slug',
            title: 'Encoded Slug',
            year: '2026',
            slug: 'bad%2Fslug',
            score: 0.5,
          } as any,
          {
            id: 'credentialed-url',
            title: 'Credentialed URL',
            url: 'https://user@example.com/blog/2026/post',
            score: 0.5,
          } as any,
        ]}
      />,
    );

    expect(screen.queryByRole('link', { name: /Encoded URL/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Encoded Slug/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Credentialed URL/i })).not.toBeInTheDocument();
    expect(screen.getByText('Encoded URL')).toBeInTheDocument();
    expect(screen.getByText('Encoded Slug')).toBeInTheDocument();
    expect(screen.getByText('Credentialed URL')).toBeInTheDocument();
  });
});
