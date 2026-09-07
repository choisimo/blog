import { describe, expect, it } from 'vitest';

import {
  serializeMarkdownTableRows,
  serializeRenderedMarkdownTable,
} from './tableText';

describe('tableText', () => {
  it('serializes visible cells as tab-separated rows', () => {
    expect(
      serializeMarkdownTableRows([
        ['Name', 'Value'],
        ['  alpha\n beta ', 2],
      ]),
    ).toBe('Name\tValue\nalpha beta\t2');
  });

  it('reads the currently rendered table instead of reconstructing Markdown', () => {
    expect(
      serializeRenderedMarkdownTable({
        rows: [
          { cells: [{ textContent: 'A' }, { textContent: 'B' }] },
          { cells: [{ textContent: '1' }, { textContent: '2' }] },
        ],
      }),
    ).toBe('A\tB\n1\t2');
  });
});
