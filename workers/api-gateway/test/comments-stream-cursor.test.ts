import { describe, expect, it } from 'vitest';

import {
  buildVisibleCommentsAfterCursorQuery,
  createCommentStreamCursor,
  getNextCommentStreamCursor,
} from '../src/routes/comments';

describe('comment stream cursor helpers', () => {
  it('normalizes invalid cursor input to the fallback timestamp', () => {
    const cursor = createCommentStreamCursor(
      'not-a-date',
      ' comment-2 ',
      '2026-04-11T00:00:00.000Z'
    );

    expect(cursor).toEqual({
      createdAt: '2026-04-11T00:00:00.000Z',
      id: 'comment-2',
    });
  });

  it('builds a cursor-aware query that only scans newer comments', () => {
    const query = buildVisibleCommentsAfterCursorQuery('2026/test-post', {
      createdAt: '2026-04-11T12:00:00.000Z',
      id: 'comment-123',
    });

    expect(query.sql).toContain('created_at > ?');
    expect(query.sql).toContain('(created_at = ? AND id > ?)');
    expect(query.params).toEqual([
      '2026/test-post',
      '2026-04-11T12:00:00.000Z',
      '2026-04-11T12:00:00.000Z',
      'comment-123',
    ]);
  });

  it('advances the stream cursor to the newest appended item', () => {
    const next = getNextCommentStreamCursor(
      [
        {
          id: 'comment-1',
          created_at: '2026-04-11T12:00:00.000Z',
        },
        {
          id: 'comment-2',
          created_at: '2026-04-11T12:00:01.000Z',
        },
      ],
      {
        createdAt: '2026-04-11T11:59:59.000Z',
        id: '',
      }
    );

    expect(next).toEqual({
      createdAt: '2026-04-11T12:00:01.000Z',
      id: 'comment-2',
    });
  });
});
