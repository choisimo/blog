import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-avatar', async () => {
  const React = await import('react');

  const Root = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='root' {...props}>
      {children}
    </div>
  ));
  Root.displayName = 'Root';

  const Image = React.forwardRef<
    HTMLImageElement,
    ReactTypes.ImgHTMLAttributes<HTMLImageElement>
  >((props, ref) => <img ref={ref} data-testid='image' {...props} />);
  Image.displayName = 'Image';

  const Fallback = React.forwardRef<
    HTMLSpanElement,
    ReactTypes.HTMLAttributes<HTMLSpanElement>
  >(({ children, ...props }, ref) => (
    <span ref={ref} data-testid='fallback' {...props}>
      {children}
    </span>
  ));
  Fallback.displayName = 'Fallback';

  return {
    Root,
    Image,
    Fallback,
  };
});

import { Avatar, AvatarFallback, AvatarImage } from './avatar';

describe('Avatar text boundaries', () => {
  it('sanitizes root accessibility attributes and direct text children', () => {
    render(
      <Avatar
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31mProfile\u0000 avatar'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mProfile\u0007'}
      >
        {'\u001b]0;Hidden child\u0007\u001b[33mAvatar\u0000'}
      </Avatar>
    );

    expect(screen.getByTestId('root')).toHaveAttribute(
      'aria-label',
      'Profile avatar'
    );
    expect(screen.getByTestId('root')).toHaveAttribute('title', 'Profile');
    expect(screen.getByTestId('root')).toHaveTextContent('Avatar');
    expect(screen.getByTestId('root').textContent).not.toContain('\u001b');
    expect(screen.getByTestId('root').textContent).not.toContain('Hidden');
  });

  it('sanitizes image alt and accessibility attributes without changing src', () => {
    render(
      <AvatarImage
        src='/avatars/user.png'
        alt={'\u001b]0;Hidden alt\u0007\u001b[31mProfile\u0000 photo'}
        aria-label={'\u001b]0;Hidden label\u0007\u001b[32mAvatar\u0007 image'}
        title={'\u001b]0;Hidden title\u0007\u001b[33mUser\u0000 avatar'}
      />
    );

    const image = screen.getByRole('img', { name: 'Avatar image' });

    expect(image).toHaveAttribute('src', '/avatars/user.png');
    expect(image).toHaveAttribute('alt', 'Profile photo');
    expect(image).toHaveAttribute('title', 'User avatar');
    expect(image.getAttribute('alt')).not.toContain('Hidden');
    expect(image.getAttribute('aria-label')).not.toContain('Hidden');
    expect(image.getAttribute('title')).not.toContain('Hidden');
  });

  it('sanitizes fallback text while preserving rich child nodes', () => {
    render(
      <>
        <AvatarFallback
          aria-label={'\u001b]0;Hidden fallback\u0007\u001b[31mFallback\u0000 initials'}
          title={'\u001b]0;Hidden initials\u0007\u001b[32mInitials\u0007'}
        >
          {'\u001b]0;Hidden text\u0007\u001b[33mND\u0000'}
        </AvatarFallback>
        <AvatarFallback>
          <span data-testid='rich-child'>{'\u001b[34mKeep\u0007 raw'}</span>
        </AvatarFallback>
      </>
    );

    expect(screen.getAllByTestId('fallback')[0]).toHaveAttribute(
      'aria-label',
      'Fallback initials'
    );
    expect(screen.getAllByTestId('fallback')[0]).toHaveAttribute(
      'title',
      'Initials'
    );
    expect(screen.getAllByTestId('fallback')[0]).toHaveTextContent('ND');
    expect(screen.getAllByTestId('fallback')[0].textContent).not.toContain(
      'Hidden'
    );
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[34mKeep\u0007 raw'
    );
  });
});
