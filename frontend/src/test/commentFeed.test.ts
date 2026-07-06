import { describe, expect, it } from 'vitest';
import {
  getCommentKey,
  mergeCommentItems,
  normalizeCommentPostId,
  type CommentItem,
} from '@/components/features/blog/commentFeed';

const baseComment: CommentItem = {
  postId: 'post-1',
  author: 'Ada',
  content: 'First comment',
  createdAt: '2026-07-03T00:00:00.000Z',
};

function makeComment(overrides: Partial<CommentItem> = {}): CommentItem {
  return {
    ...baseComment,
    ...overrides,
  };
}

describe('commentFeed merge boundaries', () => {
  it('keeps distinct id-less comments that share timestamp, author, and content prefix', () => {
    const opening =
      'This comment intentionally starts with the same long prefix ';
    const first = makeComment({ content: `${opening}alpha` });
    const second = makeComment({ content: `${opening}beta` });

    const merged = mergeCommentItems([first], [second]);

    expect(merged.map(comment => comment.content)).toEqual([
      `${opening}alpha`,
      `${opening}beta`,
    ]);
    expect(getCommentKey(first)).not.toBe(getCommentKey(second));
  });

  it('still deduplicates persisted comments by id', () => {
    const current = makeComment({
      id: 'comment-1',
      content: 'Persisted comment',
    });
    const incoming = makeComment({
      id: 'comment-1',
      content: 'Duplicate payload with changed content',
    });

    const merged = mergeCommentItems([current], [incoming]);

    expect(merged).toEqual([current]);
  });
});

describe('normalizeCommentPostId', () => {
  it('allows simple and slash-delimited archive ids', () => {
    expect(normalizeCommentPostId(' post-1 ')).toBe('post-1');
    expect(normalizeCommentPostId('2026/comment-thread')).toBe(
      '2026/comment-thread'
    );
  });

  it('rejects malformed, control, traversal, and encoded separator ids', () => {
    expect(normalizeCommentPostId('')).toBeNull();
    expect(normalizeCommentPostId('post%0a1')).toBeNull();
    expect(normalizeCommentPostId('2026/../secret')).toBeNull();
    expect(normalizeCommentPostId('2026%2fsecret')).toBeNull();
    expect(normalizeCommentPostId('broken%zz')).toBeNull();
  });
});
