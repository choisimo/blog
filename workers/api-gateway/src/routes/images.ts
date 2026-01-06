import { Hono } from 'hono';
import type { Env } from '../types';
import { success, badRequest, notFound } from '../lib/response';
import { execute } from '../lib/d1';
import { requireAdmin } from '../middleware/auth';
import { createAIService } from '../lib/ai-service';

const images = new Hono<{ Bindings: Env }>();

// POST /images/presign - Generate presigned URL for R2 upload (admin only)
images.post('/presign', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { filename, contentType, postId } = body;

  if (!filename) {
    return badRequest(c, 'filename is required');
  }

  const r2 = c.env.R2;
  if (!r2) {
    return badRequest(c, 'R2 bucket is not configured');
  }
  
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
  if (!r2) {
    return badRequest(c, 'R2 bucket is not configured');
  }
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
  const assetsBase = (c.env.ASSETS_BASE_URL || 'https://assets-b.nodove.com').replace(/\/$/, '');
  const url = `${assetsBase}/${key}`;

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

// POST /images/chat-upload - Direct upload for AI Chat images (public, origin-guarded)
// Also performs AI vision analysis and returns the description
images.post('/chat-upload', async c => {
  const contentType = c.req.header('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return badRequest(c, 'multipart/form-data required');
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return badRequest(c, 'file is required');
  }

  const r2 = c.env.R2;
  if (!r2) {
    return badRequest(c, 'R2 bucket is not configured');
  }

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const timestamp = Date.now();
  const key = `ai-chat/${new Date().getFullYear()}/${timestamp}-${sanitized}`;

  const buffer = await file.arrayBuffer();
  await r2.put(key, buffer, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  });

  const assetsBase = (c.env.ASSETS_BASE_URL || 'https://assets.blog.nodove.com').replace(/\/$/, '');
  const url = `${assetsBase}/${key}`;

  // Perform AI vision analysis via backend server
  let imageAnalysis: string | null = null;
  
  if (file.type?.startsWith('image/')) {
    try {
      // Use R2 URL directly for vision API instead of base64
      // This is more efficient and avoids memory issues with large images
      const aiService = createAIService(c.env);
      imageAnalysis = await aiService.visionWithUrl(
        url, // Use the R2 URL we just uploaded
        '이 이미지를 간결하게 설명해주세요. 주요 요소, 분위기, 텍스트가 있다면 내용을 포함해주세요.',
        { mimeType: file.type }
      );
    } catch (err) {
      // Vision analysis failed, but upload succeeded - continue without analysis
      console.error('Vision analysis failed:', err);
    }
  }

  return success(
    c,
    {
      url,
      key,
      size: file.size,
      contentType: file.type || 'application/octet-stream',
      imageAnalysis, // AI vision analysis result (null if not available)
    },
    201
  );
});

// DELETE /images/:key - Delete image from R2 (admin only)
images.delete('/:key', requireAdmin, async (c) => {
  const key = c.req.param('key');
  const r2 = c.env.R2;
  if (!r2) {
    return badRequest(c, 'R2 bucket is not configured');
  }
  const db = c.env.DB;

  // Delete from R2
  await r2.delete(key);

  // Delete metadata from D1
  await execute(db, 'DELETE FROM attachments WHERE r2_key = ?', key);

  return success(c, { deleted: true });
});

export default images;
