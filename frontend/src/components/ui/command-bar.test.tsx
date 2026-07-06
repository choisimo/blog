import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CommandBar, CommandButton, CommandGroup } from './command-bar';

describe('CommandBar', () => {
  it('sanitizes bar, group, and button text/accessibility boundaries', () => {
    const { container } = render(
      <CommandBar
        aria-label={'\u001b]0;Hidden bar\u0007\u001b[31mCommands\u0000'}
        title={'\u001b]0;Hidden toolbar\u0007Toolbar\u0007'}
      >
        <CommandGroup
          aria-label={'\u001b]0;Hidden group\u0007\u001b[32mPrimary actions\u0008'}
          title={'\u001b]0;Hidden primary\u0007Primary\u0001'}
          data-testid='command-group'
        >
          <CommandButton
            type='button'
            aria-label={'\u001b]0;Hidden button\u0007\u001b[33mRun deploy\u0002'}
            title={'\u001b]0;Hidden deploy\u0007Deploy\u0003'}
          >
            {'\u001b]0;Hidden child\u0007Run\u0004 deploy'}
          </CommandButton>
        </CommandGroup>
      </CommandBar>
    );

    const bar = screen.getByRole('navigation', { name: 'Commands' });
    const group = screen.getByTestId('command-group');
    const button = screen.getByRole('button', { name: 'Run deploy' });

    expect(bar).toHaveAttribute('title', 'Toolbar');
    expect(group).toHaveAttribute('aria-label', 'Primary actions');
    expect(group).toHaveAttribute('title', 'Primary');
    expect(button).toHaveAttribute('title', 'Deploy');
    expect(button).toHaveTextContent('Run deploy');
    expect(container.textContent).not.toContain('Hidden');
  });

  it('preserves button variants, state props, rich nodes, and empty sanitized attributes', () => {
    const { container } = render(
      <CommandBar
        aria-label={'\u001b]0;Hidden bar\u0007\u001b[31m\u0000'}
        title={'\u0007'}
      >
        <CommandGroup
          aria-label={'\u0008'}
          title={'\u001b]0;Hidden group\u0007\u001b[32m\u0000'}
        >
          <CommandButton
            type='submit'
            active
            disabled
            variant='danger'
            className='custom-command'
            aria-label={'\u001b]0;Hidden button\u0007\u001b[34mDestroy\u0009'}
          >
            <span data-testid='rich-command'>Destroy rich node</span>
          </CommandButton>
        </CommandGroup>
      </CommandBar>
    );

    const bar = screen.getByRole('navigation');
    const button = screen.getByRole('button', { name: 'Destroy' });

    expect(bar).not.toHaveAttribute('aria-label');
    expect(bar).not.toHaveAttribute('title');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toBeDisabled();
    expect(button).toHaveClass('custom-command');
    expect(button).toHaveClass('border-destructive/50');
    expect(screen.getByTestId('rich-command')).toHaveTextContent('Destroy rich node');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0007');
    expect(container.textContent).not.toContain('Hidden');
  });
});
