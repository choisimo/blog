import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingButton } from './LoadingButton';

describe('LoadingButton', () => {
  it('sanitizes loading text before rendering it', () => {
    render(
      <LoadingButton
        isLoading
        loadingText={'\u001b]0;Hidden loading\u0007\u001b[31mSaving\u001b[0m\u0000'}
      >
        Save
      </LoadingButton>
    );

    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
    expect(screen.queryByText(/Hidden loading/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\u001b/)).not.toBeInTheDocument();
  });

  it('falls back to children when loading text is empty after sanitization', () => {
    render(
      <LoadingButton isLoading loadingText={'\u001b[31m\u001b[0m\u0000'}>
        Save
      </LoadingButton>
    );

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('sanitizes direct children and accessibility attributes while preserving button props', () => {
    render(
      <LoadingButton
        type='button'
        className='custom-loading'
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[32mSubmit form\u0007'}
        title={'\u001b]0;Hidden title\u0007Submit\u0008 title'}
      >
        Submit{'\u001b]0;Hidden child\u0007\u001b[31m'} form{'\u0000'}
      </LoadingButton>
    );

    const button = screen.getByRole('button', { name: 'Submit form' });

    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('title', 'Submit title');
    expect(button).toHaveClass('relative');
    expect(button).toHaveClass('custom-loading');
    expect(button).toHaveTextContent('Submit form');
    expect(button.textContent).not.toContain('Hidden child');
    expect(button.textContent).not.toContain('\u001b');
    expect(button.getAttribute('aria-label')).not.toContain('Hidden aria');
    expect(button.getAttribute('aria-label')).not.toContain('\u001b');
  });

  it('preserves disabled state and rich children', () => {
    render(
      <LoadingButton disabled>
        <span data-testid='rich-child'>Rich child</span>
      </LoadingButton>
    );

    expect(screen.getByRole('button', { name: 'Rich child' })).toBeDisabled();
    expect(screen.getByTestId('rich-child')).toHaveTextContent('Rich child');
  });

  it('omits empty sanitized accessibility attributes', () => {
    render(
      <LoadingButton
        aria-label={'\u001b]0;Hidden aria\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        Save
      </LoadingButton>
    );

    const button = screen.getByRole('button', { name: 'Save' });

    expect(button).not.toHaveAttribute('aria-label');
    expect(button).not.toHaveAttribute('title');
  });
});
