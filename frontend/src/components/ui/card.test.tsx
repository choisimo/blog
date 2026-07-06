import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardTitle,
} from './card';

describe('Card primitives', () => {
  it('sanitizes card accessibility labels and string children', () => {
    const { container } = render(
      <Card
        aria-label={'\u001b]0;Hidden card\u0007\u001b[31mProject card\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mCard title\u001b[0m\u0007'}
      >
        <CardTitle>
          {'\u001b]0;Hidden heading\u0007\u001b[33mProject\u001b[0m\u0000'}
        </CardTitle>
        <CardDescription>
          {'\u001b]0;Hidden description\u0007\u001b[34mProject details\u001b[0m\u0007'}
        </CardDescription>
        <CardContent>
          {'\u001b]0;Hidden content\u0007\u001b[35mContent text\u001b[0m\u0000'}
        </CardContent>
        <CardFooter>
          {'\u001b]0;Hidden footer\u0007\u001b[36mFooter text\u001b[0m\u0007'}
        </CardFooter>
      </Card>
    );

    const card = screen.getByLabelText('Project card');
    expect(card).toHaveAttribute('title', 'Card title');
    expect(screen.getByText('Project')).toBeInTheDocument();
    expect(screen.getByText('Project details')).toBeInTheDocument();
    expect(screen.getByText('Content text')).toBeInTheDocument();
    expect(screen.getByText('Footer text')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized card labels and preserves element children', () => {
    const { container } = render(
      <Card
        aria-label={'\u001b]0;Hidden card\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      >
        <CardContent>
          {'\u001b]0;Hidden prefix\u0007\u001b[33mPrefix\u001b[0m\u0000'}
          <span>Trusted child</span>
        </CardContent>
      </Card>
    );

    const child = screen.getByText('Trusted child');
    const card = child.closest('[class*="rounded-lg"]');
    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(card).not.toHaveAttribute('aria-label');
    expect(card).not.toHaveAttribute('title');
    expect(container.textContent).not.toContain('Hidden');
  });
});
