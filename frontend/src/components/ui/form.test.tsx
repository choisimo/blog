import { render, screen } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseFormContext = vi.hoisted(() => vi.fn());

vi.mock('react-hook-form', async () => {

  return {
    Controller: ({
      render: renderField,
    }: {
      render?: (props: {
        field: Record<string, never>;
        fieldState: Record<string, never>;
        formState: Record<string, never>;
      }) => ReactTypes.ReactNode;
    }) =>
      renderField
        ? renderField({ field: {}, fieldState: {}, formState: {} })
        : null,
    FormProvider: ({ children }: { children?: ReactTypes.ReactNode }) => (
      <form>{children}</form>
    ),
    useFormContext: mockUseFormContext,
  };
});

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './form';

describe('Form text boundaries', () => {
  beforeEach(() => {
    mockUseFormContext.mockReturnValue({
      formState: {},
      getFieldState: () => ({}),
    });
  });

  it('sanitizes item, label, control, and description accessibility text while preserving field ids', () => {
    render(
      <FormField
        name='email'
        render={() => (
          <FormItem
            aria-label={'\u001b]0;Hidden item\u0007\u001b[31mEmail\u0000 field'}
            title={'\u001b]2;Hidden item title\u001b\\\u001b[32mEmail\u0007'}
          >
            <FormLabel
              aria-label={'\u001b]0;Hidden label\u0007\u001b[33mEmail\u0000 label'}
              title={'\u001b]0;Hidden label title\u0007\u001b[34mLabel\u0007'}
            >
              {'\u001b]0;Hidden label text\u0007\u001b[35mEmail\u0000'}
            </FormLabel>
            <FormControl
              aria-label={'\u001b]0;Hidden control\u0007\u001b[36mEmail\u0007 input'}
              title={'\u001b]0;Hidden control title\u0007\u001b[31mInput\u0000'}
            >
              <input />
            </FormControl>
            <FormDescription
              aria-label={'\u001b]0;Hidden description\u0007\u001b[32mEmail\u0007 help'}
              title={'\u001b]0;Hidden description title\u0007\u001b[33mHelp\u0000'}
            >
              {'\u001b]0;Hidden description text\u0007\u001b[34mUse a work email\u0007'}
            </FormDescription>
          </FormItem>
        )}
      />
    );

    const label = screen.getByText('Email');
    const item = label.closest('[aria-label="Email field"]');
    const input = screen.getByRole('textbox', { name: 'Email input' });
    const description = screen.getByText('Use a work email');

    if (!item) {
      throw new Error('Expected sanitized form item wrapper');
    }

    expect(item).toHaveAttribute('title', 'Email');
    expect(label).toHaveAttribute('aria-label', 'Email label');
    expect(label).toHaveAttribute('title', 'Label');
    expect(input).toHaveAttribute('title', 'Input');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input.getAttribute('aria-describedby') ?? '').toMatch(
      /-form-item-description$/
    );
    expect(description).toHaveAttribute('aria-label', 'Email help');
    expect(description).toHaveAttribute('title', 'Help');
    expect(description.textContent).not.toContain('\u001b');
    expect(description.textContent).not.toContain('Hidden');
  });

  it('sanitizes error messages and preserves invalid describedby linkage', () => {
    mockUseFormContext.mockReturnValue({
      formState: {},
      getFieldState: () => ({
        error: {
          message: '\u001b]0;Hidden error body\u0007\u001b[31mRequired\u0000',
        },
      }),
    });

    render(
      <FormField
        name='email'
        render={() => (
          <FormItem>
            <FormControl>
              <input aria-label='Email input' />
            </FormControl>
            <FormDescription>{'Email help'}</FormDescription>
            <FormMessage
              aria-label={'\u001b]0;Hidden error label\u0007\u001b[32mError\u0007 message'}
              title={'\u001b]2;Hidden error title\u001b\\\u001b[33mError\u0000'}
            />
          </FormItem>
        )}
      />
    );

    const input = screen.getByRole('textbox', { name: 'Email input' });
    const message = screen.getByText('Required');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby') ?? '').toContain(
      '-form-item-message'
    );
    expect(message).toHaveAttribute('aria-label', 'Error message');
    expect(message).toHaveAttribute('title', 'Error');
    expect(message.textContent).not.toContain('\u001b');
    expect(message.textContent).not.toContain('Hidden');
  });

  it('omits empty sanitized accessibility text and preserves rich message nodes', () => {
    render(
      <FormField
        name='email'
        render={() => (
          <FormItem
            aria-label={'\u001b]0;Hidden empty label\u0007\u001b[31m\u0000'}
            title={'\u001b]0;Hidden empty title\u0007\u0007'}
          >
            <FormMessage>
              <span data-testid='rich-child'>{'\u001b[33mKeep\u0000 raw'}</span>
            </FormMessage>
          </FormItem>
        )}
      />
    );

    const richChild = screen.getByTestId('rich-child');
    const item = richChild.closest('.space-y-2');

    if (!item) {
      throw new Error('Expected form item wrapper for rich child');
    }

    expect(item).not.toHaveAttribute('aria-label');
    expect(item).not.toHaveAttribute('title');
    expect(richChild.textContent).toBe(
      '\u001b[33mKeep\u0000 raw'
    );
  });
});
