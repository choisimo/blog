import { describe, expect, it } from 'vitest';

import {
  getAdminErrorMessage,
  normalizeConfigCategories,
  normalizeSafeConfigText,
} from './ConfigManager';

describe('ConfigManager sanitizers', () => {
  it('strips ANSI and control characters from display text', () => {
    expect(normalizeSafeConfigText('\u001b[31mRuntime\nconfig\u001b[0m\u0000')).toBe(
      'Runtime config',
    );
  });

  it('normalizes categories and drops invalid ids or variable keys', () => {
    expect(
      normalizeConfigCategories([
        {
          id: ' APP ',
          name: '\u001b[32mApplication\u001b[0m',
          description: 'Main\u0000 settings',
          variables: [
            {
              key: 'VALID_KEY',
              type: 'select',
              options: ['\u001b[33mone\u001b[0m', '', 'two\nvalue'],
              description: 'Safe\u0000 value',
            },
            {
              key: 'BAD-KEY',
              type: 'text',
            },
          ],
        },
        {
          id: '../bad',
          name: 'Bad',
          variables: [],
        },
      ]),
    ).toEqual([
      {
        id: 'app',
        name: 'Application',
        description: 'Main settings',
        variables: [
          {
            key: 'VALID_KEY',
            type: 'select',
            options: ['one', 'two value'],
            default: undefined,
            isSecret: false,
            description: 'Safe value',
            delimiter: undefined,
          },
        ],
      },
    ]);
  });

  it('extracts sanitized admin error messages from nested payloads', () => {
    expect(
      getAdminErrorMessage(
        {
          error: {
            message: '\u001b[31mSave\nfailed\u001b[0m\u0000',
          },
        },
        'Fallback',
      ),
    ).toBe('Save failed');
  });
});
