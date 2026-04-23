import { Hono } from 'hono';
import type { Context } from 'hono';
import type { HonoEnv, Comment } from '../types';
import { badRequest, notFound, success } from '../lib/response';
import { execute, queryAll, queryOne } from '../lib/d1';
import { getCorsHeadersForRequest } from '../lib/cors';
import { requireAdmin } from '../middleware/auth';

const comments = new Hono<HonoEnv>();

const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💡'];
const COMMENT_STREAM_POLL_INTERVAL_MS = 5000;
const COMMENT_RATE_LIMIT_SECONDS = 60;

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim();
}

function normalizePostIdentifier(value: unknown): string {
  return String(value || '')
    .trim()
    .slice(0, 256);
}

function resolvePostIdentifier(value: {
  postId?: unknown;
  postSlug?: unknown;
  slug?: unknown;
}): string {
  return normalizePostIdentifier(value.postId || value.postSlug || value.slug);
}

function normalizeCommentId(value: unknown): string {
  return String(value || '')
    .trim()
    .slice(0, 128);
}

function normalizeEmoji(value: unknown): string {
  return String(value || '')
    .trim()
    .slice(0, 8);
}

function normalizeFingerprint(value: unknown): string {
  return String(value || '')
    .trim()
    .slice(0, 128);
}

function parseYearSlugPostId(postId: string): { year: string; slug: string } | null {
  const match = postId.match(/^(\d{4})\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,127})$/);
  if (!match) return null;
  return { year: match[1], slug: match[2] };
}

function getPublicSiteUrl(env: HonoEnv['Bindings']): string {
  return String(env.PUBLIC_SITE_URL || 'https://noblog.nodove.com').replace(/\/$/, '');
}

async function publicPostExists(env: HonoEnv['Bindings'], postId: string): Promise<boolean> {
  const parsed = parseYearSlugPostId(postId);
  if (!parsed) return false;

  const url = `${getPublicSiteUrl(env)}/posts/${encodeURIComponent(parsed.year)}/${encodeURIComponent(parsed.slug)}.md`;
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/markdown, text/plain, */*' },
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    console.error('Failed to verify comment post existence:', error);
    return false;
  }
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function resolveCommentRateLimitIdentity(
  c: Context<HonoEnv>,
  fingerprint: string
): Promise<string> {
  if (fingerprint) return fingerprint;

  const ip =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for') ||
    'unknown-ip';
  const userAgent = c.req.header('user-agent') || 'unknown-ua';
  const digest = await sha256Hex(`${ip}:${userAgent}`);
  return `ip:${digest}`;
}

export type CommentStreamCursor = {
  createdAt: string;
  id: string;
};

function normalizeCursorTimestamp(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const parsed = Date.parse(raw);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

export function createCommentStreamCursor(
  since: unknown,
  sinceId: unknown,
  fallbackSince = new Date().toISOString()
): CommentStreamCursor {
  return {
    createdAt: normalizeCursorTimestamp(since) || fallbackSince,
    id: normalizeCommentId(sinceId),
  };
}

export function buildVisibleCommentsAfterCursorQuery(postId: string, cursor: CommentStreamCursor) {
  return {
    sql: `SELECT id, post_id, author, content, email, status, created_at, updated_at
            FROM comments
           WHERE post_id = ?
             AND status = 'visible'
             AND (
               created_at > ?
               OR (created_at = ? AND id > ?)
             )
           ORDER BY created_at ASC, id ASC`,
    params: [postId, cursor.createdAt, cursor.createdAt, cursor.id],
  };
}

export function getNextCommentStreamCursor(
  items: Array<Pick<Comment, 'id' | 'created_at'>>,
  current: CommentStreamCursor
): CommentStreamCursor {
  const last = items[items.length - 1];
  if (!last) return current;

  return {
    createdAt: last.created_at,
    id: last.id,
  };
}

async function queryVisibleCommentsAfterCursor(
  db: HonoEnv['Bindings']['DB'],
  postId: string,
  cursor: CommentStreamCursor
) {
  const query = buildVisibleCommentsAfterCursorQuery(postId, cursor);
  return queryAll<Comment>(db, query.sql, ...query.params);
}

function mapComment(item: Comment) {
  return {
    id: item.id,
    postId: item.post_id,
    author: item.author,
    content: item.content,
    website: null,
    parentId: null,
    createdAt: item.created_at,
  };
}

comments.get('/reactions/batch', async (c) => {
  const raw = String(c.req.query('commentIds') || '').trim();
  const ids = raw
    .split(',')
    .map((value) => normalizeCommentId(value))
    .filter(Boolean)
    .slice(0, 200);

  if (ids.length === 0) {
    return success(c, { reactions: {} });
  }

  type ReactionRow = {
    comment_id: string;
    emoji: string;
    count: number | string;
  };

  const placeholders = ids.map(() => '?').join(',');
  const rows = await queryAll<ReactionRow>(
    c.env.DB,
    `SELECT comment_id, emoji, COUNT(*) as count
       FROM comment_reactions
      WHERE comment_id IN (${placeholders})
      GROUP BY comment_id, emoji`,
    ...ids
  );

  const reactions: Record<string, Array<{ emoji: string; count: number }>> = {};
  for (const id of ids) reactions[id] = [];

  for (const row of rows) {
    if (!reactions[row.comment_id]) reactions[row.comment_id] = [];
    reactions[row.comment_id].push({
      emoji: row.emoji,
      count: Number(row.count || 0),
    });
  }

  return success(c, { reactions });
});

comments.get('/:commentId/reactions', async (c) => {
  const commentId = normalizeCommentId(c.req.param('commentId'));
  if (!commentId) {
    return badRequest(c, 'commentId is required');
  }

  const comment = await queryOne<{ id: string }>(
    c.env.DB,
    'SELECT id FROM comments WHERE id = ? AND status = ?',
    commentId,
    'visible'
  );
  if (!comment) {
    return notFound(c, 'Comment not found');
  }

  type ReactionRow = {
    emoji: string;
    count: number | string;
  };

  const rows = await queryAll<ReactionRow>(
    c.env.DB,
    `SELECT emoji, COUNT(*) as count
       FROM comment_reactions
      WHERE comment_id = ?
      GROUP BY emoji
      ORDER BY count DESC`,
    commentId
  );

  return success(c, {
    reactions: rows.map((row) => ({
      emoji: row.emoji,
      count: Number(row.count || 0),
    })),
  });
});

comments.post('/:commentId/reactions', async (c) => {
  const commentId = normalizeCommentId(c.req.param('commentId'));
  const body = (await c.req.json().catch(() => ({}))) as {
    emoji?: string;
    fingerprint?: string;
  };
  const emoji = normalizeEmoji(body.emoji);
  const fingerprint = normalizeFingerprint(body.fingerprint);

  if (!commentId) {
    return badRequest(c, 'commentId is required');
  }
  if (!emoji) {
    return badRequest(c, 'emoji is required');
  }
  if (!fingerprint) {
    return badRequest(c, 'fingerprint is required');
  }
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return badRequest(c, 'Invalid emoji');
  }

  const comment = await queryOne<{ id: string }>(
    c.env.DB,
    'SELECT id FROM comments WHERE id = ? AND status = ?',
    commentId,
    'visible'
  );
  if (!comment) {
    return notFound(c, 'Comment not found');
  }

  try {
    await execute(
      c.env.DB,
      `INSERT INTO comment_reactions (id, comment_id, emoji, user_fingerprint, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      `reaction-${crypto.randomUUID()}`,
      commentId,
      emoji,
      fingerprint,
      new Date().toISOString()
    );
    return success(c, { added: true, emoji }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('UNIQUE constraint')) {
      return success(c, { added: false, message: 'Already reacted' });
    }
    throw error;
  }
});

comments.delete('/:commentId/reactions', async (c) => {
  const commentId = normalizeCommentId(c.req.param('commentId'));
  const body = (await c.req.json().catch(() => ({}))) as {
    emoji?: string;
    fingerprint?: string;
  };
  const emoji = normalizeEmoji(body.emoji);
  const fingerprint = normalizeFingerprint(body.fingerprint);

  if (!commentId) {
    return badRequest(c, 'commentId is required');
  }
  if (!emoji) {
    return badRequest(c, 'emoji is required');
  }
  if (!fingerprint) {
    return badRequest(c, 'fingerprint is required');
  }

  await execute(
    c.env.DB,
    `DELETE FROM comment_reactions
      WHERE comment_id = ? AND emoji = ? AND user_fingerprint = ?`,
    commentId,
    emoji,
    fingerprint
  );

  return success(c, { removed: true });
});

comments.get('/', async (c) => {
  const postId = resolvePostIdentifier({
    postId: c.req.query('postId'),
    postSlug: c.req.query('postSlug'),
    slug: c.req.query('slug'),
  });

  if (!postId) {
    return badRequest(c, 'postId, postSlug, or slug is required');
  }

  const items = await queryAll<Comment>(
    c.env.DB,
    `SELECT id, post_id, author, content, email, status, created_at, updated_at
       FROM comments
      WHERE post_id = ? AND status = 'visible'
      ORDER BY created_at ASC`,
    postId
  );

  const mapped = items.map(mapComment);
  return success(c, { comments: mapped, total: mapped.length });
});

comments.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    postId?: string;
    postSlug?: string;
    slug?: string;
    author?: string;
    content?: string;
    email?: string;
    website?: string;
    fingerprint?: string;
  };

  const postId = resolvePostIdentifier(body);
  if (!postId) {
    return badRequest(c, 'postId, postSlug, or slug is required');
  }

  if (!(await publicPostExists(c.env, postId))) {
    return notFound(c, 'Post not found');
  }

  if (typeof body.author !== 'string' || typeof body.content !== 'string') {
    return badRequest(c, 'author and content are required');
  }

  if (body.author.length > 64 || body.content.length > 5000) {
    return badRequest(c, 'Author or content too long');
  }

  const author = stripHtml(body.author).slice(0, 64);
  const content = stripHtml(body.content).slice(0, 5000);
  const email = typeof body.email === 'string' ? stripHtml(body.email).slice(0, 256) : null;
  const fingerprint = normalizeFingerprint(
    c.req.header('X-Device-Fingerprint') || body.fingerprint
  );
  const rateLimitIdentity = await resolveCommentRateLimitIdentity(c, fingerprint);

  if (!author || !content) {
    return badRequest(c, 'Author and content must not be empty after sanitization');
  }

  const recent = await queryOne<{ id: string }>(
    c.env.DB,
    `SELECT id
       FROM comments
      WHERE device_fingerprint = ?
        AND created_at > datetime('now', ?)
      LIMIT 1`,
    rateLimitIdentity,
    `-${COMMENT_RATE_LIMIT_SECONDS} seconds`
  );

  if (recent) {
    return c.json(
      {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many comments. Please wait a moment before posting again.',
        },
      },
      { status: 429 }
    );
  }

  const commentId = `comment-${crypto.randomUUID()}`;
  const now = new Date().toISOString();

  await execute(
    c.env.DB,
    `INSERT INTO comments(
       id,
       post_id,
       author,
       email,
       content,
       device_fingerprint,
       status,
       created_at,
       updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    commentId,
    postId,
    author,
    email,
    content,
    rateLimitIdentity,
    'visible',
    now,
    now
  );

  return success(c, { id: commentId }, 201);
});

comments.get('/stream', async (c) => {
  const postId = resolvePostIdentifier({
    postId: c.req.query('postId'),
    postSlug: c.req.query('postSlug'),
    slug: c.req.query('slug'),
  });

  if (!postId) {
    return badRequest(c, 'postId, postSlug, or slug is required');
  }

  const encoder = new TextEncoder();
  const corsHeaders = await getCorsHeadersForRequest(c.req.raw, c.env);
  const initialCursor = createCommentStreamCursor(c.req.query('since'), c.req.query('sinceId'));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const signal = c.req.raw.signal;

      let closed = false;
      let cursor = initialCursor;
      let lastPing = 0;

      const onAbort = () => {
        closed = true;
        try {
          controller.close();
        } catch {
          void 0;
        }
      };

      if (signal) {
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }

      send({ type: 'open', postId, ts: Date.now() });

      while (!closed) {
        try {
          const items = await queryVisibleCommentsAfterCursor(c.env.DB, postId, cursor);
          const appended = items.map(mapComment);

          if (appended.length > 0) {
            send({ type: 'append', items: appended });
            cursor = getNextCommentStreamCursor(items, cursor);
          }

          const now = Date.now();
          if (now - lastPing > 25000) {
            send({ type: 'ping', ts: now });
            lastPing = now;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'poll failed';
          send({ type: 'error', message });
        }

        await sleep(COMMENT_STREAM_POLL_INTERVAL_MS);
      }

      try {
        signal?.removeEventListener('abort', onAbort);
      } catch {
        void 0;
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...corsHeaders,
    },
  });
});

comments.delete('/:id', requireAdmin, async (c) => {
  const id = normalizeCommentId(c.req.param('id'));
  if (!id) {
    return badRequest(c, 'commentId is required');
  }

  const existing = await queryOne<{ id: string }>(
    c.env.DB,
    'SELECT id FROM comments WHERE id = ?',
    id
  );
  if (!existing) {
    return notFound(c, 'Comment not found');
  }

  await execute(
    c.env.DB,
    "UPDATE comments SET status = 'hidden', updated_at = ? WHERE id = ?",
    new Date().toISOString(),
    id
  );

  return success(c, { deleted: true });
});

export default comments;
