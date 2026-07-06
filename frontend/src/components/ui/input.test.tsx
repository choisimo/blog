import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';

describe('Input', () => {
  it('sanitizes placeholder and accessibility labels without changing input value', () => {
    render(
      <Input
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31mSearch field\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mSearch title\u001b[0m\u0007'}
        placeholder={'\u001b]0;Hidden placeholder\u0007\u001b[33mSearch posts\u001b[0m\u0000'}
        defaultValue={'\u001b[31mraw value\u001b[0m'}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Search field' });
    expect(input).toHaveAttribute('title', 'Search title');
    expect(input).toHaveAttribute('placeholder', 'Search posts');
    expect(input.getAttribute('aria-label')).not.toContain('Hidden');
    expect(input).toHaveValue('\u001b[31mraw value\u001b[0m');
  });

  it('omits empty sanitized display labels', () => {
    render(
      <Input
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
        placeholder={'\u0000'}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).not.toHaveAttribute('aria-label');
    expect(input).not.toHaveAttribute('title');
    expect(input).not.toHaveAttribute('placeholder');
  });
});
