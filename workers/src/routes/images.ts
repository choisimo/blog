import { Hono } from 'hono';
import type { Env } from '../types';
import { success, badRequest, notFound } from '../lib/response';
import { execute } from '../lib/d1';
import { requireAdmin } from '../middleware/auth';

const images = new Hono<{ Bindings: Env }>();

// POST /images/presign - Generate presigned URL for R2 upload (admin only)
images.post('/presign', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { filename, contentType, postId } = body;

  if (!filename) {
    return badRequest(c, 'filename is required');
  }

  const r2 = c.env.R2;
  
  // Generate a unique key for R2
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const timestamp = Date.now();
  const key = postId
    ? `posts/${postId}/${timestamp}-${sanitized}`
    : `uploads/${new Date().getFullYear()}/${timestamp}-${sanitized}`;

  // For presigned URL approach, we'd use R2's presigned URL API
  // Since R2 doesn't directly support presigned URLs via Workers binding,
  // we'll use direct upload approach instead

  return success(c, {
    key,
    uploadUrl: `/images/upload-direct`, // Client will POST here
    metadata: {
      contentType: contentType || 'application/octet-stream',
    },
  });
});

// POST /images/upload-direct - Direct upload to R2 (admin only)
images.post('/upload-direct', requireAdmin, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const postId = formData.get('postId') as string | null;

  if (!file) {
    return badRequest(c, 'file is required');
  }

  const r2 = c.env.R2;
  const db = c.env.DB;

  // Generate R2 key
  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const timestamp = Date.now();
  const key = postId
    ? `posts/${postId}/${timestamp}-${sanitized}`
    : `uploads/${new Date().getFullYear()}/${timestamp}-${sanitized}`;

  // Upload to R2
  const buffer = await file.arrayBuffer();
  await r2.put(key, buffer, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  });

  // Generate public URL (assuming R2 public bucket or custom domain)
  const url = `https://assets.blog.nodove.com/${key}`; // Update with actual R2 public URL

  // Save metadata to D1
  const attachmentId = `attach-${crypto.randomUUID()}`;
  if (postId) {
    await execute(
      db,
      `INSERT INTO attachments(id, post_id, url, r2_key, content_type, size_bytes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      attachmentId,
      postId,
      url,
      key,
      file.type,
      file.size,
      new Date().toISOString()
    );
  }

  return success(c, {
    id: attachmentId,
    url,
    key,
    size: file.size,
  }, 201);
});

// DELETE /images/:key - Delete image from R2 (admin only)
images.delete('/:key', requireAdmin, async (c) => {
  const key = c.req.param('key');
  const r2 = c.env.R2;
  const db = c.env.DB;

  // Delete from R2
  await r2.delete(key);

  // Delete metadata from D1
  await execute(db, 'DELETE FROM attachments WHERE r2_key = ?', key);

  return success(c, { deleted: true });
});

export default images;
