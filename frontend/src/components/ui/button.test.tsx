import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('sanitizes aria-label and title before rendering', () => {
    render(
      <Button
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31mOpen settings\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mSettings title\u001b[0m\u0007'}
      />
    );

    const button = screen.getByRole('button', { name: 'Open settings' });
    expect(button).toHaveAttribute('title', 'Settings title');
    expect(button.getAttribute('aria-label')).not.toContain('Hidden');
    expect(button).not.toHaveAttribute(
      'aria-label',
      expect.stringContaining('\u001b')
    );
  });

  it('omits empty sanitized accessibility strings', () => {
    render(
      <Button
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      />
    );

    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('aria-label');
    expect(button).not.toHaveAttribute('title');
  });
});
