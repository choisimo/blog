import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert, AlertDescription, AlertTitle } from './alert';

describe('Alert primitives', () => {
  it('sanitizes string title and description children', () => {
    const { container } = render(
      <Alert>
        <AlertTitle>
          {'\u001b]0;Hidden title\u0007\u001b[31mHeads up\u001b[0m\u0000'}
        </AlertTitle>
        <AlertDescription>
          {'\u001b]0;Hidden description\u0007\u001b[32mSomething changed\u001b[0m\u0007'}
        </AlertDescription>
      </Alert>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Something changed')).toBeInTheDocument();
    expect(screen.queryByText(/\u001b/)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });

  it('preserves element children while sanitizing adjacent string nodes', () => {
    const { container } = render(
      <AlertDescription>
        {'\u001b]0;Hidden prefix\u0007\u001b[31mPrefix\u001b[0m\u0000'}
        <span>Trusted child</span>
      </AlertDescription>
    );

    expect(screen.getByText('Prefix')).toBeInTheDocument();
    expect(screen.getByText('Trusted child')).toBeInTheDocument();
    expect(container.textContent).not.toContain('Hidden');
  });
});
