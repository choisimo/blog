import { render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { NavigationItem } from '@/components/molecules/NavigationItem';

function renderNavigationItem(props: {
  name: string;
  href: string;
}) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <NavigationItem name={props.name} href={props.href} icon={Circle} />
    </MemoryRouter>,
  );
}

describe('NavigationItem', () => {
  it('normalizes external http links and labels', () => {
    renderNavigationItem({
      name: ' Docs\r\nLink ',
      href: ' https://example.com/docs ',
    });

    const link = screen.getByRole('link', { name: /Docs Link/ });
    expect(link.getAttribute('href')).toBe('https://example.com/docs');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('falls back to a safe internal route for unsafe hrefs', () => {
    renderNavigationItem({
      name: ' Bad ',
      href: 'javascript:alert(1)',
    });

    const link = screen.getByRole('link', { name: /Bad/ });
    expect(link.getAttribute('href')).toBe('/');
    expect(link.getAttribute('target')).toBeNull();

    renderNavigationItem({
      name: ' Encoded Control ',
      href: '/docs%09tab',
    });
    expect(screen.getByRole('link', { name: /Encoded Control/ }).getAttribute('href')).toBe('/');

    renderNavigationItem({
      name: ' Credentialed ',
      href: 'https://user:pass@example.com/docs',
    });
    expect(screen.getByRole('link', { name: /Credentialed/ }).getAttribute('href')).toBe('/');
  });

  it('rejects protocol-relative hrefs as internal fallback', () => {
    renderNavigationItem({
      name: ' Protocol Relative ',
      href: '//example.com/path',
    });

    expect(
      screen.getByRole('link', { name: /Protocol Relative/ }).getAttribute('href'),
    ).toBe('/');
  });
});
