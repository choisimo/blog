import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Textarea } from './textarea';

describe('Textarea', () => {
  it('sanitizes placeholder and accessibility labels without changing text value', () => {
    render(
      <Textarea
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31mComment field\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mComment title\u001b[0m\u0007'}
        placeholder={'\u001b]0;Hidden placeholder\u0007\u001b[33mWrite comment\u001b[0m\u0000'}
        defaultValue={'\u001b[31mraw comment\u001b[0m'}
      />
    );

    const textarea = screen.getByRole('textbox', { name: 'Comment field' });
    expect(textarea).toHaveAttribute('title', 'Comment title');
    expect(textarea).toHaveAttribute('placeholder', 'Write comment');
    expect(textarea.getAttribute('aria-label')).not.toContain('Hidden');
    expect(textarea).toHaveValue('\u001b[31mraw comment\u001b[0m');
  });

  it('omits empty sanitized display labels', () => {
    render(
      <Textarea
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
        placeholder={'\u0000'}
      />
    );

    const textarea = screen.getByRole('textbox');
    expect(textarea).not.toHaveAttribute('aria-label');
    expect(textarea).not.toHaveAttribute('title');
    expect(textarea).not.toHaveAttribute('placeholder');
  });
});
