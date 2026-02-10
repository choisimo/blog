/**
 * Personas Routes
 * 
 * AI 페르소나 관리 API (D1 기반)
 * 사용자가 정의한 AI 페르소나를 저장하고 관리합니다.
 * 
 * JWT 인증이 필요하며, userId는 JWT에서 추출합니다.
 * 
 * 엔드포인트:
 * - GET    /personas              - 사용자의 모든 페르소나 목록
 * - GET    /personas/:id          - 특정 페르소나 조회
 * - POST   /personas              - 새 페르소나 생성
 * - PUT    /personas/:id          - 페르소나 수정
 * - DELETE /personas/:id          - 페르소나 삭제
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, JwtPayload } from '../types';
import { success, badRequest, notFound, unauthorized } from '../lib/response';
import { queryAll, execute, queryOne } from '../lib/d1';
import { requireAuth } from '../middleware/auth';

type PersonaContext = { Bindings: Env; Variables: { user: JwtPayload } };

const personas = new Hono<PersonaContext>();

// Apply auth middleware to all routes
personas.use('*', requireAuth);

// Types
interface Persona {
  id: string;
  user_id: string;
  name: string;
  prompt: string;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

// Validation constants
const MAX_NAME_LENGTH = 120;
const MAX_PROMPT_LENGTH = 4000;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 50;

/**
 * Get userId from JWT payload
 */
function getUserId(c: Context<PersonaContext>): string | null {
  const user = c.get('user');
  return user?.sub || null;
}

/**
 * Parse and validate tags
 */
function parseTags(tags: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && t.length <= MAX_TAG_LENGTH)
      .slice(0, MAX_TAGS);
  }
  return [];
}

/**
 * Serialize tags to JSON string
 */
function serializeTags(tags: string[]): string | null {
  return tags.length > 0 ? JSON.stringify(tags) : null;
}

/**
 * Deserialize tags from JSON string
 */
function deserializeTags(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Format persona for API response
 */
function formatPersona(p: Persona) {
  return {
    id: p.id,
    name: p.name,
    prompt: p.prompt,
    tags: deserializeTags(p.tags),
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

// GET /personas - Get all personas for authenticated user
personas.get('/', async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return unauthorized(c, 'User not authenticated');
  }

  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  const cursor = c.req.query('cursor');

  const db = c.env.DB;

  // Use cursor if provided (for pagination)
  let items: Persona[];
  if (cursor) {
    items = await queryAll<Persona>(
      db,
      `SELECT id, user_id, name, prompt, tags, created_at, updated_at
       FROM personas
       WHERE user_id = ? AND created_at < ?
       ORDER BY created_at DESC
       LIMIT ?`,
      userId,
      cursor,
      limit
    );
  } else {
    items = await queryAll<Persona>(
      db,
      `SELECT id, user_id, name, prompt, tags, created_at, updated_at
       FROM personas
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      userId,
      limit,
      offset
    );
  }

  // Get next cursor if there are more items
  const nextCursor = items.length === limit ? items[items.length - 1]?.created_at : null;

  return success(c, items.map(formatPersona), 200, {
    cursor: nextCursor,
    hasMore: items.length === limit,
  });
});

// GET /personas/:id - Get a specific persona
personas.get('/:id', async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return unauthorized(c, 'User not authenticated');
  }

  const id = c.req.param('id');
  if (!id) {
    return badRequest(c, 'id is required');
  }

  const db = c.env.DB;

  const persona = await queryOne<Persona>(
    db,
    `SELECT id, user_id, name, prompt, tags, created_at, updated_at
     FROM personas
     WHERE id = ? AND user_id = ?`,
    id,
    userId
  );

  if (!persona) {
    return notFound(c, 'Persona not found');
  }

  return success(c, formatPersona(persona));
});

// POST /personas - Create a new persona
personas.post('/', async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return unauthorized(c, 'User not authenticated');
  }

  const body = await c.req.json().catch(() => ({}));
  const { name, prompt, tags } = body as {
    name?: string;
    prompt?: string;
    tags?: string[];
  };

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return badRequest(c, 'name is required');
  }
  if (name.length > MAX_NAME_LENGTH) {
    return badRequest(c, `name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
    return badRequest(c, 'prompt is required and must be at least 10 characters');
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return badRequest(c, `prompt must be at most ${MAX_PROMPT_LENGTH} characters`);
  }

  const db = c.env.DB;
  const now = new Date().toISOString();
  const id = `persona-${crypto.randomUUID()}`;
  const parsedTags = parseTags(tags);

  await execute(
    db,
    `INSERT INTO personas (id, user_id, name, prompt, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    userId,
    name.trim(),
    prompt.trim(),
    serializeTags(parsedTags),
    now,
    now
  );

  return success(
    c,
    {
      id,
      name: name.trim(),
      prompt: prompt.trim(),
      tags: parsedTags,
      createdAt: now,
      updatedAt: now,
    },
    201
  );
});

// PUT /personas/:id - Update a persona
personas.put('/:id', async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return unauthorized(c, 'User not authenticated');
  }

  const id = c.req.param('id');
  if (!id) {
    return badRequest(c, 'id is required');
  }

  const body = await c.req.json().catch(() => ({}));
  const { name, prompt, tags } = body as {
    name?: string;
    prompt?: string;
    tags?: string[];
  };

  const db = c.env.DB;

  // Check if persona exists and belongs to user
  const existing = await queryOne<Persona>(
    db,
    `SELECT id, created_at FROM personas WHERE id = ? AND user_id = ?`,
    id,
    userId
  );

  if (!existing) {
    return notFound(c, 'Persona not found');
  }

  // Validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return badRequest(c, 'name is required');
  }
  if (name.length > MAX_NAME_LENGTH) {
    return badRequest(c, `name must be at most ${MAX_NAME_LENGTH} characters`);
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
    return badRequest(c, 'prompt is required and must be at least 10 characters');
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return badRequest(c, `prompt must be at most ${MAX_PROMPT_LENGTH} characters`);
  }

  const now = new Date().toISOString();
  const parsedTags = parseTags(tags);

  await execute(
    db,
    `UPDATE personas SET name = ?, prompt = ?, tags = ?, updated_at = ? WHERE id = ?`,
    name.trim(),
    prompt.trim(),
    serializeTags(parsedTags),
    now,
    id
  );

  return success(c, {
    id,
    name: name.trim(),
    prompt: prompt.trim(),
    tags: parsedTags,
    createdAt: existing.created_at,
    updatedAt: now,
  });
});

// DELETE /personas/:id - Delete a persona
personas.delete('/:id', async (c) => {
  const userId = getUserId(c);
  if (!userId) {
    return unauthorized(c, 'User not authenticated');
  }

  const id = c.req.param('id');
  if (!id) {
    return badRequest(c, 'id is required');
  }

  const db = c.env.DB;

  const result = await execute(
    db,
    `DELETE FROM personas WHERE id = ? AND user_id = ?`,
    id,
    userId
  );

  if (result.meta?.changes === 0) {
    return notFound(c, 'Persona not found');
  }

  return success(c, { deleted: true });
});

export default personas;
