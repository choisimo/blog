import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Label } from './label';

describe('Label', () => {
  it('sanitizes label text and accessibility attributes', () => {
    render(
      <Label
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31mName label\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mLabel title\u001b[0m\u0007'}
      >
        {'\u001b]0;Hidden child\u0007\u001b[33mDisplay name\u001b[0m\u0000'}
      </Label>
    );

    const label = screen.getByText('Display name');
    expect(label).toHaveAttribute('aria-label', 'Name label');
    expect(label).toHaveAttribute('title', 'Label title');
    expect(label.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized label attributes and preserves element children', () => {
    render(
      <Label
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      >
        {'\u001b]0;Hidden prefix\u0007\u001b[33mPrefix\u001b[0m\u0000'}
        <span>Trusted child</span>
      </Label>
    );

    const child = screen.getByText('Trusted child');
    const label = child.closest('label');
    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(label).not.toHaveAttribute('aria-label');
    expect(label).not.toHaveAttribute('title');
  });
});
