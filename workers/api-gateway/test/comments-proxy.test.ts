import { env, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { execute, queryOne } from '../src/lib/d1';
import { signJwt } from '../src/lib/jwt';
import type { Env } from '../src/types';

declare module 'cloudflare:test' {
  interface ProvidedEnv extends Pick<Env, 'DB' | 'JWT_SECRET'> {}
}

beforeEach(async () => {
  await execute(env.DB, 'DELETE FROM comment_reactions');
  await execute(env.DB, 'DELETE FROM comments');
});

describe('comments route ownership on worker D1', () => {
  it('creates and lists comments from D1', async () => {
    const createResponse = await SELF.fetch('https://example.com/api/v1/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': 'fp-comment-1',
      },
      body: JSON.stringify({
        postId: '2026/test-post',
        author: 'Alice',
        content: 'Hello <b>world</b>',
      }),
    });

    expect(createResponse.status).toBe(201);
    const created = (await createResponse.json()) as {
      ok: boolean;
      data: { id: string };
    };
    expect(created.ok).toBe(true);
    expect(created.data.id).toMatch(/^comment-/);

    const stored = await queryOne<{
      id: string;
      post_id: string;
      author: string;
      content: string;
      device_fingerprint: string | null;
      status: string;
    }>(
      env.DB,
      `SELECT id, post_id, author, content, device_fingerprint, status
         FROM comments
        WHERE id = ?`,
      created.data.id
    );

    expect(stored).toEqual({
      id: created.data.id,
      post_id: '2026/test-post',
      author: 'Alice',
      content: 'Hello world',
      device_fingerprint: 'fp-comment-1',
      status: 'visible',
    });

    const listResponse = await SELF.fetch(
      'https://example.com/api/v1/comments?postId=2026%2Ftest-post'
    );
    expect(listResponse.status).toBe(200);

    const listed = (await listResponse.json()) as {
      ok: boolean;
      data: {
        comments: Array<{
          id: string;
          postId: string;
          author: string;
          content: string;
        }>;
        total: number;
      };
    };

    expect(listed.ok).toBe(true);
    expect(listed.data.total).toBe(1);
    expect(listed.data.comments).toHaveLength(1);
    expect(listed.data.comments[0]).toMatchObject({
      id: created.data.id,
      postId: '2026/test-post',
      author: 'Alice',
      content: 'Hello world',
    });
  });

  it('supports slug aliases and enforces fingerprint rate limiting in D1', async () => {
    const firstResponse = await SELF.fetch('https://example.com/api/v1/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': 'fp-rate-limit',
      },
      body: JSON.stringify({
        slug: '2026/alias-post',
        author: 'Bob',
        content: 'First comment',
      }),
    });

    expect(firstResponse.status).toBe(201);

    const secondResponse = await SELF.fetch('https://example.com/api/v1/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': 'fp-rate-limit',
      },
      body: JSON.stringify({
        postSlug: '2026/alias-post',
        author: 'Bob',
        content: 'Second comment',
      }),
    });

    expect(secondResponse.status).toBe(429);
    const rateLimited = (await secondResponse.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(rateLimited.ok).toBe(false);
    expect(rateLimited.error.code).toBe('RATE_LIMITED');

    const listResponse = await SELF.fetch(
      'https://example.com/api/v1/comments?postSlug=2026%2Falias-post'
    );
    const listed = (await listResponse.json()) as {
      ok: boolean;
      data: { comments: Array<{ author: string; content: string }>; total: number };
    };

    expect(listed.ok).toBe(true);
    expect(listed.data.total).toBe(1);
    expect(listed.data.comments[0]).toMatchObject({
      author: 'Bob',
      content: 'First comment',
    });
  });

  it('stores reactions in D1 and hides comments through admin delete', async () => {
    const createResponse = await SELF.fetch('https://example.com/api/v1/comments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        postId: '2026/reactions-post',
        author: 'Charlie',
        content: 'React here',
      }),
    });
    const created = (await createResponse.json()) as {
      data: { id: string };
    };

    const addReaction = await SELF.fetch(
      `https://example.com/api/v1/comments/${created.data.id}/reactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emoji: '👍',
          fingerprint: 'fp-react-1',
        }),
      }
    );
    expect(addReaction.status).toBe(201);

    const duplicateReaction = await SELF.fetch(
      `https://example.com/api/v1/comments/${created.data.id}/reactions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          emoji: '👍',
          fingerprint: 'fp-react-1',
        }),
      }
    );
    expect(duplicateReaction.status).toBe(200);
    const duplicatePayload = (await duplicateReaction.json()) as {
      ok: boolean;
      data: { added: boolean };
    };
    expect(duplicatePayload.data.added).toBe(false);

    const batchResponse = await SELF.fetch(
      `https://example.com/api/v1/comments/reactions/batch?commentIds=${created.data.id}`
    );
    expect(batchResponse.status).toBe(200);
    const batchPayload = (await batchResponse.json()) as {
      ok: boolean;
      data: {
        reactions: Record<string, Array<{ emoji: string; count: number }>>;
      };
    };
    expect(batchPayload.ok).toBe(true);
    expect(batchPayload.data.reactions[created.data.id]).toEqual([{ emoji: '👍', count: 1 }]);

    const adminToken = await signJwt(
      {
        sub: 'admin-1',
        role: 'admin',
        username: 'Admin',
        email: 'admin@example.com',
        emailVerified: true,
        type: 'access',
      },
      env
    );

    const deleteResponse = await SELF.fetch(
      `https://example.com/api/v1/comments/${created.data.id}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      }
    );
    expect(deleteResponse.status).toBe(200);

    const hidden = await queryOne<{ status: string }>(
      env.DB,
      'SELECT status FROM comments WHERE id = ?',
      created.data.id
    );
    expect(hidden?.status).toBe('hidden');

    const listResponse = await SELF.fetch(
      'https://example.com/api/v1/comments?postId=2026%2Freactions-post'
    );
    const listed = (await listResponse.json()) as {
      ok: boolean;
      data: { total: number };
    };
    expect(listed.ok).toBe(true);
    expect(listed.data.total).toBe(0);
  });
});
