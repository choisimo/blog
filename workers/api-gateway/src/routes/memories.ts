import { Hono } from 'hono';
import type { Env } from '../types';
import { success, badRequest, notFound, serverError } from '../lib/response';
import { queryAll, execute, queryOne } from '../lib/d1';

const memories = new Hono<{ Bindings: Env }>();

// Types
interface UserMemory {
  id: string;
  user_id: string;
  memory_type: string;
  category: string | null;
  content: string;
  source_type: string | null;
  source_id: string | null;
  importance_score: number;
  access_count: number;
  last_accessed_at: string | null;
  expires_at: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

interface ChatSession {
  id: string;
  user_id: string;
  title: string | null;
  summary: string | null;
  question_mode: string;
  article_slug: string | null;
  message_count: number;
  total_tokens: number;
  is_archived: number;
  is_deleted: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: string;
  content: string;
  content_type: string;
  metadata: string | null;
  created_at: string;
}

// ========================================
// MEMORY ENDPOINTS
// ========================================

// GET /memories/:userId - Get all active memories for a user
memories.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  if (!userId) return badRequest(c, 'userId is required');

  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  const memoryType = c.req.query('type');
  const category = c.req.query('category');

  const db = c.env.DB;

  let query = `
    SELECT id, user_id, memory_type, category, content, source_type, source_id,
           importance_score, access_count, last_accessed_at, expires_at,
           is_active, created_at, updated_at
    FROM user_memories
    WHERE user_id = ? AND is_active = 1
  `;
  const params: any[] = [userId];

  if (memoryType) {
    query += ` AND memory_type = ?`;
    params.push(memoryType);
  }
  if (category) {
    query += ` AND category = ?`;
    params.push(category);
  }

  query += ` ORDER BY importance_score DESC, created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const items = await queryAll<UserMemory>(db, query, ...params);

  // Get total count
  let countQuery = `SELECT COUNT(*) as count FROM user_memories WHERE user_id = ? AND is_active = 1`;
  const countParams: any[] = [userId];
  if (memoryType) {
    countQuery += ` AND memory_type = ?`;
    countParams.push(memoryType);
  }
  if (category) {
    countQuery += ` AND category = ?`;
    countParams.push(category);
  }

  const countResult = await queryOne<{ count: number }>(db, countQuery, ...countParams);

  return success(c, {
    memories: items.map(m => ({
      id: m.id,
      userId: m.user_id,
      memoryType: m.memory_type,
      category: m.category,
      content: m.content,
      sourceType: m.source_type,
      sourceId: m.source_id,
      importanceScore: m.importance_score,
      accessCount: m.access_count,
      lastAccessedAt: m.last_accessed_at,
      expiresAt: m.expires_at,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    })),
    total: countResult?.count || 0,
  });
});

// POST /memories/:userId - Create a new memory
memories.post('/:userId', async (c) => {
  const userId = c.req.param('userId');
  if (!userId) return badRequest(c, 'userId is required');

  const body = await c.req.json().catch(() => ({}));
  const {
    memoryType = 'fact',
    category,
    content,
    sourceType,
    sourceId,
    importanceScore = 0.5,
    expiresAt,
  } = body as {
    memoryType?: string;
    category?: string;
    content: string;
    sourceType?: string;
    sourceId?: string;
    importanceScore?: number;
    expiresAt?: string;
  };

  if (!content || typeof content !== 'string') {
    return badRequest(c, 'content is required');
  }

  if (content.length > 10000) {
    return badRequest(c, 'Content too large (max 10KB)');
  }

  const db = c.env.DB;
  const now = new Date().toISOString();
  const id = `mem-${crypto.randomUUID()}`;

  await execute(
    db,
    `INSERT INTO user_memories
     (id, user_id, memory_type, category, content, source_type, source_id,
      importance_score, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, userId, memoryType, category || null, content,
    sourceType || null, sourceId || null,
    Math.max(0, Math.min(1, importanceScore)),
    expiresAt || null, now, now
  );

  return success(c, { id, created: true }, 201);
});

// POST /memories/:userId/batch - Create multiple memories at once
memories.post('/:userId/batch', async (c) => {
  const userId = c.req.param('userId');
  if (!userId) return badRequest(c, 'userId is required');

  const body = await c.req.json().catch(() => ({}));
  const { memories: memoryItems } = body as {
    memories: Array<{
      memoryType?: string;
      category?: string;
      content: string;
      sourceType?: string;
      sourceId?: string;
      importanceScore?: number;
    }>;
  };

  if (!Array.isArray(memoryItems) || memoryItems.length === 0) {
    return badRequest(c, 'memories array is required');
  }

  if (memoryItems.length > 20) {
    return badRequest(c, 'Maximum 20 memories per batch');
  }

  const db = c.env.DB;
  const now = new Date().toISOString();
  const createdIds: string[] = [];

  for (const item of memoryItems) {
    if (!item.content || typeof item.content !== 'string') continue;
    if (item.content.length > 10000) continue;

    const id = `mem-${crypto.randomUUID()}`;
    await execute(
      db,
      `INSERT INTO user_memories
       (id, user_id, memory_type, category, content, source_type, source_id,
        importance_score, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id, userId,
      item.memoryType || 'fact',
      item.category || null,
      item.content,
      item.sourceType || null,
      item.sourceId || null,
      Math.max(0, Math.min(1, item.importanceScore || 0.5)),
      now, now
    );
    createdIds.push(id);
  }

  return success(c, { ids: createdIds, created: createdIds.length }, 201);
});

// PATCH /memories/:userId/:memoryId - Update a memory
memories.patch('/:userId/:memoryId', async (c) => {
  const userId = c.req.param('userId');
  const memoryId = c.req.param('memoryId');
  if (!userId || !memoryId) return badRequest(c, 'userId and memoryId are required');

  const body = await c.req.json().catch(() => ({}));
  const { content, category, importanceScore, isActive } = body as {
    content?: string;
    category?: string;
    importanceScore?: number;
    isActive?: boolean;
  };

  const db = c.env.DB;
  const now = new Date().toISOString();

  // Check ownership
  const existing = await queryOne<UserMemory>(
    db,
    `SELECT id FROM user_memories WHERE id = ? AND user_id = ?`,
    memoryId, userId
  );

  if (!existing) return notFound(c, 'Memory not found');

  // Build update query dynamically
  const updates: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  if (content !== undefined) {
    if (content.length > 10000) return badRequest(c, 'Content too large');
    updates.push('content = ?');
    params.push(content);
  }
  if (category !== undefined) {
    updates.push('category = ?');
    params.push(category);
  }
  if (importanceScore !== undefined) {
    updates.push('importance_score = ?');
    params.push(Math.max(0, Math.min(1, importanceScore)));
  }
  if (isActive !== undefined) {
    updates.push('is_active = ?');
    params.push(isActive ? 1 : 0);
  }

  params.push(memoryId);

  await execute(
    db,
    `UPDATE user_memories SET ${updates.join(', ')} WHERE id = ?`,
    ...params
  );

  return success(c, { updated: true });
});

// DELETE /memories/:userId/:memoryId - Soft delete a memory
memories.delete('/:userId/:memoryId', async (c) => {
  const userId = c.req.param('userId');
  const memoryId = c.req.param('memoryId');
  if (!userId || !memoryId) return badRequest(c, 'userId and memoryId are required');

  const db = c.env.DB;
  const now = new Date().toISOString();

  const result = await execute(
    db,
    `UPDATE user_memories SET is_active = 0, updated_at = ? WHERE id = ? AND user_id = ?`,
    now, memoryId, userId
  );

  if (result.meta?.changes === 0) return notFound(c, 'Memory not found');

  return success(c, { deleted: true });
});

// POST /memories/:userId/access/:memoryId - Record memory access (for ranking)
memories.post('/:userId/access/:memoryId', async (c) => {
  const userId = c.req.param('userId');
  const memoryId = c.req.param('memoryId');
  if (!userId || !memoryId) return badRequest(c, 'userId and memoryId are required');

  const db = c.env.DB;
  const now = new Date().toISOString();

  await execute(
    db,
    `UPDATE user_memories
     SET access_count = access_count + 1, last_accessed_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    now, now, memoryId, userId
  );

  return success(c, { recorded: true });
});

// ========================================
// CHAT SESSION ENDPOINTS
// ========================================

// GET /memories/:userId/sessions - Get all chat sessions for a user
memories.get('/:userId/sessions', async (c) => {
  const userId = c.req.param('userId');
  if (!userId) return badRequest(c, 'userId is required');

  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');
  const includeArchived = c.req.query('includeArchived') === 'true';

  const db = c.env.DB;

  let query = `
    SELECT id, user_id, title, summary, question_mode, article_slug,
           message_count, total_tokens, is_archived, last_message_at, created_at, updated_at
    FROM chat_sessions
    WHERE user_id = ? AND is_deleted = 0
  `;
  const params: any[] = [userId];

  if (!includeArchived) {
    query += ` AND is_archived = 0`;
  }

  query += ` ORDER BY last_message_at DESC NULLS LAST, created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const sessions = await queryAll<ChatSession>(db, query, ...params);

  return success(c, {
    sessions: sessions.map(s => ({
      id: s.id,
      userId: s.user_id,
      title: s.title,
      summary: s.summary,
      questionMode: s.question_mode,
      articleSlug: s.article_slug,
      messageCount: s.message_count,
      totalTokens: s.total_tokens,
      isArchived: Boolean(s.is_archived),
      lastMessageAt: s.last_message_at,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    })),
  });
});

// POST /memories/:userId/sessions - Create a new chat session
memories.post('/:userId/sessions', async (c) => {
  const userId = c.req.param('userId');
  if (!userId) return badRequest(c, 'userId is required');

  const body = await c.req.json().catch(() => ({}));
  const { title, questionMode = 'general', articleSlug } = body as {
    title?: string;
    questionMode?: string;
    articleSlug?: string;
  };

  const db = c.env.DB;
  const now = new Date().toISOString();
  const id = `chat-${crypto.randomUUID()}`;

  await execute(
    db,
    `INSERT INTO chat_sessions
     (id, user_id, title, question_mode, article_slug, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id, userId, title || null, questionMode, articleSlug || null, now, now
  );

  return success(c, { id, created: true }, 201);
});

// GET /memories/:userId/sessions/:sessionId - Get a chat session with messages
memories.get('/:userId/sessions/:sessionId', async (c) => {
  const userId = c.req.param('userId');
  const sessionId = c.req.param('sessionId');
  if (!userId || !sessionId) return badRequest(c, 'userId and sessionId are required');

  const limit = Math.min(parseInt(c.req.query('limit') || '100'), 200);

  const db = c.env.DB;

  const session = await queryOne<ChatSession>(
    db,
    `SELECT * FROM chat_sessions WHERE id = ? AND user_id = ? AND is_deleted = 0`,
    sessionId, userId
  );

  if (!session) return notFound(c, 'Session not found');

  const messages = await queryAll<ChatMessage>(
    db,
    `SELECT id, session_id, user_id, role, content, content_type, metadata, created_at
     FROM chat_messages
     WHERE session_id = ?
     ORDER BY created_at ASC
     LIMIT ?`,
    sessionId, limit
  );

  return success(c, {
    session: {
      id: session.id,
      userId: session.user_id,
      title: session.title,
      summary: session.summary,
      questionMode: session.question_mode,
      articleSlug: session.article_slug,
      messageCount: session.message_count,
      totalTokens: session.total_tokens,
      isArchived: Boolean(session.is_archived),
      lastMessageAt: session.last_message_at,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    },
    messages: messages.map(m => ({
      id: m.id,
      sessionId: m.session_id,
      role: m.role,
      content: m.content,
      contentType: m.content_type,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
      createdAt: m.created_at,
    })),
  });
});

// POST /memories/:userId/sessions/:sessionId/messages - Add message to session
memories.post('/:userId/sessions/:sessionId/messages', async (c) => {
  const userId = c.req.param('userId');
  const sessionId = c.req.param('sessionId');
  if (!userId || !sessionId) return badRequest(c, 'userId and sessionId are required');

  const body = await c.req.json().catch(() => ({}));
  const { role, content, contentType = 'text', metadata } = body as {
    role: string;
    content: string;
    contentType?: string;
    metadata?: Record<string, any>;
  };

  if (!role || !content) return badRequest(c, 'role and content are required');
  if (!['user', 'assistant', 'system'].includes(role)) {
    return badRequest(c, 'Invalid role');
  }
  if (content.length > 50000) return badRequest(c, 'Content too large (max 50KB)');

  const db = c.env.DB;
  const now = new Date().toISOString();

  // Verify session ownership
  const session = await queryOne<ChatSession>(
    db,
    `SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? AND is_deleted = 0`,
    sessionId, userId
  );

  if (!session) return notFound(c, 'Session not found');

  const msgId = `msg-${crypto.randomUUID()}`;

  await execute(
    db,
    `INSERT INTO chat_messages (id, session_id, user_id, role, content, content_type, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    msgId, sessionId, userId, role, content, contentType,
    metadata ? JSON.stringify(metadata) : null, now
  );

  // Update session stats
  await execute(
    db,
    `UPDATE chat_sessions
     SET message_count = message_count + 1,
         last_message_at = ?,
         updated_at = ?
     WHERE id = ?`,
    now, now, sessionId
  );

  return success(c, { id: msgId, created: true }, 201);
});

// POST /memories/:userId/sessions/:sessionId/messages/batch - Add multiple messages
memories.post('/:userId/sessions/:sessionId/messages/batch', async (c) => {
  const userId = c.req.param('userId');
  const sessionId = c.req.param('sessionId');
  if (!userId || !sessionId) return badRequest(c, 'userId and sessionId are required');

  const body = await c.req.json().catch(() => ({}));
  const { messages: msgItems } = body as {
    messages: Array<{
      role: string;
      content: string;
      contentType?: string;
      metadata?: Record<string, any>;
    }>;
  };

  if (!Array.isArray(msgItems) || msgItems.length === 0) {
    return badRequest(c, 'messages array is required');
  }
  if (msgItems.length > 50) {
    return badRequest(c, 'Maximum 50 messages per batch');
  }

  const db = c.env.DB;
  const now = new Date().toISOString();

  // Verify session ownership
  const session = await queryOne<ChatSession>(
    db,
    `SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? AND is_deleted = 0`,
    sessionId, userId
  );

  if (!session) return notFound(c, 'Session not found');

  const createdIds: string[] = [];

  for (const msg of msgItems) {
    if (!msg.role || !msg.content) continue;
    if (!['user', 'assistant', 'system'].includes(msg.role)) continue;
    if (msg.content.length > 50000) continue;

    const msgId = `msg-${crypto.randomUUID()}`;
    await execute(
      db,
      `INSERT INTO chat_messages (id, session_id, user_id, role, content, content_type, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      msgId, sessionId, userId, msg.role, msg.content,
      msg.contentType || 'text',
      msg.metadata ? JSON.stringify(msg.metadata) : null, now
    );
    createdIds.push(msgId);
  }

  // Update session stats
  await execute(
    db,
    `UPDATE chat_sessions
     SET message_count = message_count + ?,
         last_message_at = ?,
         updated_at = ?
     WHERE id = ?`,
    createdIds.length, now, now, sessionId
  );

  return success(c, { ids: createdIds, created: createdIds.length }, 201);
});

// PATCH /memories/:userId/sessions/:sessionId - Update session (title, summary, archive)
memories.patch('/:userId/sessions/:sessionId', async (c) => {
  const userId = c.req.param('userId');
  const sessionId = c.req.param('sessionId');
  if (!userId || !sessionId) return badRequest(c, 'userId and sessionId are required');

  const body = await c.req.json().catch(() => ({}));
  const { title, summary, isArchived } = body as {
    title?: string;
    summary?: string;
    isArchived?: boolean;
  };

  const db = c.env.DB;
  const now = new Date().toISOString();

  // Check ownership
  const existing = await queryOne<ChatSession>(
    db,
    `SELECT id FROM chat_sessions WHERE id = ? AND user_id = ? AND is_deleted = 0`,
    sessionId, userId
  );

  if (!existing) return notFound(c, 'Session not found');

  const updates: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(title);
  }
  if (summary !== undefined) {
    updates.push('summary = ?');
    params.push(summary);
  }
  if (isArchived !== undefined) {
    updates.push('is_archived = ?');
    params.push(isArchived ? 1 : 0);
  }

  params.push(sessionId);

  await execute(
    db,
    `UPDATE chat_sessions SET ${updates.join(', ')} WHERE id = ?`,
    ...params
  );

  return success(c, { updated: true });
});

// DELETE /memories/:userId/sessions/:sessionId - Soft delete session
memories.delete('/:userId/sessions/:sessionId', async (c) => {
  const userId = c.req.param('userId');
  const sessionId = c.req.param('sessionId');
  if (!userId || !sessionId) return badRequest(c, 'userId and sessionId are required');

  const db = c.env.DB;
  const now = new Date().toISOString();

  const result = await execute(
    db,
    `UPDATE chat_sessions SET is_deleted = 1, updated_at = ? WHERE id = ? AND user_id = ?`,
    now, sessionId, userId
  );

  if (result.meta?.changes === 0) return notFound(c, 'Session not found');

  return success(c, { deleted: true });
});

// ========================================
// CONTEXT RETRIEVAL (for chat integration)
// ========================================

// GET /memories/:userId/context - Get relevant memories for chat context
memories.get('/:userId/context', async (c) => {
  const userId = c.req.param('userId');
  if (!userId) return badRequest(c, 'userId is required');

  const maxTokens = Math.min(parseInt(c.req.query('maxTokens') || '2000'), 4000);
  const categories = c.req.query('categories')?.split(',').filter(Boolean);

  const db = c.env.DB;
  const now = new Date().toISOString();

  // Get active, non-expired memories sorted by importance and recency
  let query = `
    SELECT id, memory_type, category, content, importance_score, access_count
    FROM user_memories
    WHERE user_id = ? AND is_active = 1
      AND (expires_at IS NULL OR expires_at > ?)
  `;
  const params: any[] = [userId, now];

  if (categories && categories.length > 0) {
    query += ` AND category IN (${categories.map(() => '?').join(',')})`;
    params.push(...categories);
  }

  query += ` ORDER BY importance_score DESC, access_count DESC, created_at DESC LIMIT 50`;

  const items = await queryAll<UserMemory>(db, query, ...params);

  // Build context string with token budget
  const contextParts: string[] = [];
  let currentTokens = 0;
  const CHARS_PER_TOKEN = 4; // rough estimate

  for (const mem of items) {
    const memText = `[${mem.memory_type}${mem.category ? '/' + mem.category : ''}] ${mem.content}`;
    const memTokens = Math.ceil(memText.length / CHARS_PER_TOKEN);

    if (currentTokens + memTokens > maxTokens) break;

    contextParts.push(memText);
    currentTokens += memTokens;

    // Record access asynchronously (fire and forget)
    execute(
      db,
      `UPDATE user_memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?`,
      now, mem.id
    ).catch(() => {});
  }

  return success(c, {
    context: contextParts.join('\n'),
    memoryCount: contextParts.length,
    estimatedTokens: currentTokens,
  });
});

export default memories;
