import { Hono } from 'hono';
import type { HonoEnv, Env } from '../types';
import { success, badRequest, error } from '../lib/response';
import { execute } from '../lib/d1';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { createAIService } from '../lib/ai-service';
import { getAllowedOrigins } from '../lib/cors';
import { getSecret } from '../lib/secrets';
import { getApiBaseUrl } from '../lib/config';
import { proxyToBackendWithPolicy } from '../lib/backend-proxy';

const images = new Hono<HonoEnv>();

const DIRECT_UPLOAD_MAX_SIZE = 20 * 1024 * 1024; // 20MB
const DIRECT_UPLOAD_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const CHAT_UPLOAD_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const CHAT_UPLOAD_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const KV_RATE_LIMIT_PREFIX = 'ratelimit:chat-upload:';
const CHAT_UPLOAD_RATE_LIMIT = 20;
const CHAT_UPLOAD_RATE_WINDOW = 60;

function sanitizeR2Filename(name: string): string {
  const sanitized = String(name || '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
  if (!sanitized || sanitized.startsWith('.')) return `upload-${Date.now()}`;
  return sanitized.slice(0, 160);
}

function sanitizeR2Segment(value: string): string {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 128);
}

function validateUploadFile(
  file: File,
  {
    maxSize,
    allowedTypes,
  }: {
    maxSize: number;
    allowedTypes: string[];
  }
): string | null {
  if (file.size > maxSize) {
    return `File too large - maximum ${maxSize / 1024 / 1024}MB allowed`;
  }

  if (!allowedTypes.includes(file.type)) {
    return `Invalid file type - allowed: ${allowedTypes.join(', ')}`;
  }

  return null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function resolveAssetsBaseUrl(env: Env): Promise<string> {
  const secretValue = await getSecret(env, 'ASSETS_BASE_URL');
  if (secretValue || env.ASSETS_BASE_URL) {
    return String(secretValue || env.ASSETS_BASE_URL).replace(/\/$/, '');
  }

  const apiBaseUrl = await getApiBaseUrl(env);
  return `${apiBaseUrl.replace(/\/$/, '')}/images`;
}

async function resolveApiBaseUrl(env: Env): Promise<string> {
  const apiBaseUrl = await getApiBaseUrl(env);
  return apiBaseUrl.replace(/\/$/, '');
}

images.post('/upload', requireAdmin, async (c) => {
  return proxyToBackendWithPolicy(c, {
    upstreamPath: '/api/v1/images/upload',
    backendUnavailableMessage: 'Could not connect to images backend',
  });
});

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
  const sanitized = sanitizeR2Filename(filename);
  const timestamp = Date.now();
  const sanitizedPostId = postId ? sanitizeR2Segment(postId) : '';
  const key = sanitizedPostId
    ? `posts/${sanitizedPostId}/${timestamp}-${sanitized}`
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

  const validationError = validateUploadFile(file, {
    maxSize: DIRECT_UPLOAD_MAX_SIZE,
    allowedTypes: DIRECT_UPLOAD_ALLOWED_TYPES,
  });
  if (validationError) {
    return badRequest(c, validationError);
  }

  const r2 = c.env.R2;
  if (!r2) {
    return badRequest(c, 'R2 bucket is not configured');
  }
  const db = c.env.DB;

  // Generate R2 key
  const sanitized = sanitizeR2Filename(file.name);
  const timestamp = Date.now();
  const sanitizedPostId = postId ? sanitizeR2Segment(postId) : '';
  const key = sanitizedPostId
    ? `posts/${sanitizedPostId}/${timestamp}-${sanitized}`
    : `uploads/${new Date().getFullYear()}/${timestamp}-${sanitized}`;

  // Upload to R2
  const buffer = await file.arrayBuffer();
  await r2.put(key, buffer, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  });

  // Generate public URL (assuming R2 public bucket or custom domain)
  const assetsBase = await resolveAssetsBaseUrl(c.env);
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

  return success(
    c,
    {
      id: attachmentId,
      url,
      key,
      size: file.size,
    },
    201
  );
});

// POST /images/chat-upload - Direct upload for AI Chat images (auth + origin-guarded, rate-limited)
images.post('/chat-upload', requireAuth, async (c) => {
  const origin = c.req.header('origin') || '';
  const allowedOrigins = await getAllowedOrigins(c.env);

  if (!origin) {
    return error(c, 'Forbidden - Origin header required', 403);
  }

  if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return error(c, 'Forbidden - Invalid origin', 403);
  }

  const kv = c.env.KV;
  if (kv) {
    const clientIP =
      c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const rateLimitKey = `${KV_RATE_LIMIT_PREFIX}${clientIP}`;
    const currentCount = parseInt((await kv.get(rateLimitKey)) || '0', 10);

    if (currentCount >= CHAT_UPLOAD_RATE_LIMIT) {
      return error(c, 'Too many requests - Rate limit exceeded', 429);
    }

    await kv.put(rateLimitKey, String(currentCount + 1), {
      expirationTtl: CHAT_UPLOAD_RATE_WINDOW,
    });
  }

  const contentType = c.req.header('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return badRequest(c, 'multipart/form-data required');
  }

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return badRequest(c, 'file is required');
  }

  const validationError = validateUploadFile(file, {
    maxSize: CHAT_UPLOAD_MAX_SIZE,
    allowedTypes: CHAT_UPLOAD_ALLOWED_TYPES,
  });
  if (validationError) {
    return badRequest(c, validationError);
  }

  const r2 = c.env.R2;
  if (!r2) {
    return badRequest(c, 'R2 bucket is not configured');
  }

  const user = c.get('user');
  const userId = user?.sub;
  if (!userId) {
    return error(c, 'Authentication required', 401, 'UNAUTHORIZED');
  }

  const sanitized = sanitizeR2Filename(file.name);
  const timestamp = Date.now();
  const sanitizedUserId = sanitizeR2Segment(userId);
  const key = `private/ai-chat/${sanitizedUserId}/${new Date().getFullYear()}/${timestamp}-${sanitized}`;

  const buffer = await file.arrayBuffer();
  await r2.put(key, buffer, {
    httpMetadata: {
      contentType: file.type || 'application/octet-stream',
    },
  });

  const apiBase = await resolveApiBaseUrl(c.env);
  const url = `${apiBase}/api/v1/images/chat-object?key=${encodeURIComponent(key)}`;

  let imageAnalysis: string | null = null;

  if (file.type?.startsWith('image/')) {
    try {
      const base64 = arrayBufferToBase64(buffer);
      const aiService = createAIService(c.env);
      imageAnalysis = await aiService.vision(base64, 'Describe this image briefly', {
        mimeType: file.type,
      });
    } catch (err) {
      console.error('Vision analysis failed:', err);
    }
  }

  return success(
    c,
    {
      url,
      key,
      visibility: 'private',
      size: file.size,
      contentType: file.type || 'application/octet-stream',
      imageAnalysis,
    },
    201
  );
});

// GET /images/chat-object?key=... - Authenticated read for private chat uploads
images.get('/chat-object', requireAuth, async (c) => {
  const key = c.req.query('key') || '';
  const user = c.get('user');
  const userId = user?.sub;
  const prefix = `private/ai-chat/${sanitizeR2Segment(userId || '')}/`;

  if (!key || !key.startsWith(prefix)) {
    return error(c, 'Forbidden - Invalid chat object key', 403, 'FORBIDDEN');
  }

  const r2 = c.env.R2;
  if (!r2) {
    return badRequest(c, 'R2 bucket is not configured');
  }

  const object = await r2.get(key);
  if (!object) {
    return error(c, 'Object not found', 404, 'NOT_FOUND');
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('ETag', object.httpEtag || '');

  return new Response(object.body, { headers });
});

// DELETE /images/:key - Delete image from R2 (admin only)
images.delete('/:key', requireAdmin, async (c) => {
  const key = c.req.param('key');
  if (!key) return badRequest(c, 'Image key is required');
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
