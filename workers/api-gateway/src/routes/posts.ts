import { Hono } from 'hono';
import type { HonoEnv, Post, JwtPayload } from '../types';
import { success, badRequest, notFound } from '../lib/response';
import { queryAll, queryOne, execute } from '../lib/d1';
import { requireAdmin } from '../middleware/auth';

const posts = new Hono<HonoEnv>();

// GET /posts - List all posts (with optional filters)
posts.get('/', async (c) => {
  const { status, limit, offset, tag } = c.req.query();
  const db = c.env.DB;

  let sql = `
    SELECT p.*, GROUP_CONCAT(t.name) as tags
    FROM posts p
    LEFT JOIN post_tags pt ON p.id = pt.post_id
    LEFT JOIN tags t ON pt.tag_id = t.id
  `;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push('p.status = ?');
    params.push(status);
  } else {
    // Default to published only for public access
    conditions.push('p.status = ?');
    params.push('published');
  }

  if (tag) {
    conditions.push(
      'p.id IN (SELECT pt2.post_id FROM post_tags pt2 JOIN tags t2 ON pt2.tag_id = t2.id WHERE t2.name = ?)'
    );
    params.push(tag);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' GROUP BY p.id ORDER BY p.created_at DESC';

  const limitNum = Math.min(parseInt(limit || '50', 10), 100);
  const offsetNum = parseInt(offset || '0', 10);
  sql += ` LIMIT ? OFFSET ?`;
  params.push(limitNum, offsetNum);

  const items = await queryAll<Post & { tags: string }>(db, sql, ...params);

  // Parse tags from comma-separated string
  const formatted = items.map((item) => ({
    ...item,
    tags: item.tags ? item.tags.split(',') : [],
  }));

  return success(c, { items: formatted });
});

// GET /posts/:slug - Get single post by slug
posts.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = c.env.DB;

  const post = await queryOne<Post>(
    db,
    'SELECT * FROM posts WHERE slug = ? AND status = ?',
    slug,
    'published'
  );

  if (!post) {
    return notFound(c, 'Post not found');
  }

  // Get tags for this post
  const tags = await queryAll<{ name: string }>(
    db,
    `SELECT t.name FROM tags t
     JOIN post_tags pt ON t.id = pt.tag_id
     WHERE pt.post_id = ?`,
    post.id
  );

  return success(c, {
    post: { ...post, tags: tags.map((t) => t.name) },
  });
});

// POST /posts - Create new post (admin only)
posts.post('/', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { title, slug, content, excerpt, cover_image_url, status, tags } = body;

  if (!title || !slug || !content) {
    return badRequest(c, 'title, slug, and content are required');
  }

  const db = c.env.DB;
  const postId = `post-${crypto.randomUUID()}`;
  
  // Get authenticated user ID from JWT payload (set by requireAdmin middleware)
  const user = c.get('user');
  const authorId = user.sub;

  const now = new Date().toISOString();

  await execute(
    db,
    `INSERT INTO posts(id, slug, title, content, excerpt, cover_image_url, status, author_id, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    postId,
    slug,
    title,
    content,
    excerpt || null,
    cover_image_url || null,
    status || 'published',
    authorId,
    status === 'published' ? now : null,
    now,
    now
  );

  // Handle tags if provided
  if (Array.isArray(tags) && tags.length > 0) {
    for (const tagName of tags) {
      // Insert tag if not exists
      await execute(db, 'INSERT OR IGNORE INTO tags(name) VALUES (?)', tagName);
      // Get tag ID
      const tag = await queryOne<{ id: number }>(db, 'SELECT id FROM tags WHERE name = ?', tagName);
      if (tag) {
        await execute(db, 'INSERT INTO post_tags(post_id, tag_id) VALUES (?, ?)', postId, tag.id);
      }
    }
  }

  return success(c, { id: postId, slug }, 201);
});

// PUT /posts/:slug - Update post (admin only)
posts.put('/:slug', requireAdmin, async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json().catch(() => ({}));
  const { title, content, excerpt, cover_image_url, status, tags } = body;

  const db = c.env.DB;

  const existing = await queryOne<Post>(db, 'SELECT * FROM posts WHERE slug = ?', slug);
  if (!existing) {
    return notFound(c, 'Post not found');
  }

  const now = new Date().toISOString();
  const publishedAt = status === 'published' && !existing.published_at ? now : existing.published_at;

  await execute(
    db,
    `UPDATE posts 
     SET title = COALESCE(?, title),
         content = COALESCE(?, content),
         excerpt = COALESCE(?, excerpt),
         cover_image_url = COALESCE(?, cover_image_url),
         status = COALESCE(?, status),
         published_at = ?,
         updated_at = ?
     WHERE id = ?`,
    title,
    content,
    excerpt,
    cover_image_url,
    status,
    publishedAt,
    now,
    existing.id
  );

  // Update tags if provided
  if (Array.isArray(tags)) {
    // Delete existing tag associations
    await execute(db, 'DELETE FROM post_tags WHERE post_id = ?', existing.id);

    // Insert new tags
    for (const tagName of tags) {
      await execute(db, 'INSERT OR IGNORE INTO tags(name) VALUES (?)', tagName);
      const tag = await queryOne<{ id: number }>(db, 'SELECT id FROM tags WHERE name = ?', tagName);
      if (tag) {
        await execute(db, 'INSERT INTO post_tags(post_id, tag_id) VALUES (?, ?)', existing.id, tag.id);
      }
    }
  }

  return success(c, { updated: true });
});

// DELETE /posts/:slug - Delete post (admin only)
posts.delete('/:slug', requireAdmin, async (c) => {
  const slug = c.req.param('slug');
  const db = c.env.DB;

  const existing = await queryOne<Post>(db, 'SELECT id FROM posts WHERE slug = ?', slug);
  if (!existing) {
    return notFound(c, 'Post not found');
  }

  await execute(db, 'DELETE FROM posts WHERE id = ?', existing.id);

  return success(c, { deleted: true });
});

export default posts;
