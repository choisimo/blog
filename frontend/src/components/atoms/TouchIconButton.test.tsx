import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TouchIconButton } from './TouchIconButton';

describe('TouchIconButton', () => {
  it('sanitizes accessible aria and title labels before rendering', () => {
    render(
      <TouchIconButton
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31mOpen menu\u001b[0m\u0000'}
        title={'\u001b]0;Hidden title\u0007\u001b[32mMenu title\u001b[0m\u0007'}
      />
    );

    const button = screen.getByRole('button', { name: 'Open menu' });
    expect(button).toHaveAttribute('title', 'Menu title');
    expect(button.getAttribute('aria-label')).not.toContain('Hidden');
    expect(button.getAttribute('aria-label')).not.toContain('\u001b');
  });

  it('omits empty accessible labels after sanitization', () => {
    render(
      <TouchIconButton
        aria-label={'\u001b]0;Hidden label\u0007\u001b[31m\u001b[0m\u0000'}
        title={'\u0007'}
      />
    );

    const button = screen.getByRole('button');
    expect(button).not.toHaveAttribute('aria-label');
    expect(button).not.toHaveAttribute('title');
  });

  it('sanitizes direct text children while preserving button props', () => {
    render(
      <TouchIconButton type='button' className='custom-touch'>
        Save{'\u001b]0;Hidden child\u0007\u001b[31m'} now{'\u0000'}
      </TouchIconButton>
    );

    const button = screen.getByRole('button', { name: 'Save now' });

    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveClass('custom-touch');
    expect(button).toHaveClass('min-h-[44px]');
    expect(button.textContent).not.toContain('Hidden');
    expect(button.textContent).not.toContain('\u001b');
    expect(button.textContent).not.toContain('\u0000');
  });

  it('preserves rich children', () => {
    render(
      <TouchIconButton>
        <span data-testid='rich-child'>Rich child</span>
      </TouchIconButton>
    );

    expect(screen.getByTestId('rich-child')).toHaveTextContent('Rich child');
  });
});
