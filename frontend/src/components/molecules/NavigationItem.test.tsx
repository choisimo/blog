import { forwardRef, type SVGProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NavigationItem } from './NavigationItem';

const { locationMock } = vi.hoisted(() => ({
  locationMock: {
    pathname: '/posts',
  },
}));

vi.mock('react-router-dom', () => ({
  Link: ({
    children,
    to,
    ...props
  }: {
    children: React.ReactNode;
    to: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useLocation: () => locationMock,
}));

const TestIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>((props, ref) => (
  <svg ref={ref} data-testid='navigation-icon' {...props} />
));

describe('NavigationItem', () => {
  it('sanitizes internal link labels, accessibility text, and preserves active styling', () => {
    render(
      <NavigationItem
        name={'\u001b]0;Hidden name\u0007\u001b[31mPosts\u001b[0m\u0000'}
        href='/posts'
        icon={TestIcon}
        ariaLabel={'\u001b]0;Hidden aria\u0007\u001b[32mOpen posts\u0007'}
        title={'\u001b]0;Hidden title\u0007Posts\u0008 title'}
        className='custom-nav'
      />
    );

    const link = screen.getByRole('link', { name: 'Open posts' });

    expect(link).toHaveAttribute('href', '/posts');
    expect(link).toHaveAttribute('title', 'Posts title');
    expect(link).toHaveClass('text-primary');
    expect(link).toHaveClass('custom-nav');
    expect(link).toHaveTextContent('Posts');
    expect(screen.getByTestId('navigation-icon')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(link.textContent).not.toContain('Hidden');
    expect(link.textContent).not.toContain('\u001b');
  });

  it('renders safe external links with noopener behavior and sanitized title', () => {
    render(
      <NavigationItem
        name='Docs'
        href='https://example.com/docs'
        icon={TestIcon}
        title={'\u001b]0;Hidden title\u0007External\u0007 docs'}
      />
    );

    const link = screen.getByRole('link', { name: 'Docs' });

    expect(link).toHaveAttribute('href', 'https://example.com/docs');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('title', 'External docs');
    expect(link).toHaveClass('text-muted-foreground');
  });

  it('falls back to safe defaults for unsafe labels and hrefs', () => {
    render(
      <NavigationItem
        name={'\u001b]0;Hidden name\u0007\u001b[31m\u0000'}
        href='javascript:alert(1)'
        icon={TestIcon}
        ariaLabel={'\u001b]0;Hidden aria\u0007\u001b[32m\u0007'}
        title={'\u0008'}
      />
    );

    const link = screen.getByRole('link', { name: 'Navigation' });

    expect(link).toHaveAttribute('href', '/');
    expect(link).not.toHaveAttribute('aria-label');
    expect(link).not.toHaveAttribute('title');
  });

  it('preserves mobile sizing and click handling', () => {
    const handleClick = vi.fn();

    render(
      <NavigationItem
        name='Mobile'
        href='/mobile'
        icon={TestIcon}
        isMobile
        onClick={handleClick}
      />
    );

    const link = screen.getByRole('link', { name: 'Mobile' });

    fireEvent.click(link);

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(link).toHaveClass('min-h-[44px]');
    expect(screen.getByTestId('navigation-icon')).toHaveClass('h-5');
  });
});
