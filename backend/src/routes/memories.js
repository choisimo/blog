import { Router } from 'express';
import crypto from 'crypto';
import { queryAll, queryOne, execute, isD1Configured } from '../lib/d1.js';
import { requireUserAuth, requireUserOwnership } from '../middleware/userAuth.js';

const router = Router();

const requireDb = (req, res, next) => {
  if (!isD1Configured()) {
    return res.status(503).json({
      ok: false,
      error: 'Database not configured',
    });
  }
  next();
};

function clampInt(v, def, min, max) {
  const n = parseInt(String(v ?? ''), 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

router.get('/:userId', requireDb, requireUserAuth, requireUserOwnership('userId'), async (req, res, next) => {
  try {
    const userId = req.userId;

    const type = req.query.type ? String(req.query.type).trim().slice(0, 32) : null;
    const category = req.query.category ? String(req.query.category).trim().slice(0, 64) : null;
    const limit = clampInt(req.query.limit, 50, 1, 200);
    const offset = clampInt(req.query.offset, 0, 0, 10000);

    const where = ['user_id = ?', 'is_active = 1'];
    const params = [userId];
    if (type) {
      where.push('memory_type = ?');
      params.push(type);
    }
    if (category) {
      where.push('category = ?');
      params.push(category);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const totalRow = await queryOne(
      `SELECT COUNT(*) as cnt FROM user_memories ${whereSql}`,
      ...params
    );

    const items = await queryAll(
      `SELECT * FROM user_memories ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset
    );

    const memories = items.map((m) => ({
      id: m.id,
      userId: m.user_id,
      memoryType: m.memory_type,
      category: m.category || undefined,
      content: m.content,
      sourceType: m.source_type || undefined,
      sourceId: m.source_id || undefined,
      importanceScore: m.importance_score ?? 0.5,
      accessCount: m.access_count ?? 0,
      lastAccessedAt: m.last_accessed_at || undefined,
      expiresAt: m.expires_at || undefined,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));

    return res.json({
      ok: true,
      data: {
        memories,
        total: totalRow?.cnt ?? memories.length,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/:userId', requireDb, requireUserAuth, requireUserOwnership('userId'), async (req, res, next) => {
  try {
    const userId = req.userId;

    const body = req.body || {};
    const content = String(body.content || '').trim();
    if (!content) return res.status(400).json({ ok: false, error: 'content is required' });

    const id = `mem-${crypto.randomUUID()}`;
    const now = new Date().toISOString();

    await execute(
      `INSERT INTO user_memories (
        id, user_id, memory_type, category, content, source_type, source_id,
        importance_score, access_count, last_accessed_at, expires_at, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, 1, ?, ?)`,
      id,
      userId,
      String(body.memoryType || 'fact').trim().slice(0, 32),
      body.category ? String(body.category).trim().slice(0, 64) : null,
      content,
      body.sourceType ? String(body.sourceType).trim().slice(0, 32) : null,
      body.sourceId ? String(body.sourceId).trim().slice(0, 128) : null,
      typeof body.importanceScore === 'number' ? body.importanceScore : 0.5,
      body.expiresAt ? String(body.expiresAt).trim().slice(0, 64) : null,
      now,
      now
    );

    return res.status(201).json({ ok: true, data: { id } });
  } catch (err) {
    return next(err);
  }
});

router.post('/:userId/batch', requireDb, requireUserAuth, requireUserOwnership('userId'), async (req, res, next) => {
  try {
    const userId = req.userId;

    const memories = Array.isArray(req.body?.memories) ? req.body.memories : [];
    if (memories.length === 0) {
      return res.status(400).json({ ok: false, error: 'memories is required' });
    }

    const now = new Date().toISOString();
    const ids = [];

    for (const m of memories.slice(0, 200)) {
      const content = String(m?.content || '').trim();
      if (!content) continue;
      const id = `mem-${crypto.randomUUID()}`;
      ids.push(id);
      await execute(
        `INSERT INTO user_memories (
          id, user_id, memory_type, category, content, source_type, source_id,
          importance_score, access_count, last_accessed_at, expires_at, is_active,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL, 1, ?, ?)`,
        id,
        userId,
        String(m.memoryType || 'fact').trim().slice(0, 32),
        m.category ? String(m.category).trim().slice(0, 64) : null,
        content,
        m.sourceType ? String(m.sourceType).trim().slice(0, 32) : null,
        m.sourceId ? String(m.sourceId).trim().slice(0, 128) : null,
        typeof m.importanceScore === 'number' ? m.importanceScore : 0.5,
        now,
        now
      );
    }

    return res.status(201).json({ ok: true, data: { ids, created: ids.length } });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:userId/:memoryId', requireDb, requireUserAuth, requireUserOwnership('userId'), async (req, res, next) => {
  try {
    const userId = req.userId;
    const memoryId = String(req.params.memoryId || '').trim().slice(0, 128);
    if (!memoryId) return res.status(400).json({ ok: false, error: 'memoryId is required' });

    const existing = await queryOne(
      `SELECT id FROM user_memories WHERE id = ? AND user_id = ? AND is_active = 1`,
      memoryId,
      userId
    );

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Memory not found' });
    }

    await execute(
      `UPDATE user_memories SET is_active = 0, updated_at = ? WHERE id = ? AND user_id = ?`,
      new Date().toISOString(),
      memoryId,
      userId
    );

    return res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    return next(err);
  }
});

export default router;
