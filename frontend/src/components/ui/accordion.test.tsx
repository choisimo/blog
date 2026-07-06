import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@radix-ui/react-accordion', async () => {
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

  const Item = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='item' {...props}>
      {children}
    </div>
  ));
  Item.displayName = 'Item';

  const Header = ({
    children,
    ...props
  }: ReactTypes.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 data-testid='header' {...props}>
      {children}
    </h3>
  );
  Header.displayName = 'Header';

  const Trigger = React.forwardRef<
    HTMLButtonElement,
    ReactTypes.ButtonHTMLAttributes<HTMLButtonElement>
  >(({ children, ...props }, ref) => (
    <button ref={ref} data-testid='trigger' {...props}>
      {children}
    </button>
  ));
  Trigger.displayName = 'Trigger';

  const Content = React.forwardRef<
    HTMLDivElement,
    ReactTypes.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} data-testid='content' {...props}>
      {children}
    </div>
  ));
  Content.displayName = 'Content';

  return {
    Root,
    Item,
    Header,
    Trigger,
    Content,
  };
});

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './accordion';

describe('Accordion text boundaries', () => {
  it('sanitizes root, item, and trigger text/accessibility attributes', () => {
    render(
      <Accordion
        aria-label={'\u001b]0;Hidden root\u0007\u001b[31mFAQ\u0000 list'}
        title={'\u001b]0;Hidden faq\u0007\u001b[32mFAQ\u0007'}
        type='single'
      >
        <AccordionItem
          aria-label={'\u001b]0;Hidden item\u0007\u001b[33mQuestion\u0000 item'}
          title={'\u001b]0;Hidden question\u0007\u001b[34mQuestion\u0007'}
          value='q1'
        >
          <AccordionTrigger
            aria-label={'\u001b]0;Hidden trigger\u0007\u001b[35mOpen question\u0000'}
            title={'\u001b]0;Hidden trigger title\u0007\u001b[36mQuestion title\u0007'}
          >
            {'\u001b]0;Hidden trigger text\u0007\u001b[31mQuestion\u0000'}
          </AccordionTrigger>
        </AccordionItem>
      </Accordion>
    );

    expect(screen.getByTestId('root')).toHaveAttribute(
      'aria-label',
      'FAQ list'
    );
    expect(screen.getByTestId('root')).toHaveAttribute('title', 'FAQ');
    expect(screen.getByTestId('item')).toHaveAttribute(
      'aria-label',
      'Question item'
    );
    expect(screen.getByTestId('item')).toHaveAttribute('title', 'Question');

    const trigger = screen.getByRole('button', { name: 'Open question' });
    expect(trigger).toHaveAttribute('title', 'Question title');
    expect(trigger).toHaveTextContent('Question');
    expect(trigger.textContent).not.toContain('\u001b');
    expect(trigger.textContent).not.toContain('Hidden');
  });

  it('sanitizes content text/accessibility attributes', () => {
    render(
      <AccordionContent
        aria-label={'\u001b]0;Hidden content\u0007\u001b[31mAnswer\u0000 panel'}
        title={'\u001b]0;Hidden answer\u0007\u001b[32mAnswer\u0007'}
      >
        {'\u001b]0;Hidden content text\u0007\u001b[33mAnswer text\u0000'}
      </AccordionContent>
    );

    expect(screen.getByTestId('content')).toHaveAttribute(
      'aria-label',
      'Answer panel'
    );
    expect(screen.getByTestId('content')).toHaveAttribute('title', 'Answer');
    expect(screen.getByTestId('content')).toHaveTextContent('Answer text');
    expect(screen.getByTestId('content').textContent).not.toContain('\u001b');
    expect(screen.getByTestId('content').textContent).not.toContain('Hidden');
  });

  it('preserves rich child nodes inside item and content boundaries', () => {
    render(
      <AccordionItem value='q1'>
        <span data-testid='rich-item'>{'\u001b[31mKeep\u0000 raw'}</span>
        <AccordionContent>
          <span data-testid='rich-content'>{'\u001b[32mKeep\u0007 raw'}</span>
        </AccordionContent>
      </AccordionItem>
    );

    expect(screen.getByTestId('rich-item').textContent).toBe(
      '\u001b[31mKeep\u0000 raw'
    );
    expect(screen.getByTestId('rich-content').textContent).toBe(
      '\u001b[32mKeep\u0007 raw'
    );
  });
});
