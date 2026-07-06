import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

const mockApi = vi.hoisted(() => ({
  canScrollNext: vi.fn(() => true),
  canScrollPrev: vi.fn(() => true),
  off: vi.fn(),
  on: vi.fn(),
  scrollNext: vi.fn(),
  scrollPrev: vi.fn(),
}));

vi.mock('embla-carousel-react', () => ({
  default: () => [vi.fn(), mockApi],
}));

vi.mock('@/components/ui/button', async () => {
  const React = await import('react');

  type ButtonProps = ReactTypes.ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
  };

  const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ children, size, variant, ...props }, ref) => (
      <button
        ref={ref}
        data-size={size}
        data-variant={variant}
        type='button'
        {...props}
      >
        {children}
      </button>
    )
  );
  Button.displayName = 'Button';

  return { Button };
});

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './carousel';

describe('Carousel text boundaries', () => {
  it('sanitizes root, content, and item text/accessibility attributes', () => {
    render(
      <Carousel
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31mFeatured\u0000 carousel'}
        title={'\u001b]2;Hidden title\u001b\\\u001b[32mFeatured\u0007'}
      >
        <CarouselContent
          data-testid='carousel-content'
          aria-label={'\u001b]0;Hidden content\u0007\u001b[33mSlides\u0000 list'}
          title={'\u001b]0;Hidden content title\u0007\u001b[34mSlides\u0007'}
        >
          <CarouselItem
            aria-label={'\u001b]0;Hidden item\u0007\u001b[35mSlide\u0000 one'}
            title={'\u001b]0;Hidden item title\u0007\u001b[36mSlide title\u0007'}
          >
            {'\u001b]0;Hidden slide text\u0007\u001b[31mSlide content\u0000'}
          </CarouselItem>
        </CarouselContent>
      </Carousel>
    );

    expect(screen.getByRole('region')).toHaveAttribute(
      'aria-label',
      'Featured carousel'
    );
    expect(screen.getByRole('region')).toHaveAttribute('title', 'Featured');
    expect(screen.getByTestId('carousel-content')).toHaveAttribute(
      'aria-label',
      'Slides list'
    );
    expect(screen.getByTestId('carousel-content')).toHaveAttribute(
      'title',
      'Slides'
    );
    expect(screen.getByText('Slide content').parentElement).toHaveAttribute(
      'aria-label',
      'Slide one'
    );
    expect(screen.getByText('Slide content').parentElement).toHaveAttribute(
      'title',
      'Slide title'
    );
    expect(screen.getByText('Slide content').textContent).not.toContain('\u001b');
    expect(screen.getByText('Slide content').textContent).not.toContain('Hidden');
  });

  it('sanitizes navigation button labels while preserving default sr-only labels and button props', () => {
    render(
      <Carousel>
        <CarouselPrevious
          aria-label={'\u001b]0;Hidden previous label\u0007\u001b[31mGo previous\u0000'}
          title={'\u001b]0;Hidden previous title\u0007\u001b[32mPrevious\u0007'}
        >
          {'\u001b]0;Hidden previous text\u0007\u001b[33mCustom previous\u0000'}
        </CarouselPrevious>
        <CarouselNext
          aria-label={'\u001b]0;Hidden next label\u0007\u001b[34mGo next\u0007'}
          title={'\u001b]0;Hidden next title\u0007\u001b[35mNext\u0000'}
        >
          {'\u001b]0;Hidden next text\u0007\u001b[36mCustom next\u0007'}
        </CarouselNext>
      </Carousel>
    );

    const previous = screen.getByRole('button', { name: /Go previous/ });
    const next = screen.getByRole('button', { name: /Go next/ });

    expect(previous).toHaveAttribute('title', 'Previous');
    expect(previous).toHaveAttribute('data-variant', 'outline');
    expect(previous).toHaveAttribute('data-size', 'icon');
    expect(previous).toHaveTextContent('Custom previous');
    expect(previous).toHaveTextContent('Previous slide');
    expect(previous.textContent).not.toContain('Hidden');
    expect(next).toHaveAttribute('title', 'Next');
    expect(next).toHaveTextContent('Custom next');
    expect(next).toHaveTextContent('Next slide');
    expect(next.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized accessibility text and preserves rich child nodes', () => {
    render(
      <Carousel aria-label={'\u001b]0;Hidden empty\u0007\u001b[31m\u0000'} title={'\u001b]0;Hidden title\u0007\u0007'}>
        <CarouselContent>
          <CarouselItem>
            <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
          </CarouselItem>
        </CarouselContent>
      </Carousel>
    );

    expect(screen.getByRole('region')).not.toHaveAttribute('aria-label');
    expect(screen.getByRole('region')).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-child').textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
