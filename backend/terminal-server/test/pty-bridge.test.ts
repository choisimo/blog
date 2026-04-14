import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTerminalSize } from '../src/pty-bridge.js';

test('parseTerminalSize clamps rows and columns into the supported range', () => {
  const url = new URL('https://terminal.example.com/terminal?cols=999&rows=1');
  assert.deepEqual(parseTerminalSize(url), { cols: 500, rows: 5 });
});

test('parseTerminalSize keeps sane defaults when params are absent', () => {
  const url = new URL('https://terminal.example.com/terminal');
  assert.deepEqual(parseTerminalSize(url), { cols: 80, rows: 24 });
});
