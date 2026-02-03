import { Router } from 'express';
import { queryAll, queryOne, execute, isD1Configured } from '../lib/d1.js';
import { requireUserAuth } from '../middleware/userAuth.js';
import crypto from 'crypto';

const router = Router();

const requireD1 = (req, res, next) => {
  if (!isD1Configured()) {
    return res.status(503).json({
      ok: false,
      error: 'User content service not configured (D1 credentials missing)',
    });
  }
  next();
};

// ============================================================================
// PERSONAS API - /api/personas
// ============================================================================

/**
 * GET /api/personas
 * List all personas for the authenticated user
 */
router.get('/personas', requireD1, requireUserAuth, async (req, res, next) => {
  try {
    const cursor = req.query.cursor;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    let sql = `SELECT * FROM personas WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`;
    const params = [req.userId, limit + 1];

    if (cursor) {
      sql = `SELECT * FROM personas WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`;
      params.splice(1, 0, cursor);
    }

    const items = await queryAll(sql, ...params);
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    // Parse tags from JSON string
    const personas = data.map((p) => ({
      id: p.id,
      name: p.name,
      prompt: p.prompt,
      tags: p.tags ? JSON.parse(p.tags) : [],
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return res.json({
      ok: true,
      data: personas,
      cursor: hasMore ? data[data.length - 1]?.created_at : undefined,
      hasMore,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/personas
 * Create a new persona
 */
router.post('/personas', requireD1, requireUserAuth, async (req, res, next) => {
  try {
    const { name, prompt, tags } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, error: 'name is required' });
    }
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ ok: false, error: 'prompt is required' });
    }

    const id = `persona-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);

    await execute(
      `INSERT INTO personas (id, user_id, name, prompt, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      req.userId,
      name.trim().slice(0, 128),
      prompt.trim().slice(0, 4000),
      tagsJson,
      now,
      now
    );

    return res.status(201).json({
      ok: true,
      data: {
        id,
        name: name.trim().slice(0, 128),
        prompt: prompt.trim().slice(0, 4000),
        tags: Array.isArray(tags) ? tags : [],
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PUT /api/personas/:id
 * Update a persona
 */
router.put('/personas/:id', requireD1, requireUserAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, prompt, tags } = req.body || {};

    // Check ownership
    const existing = await queryOne(
      `SELECT * FROM personas WHERE id = ? AND user_id = ?`,
      id,
      req.userId
    );

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Persona not found' });
    }

    // ETag check for optimistic concurrency
    const ifMatch = req.headers['if-match'];
    if (ifMatch && ifMatch !== existing.updated_at) {
      return res.status(412).json({ ok: false, error: 'Precondition failed - resource was modified' });
    }

    const now = new Date().toISOString();
    const newName = name ? name.trim().slice(0, 128) : existing.name;
    const newPrompt = prompt ? prompt.trim().slice(0, 4000) : existing.prompt;
    const newTags = tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : existing.tags;

    await execute(
      `UPDATE personas SET name = ?, prompt = ?, tags = ?, updated_at = ? WHERE id = ?`,
      newName,
      newPrompt,
      newTags,
      now,
      id
    );

    return res.json({
      ok: true,
      data: {
        id,
        name: newName,
        prompt: newPrompt,
        tags: JSON.parse(newTags),
        createdAt: existing.created_at,
        updatedAt: now,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/personas/:id
 * Delete a persona
 */
router.delete('/personas/:id', requireD1, requireUserAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existing = await queryOne(
      `SELECT * FROM personas WHERE id = ? AND user_id = ?`,
      id,
      req.userId
    );

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Persona not found' });
    }

    await execute(`DELETE FROM personas WHERE id = ?`, id);

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

// ============================================================================
// MEMOS API - /api/memos
// ============================================================================

/**
 * GET /api/memos
 * List all memos for the authenticated user
 */
router.get('/memos', requireD1, requireUserAuth, async (req, res, next) => {
  try {
    const cursor = req.query.cursor;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    let sql = `SELECT * FROM memos WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`;
    const params = [req.userId, limit + 1];

    if (cursor) {
      sql = `SELECT * FROM memos WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?`;
      params.splice(1, 0, cursor);
    }

    const items = await queryAll(sql, ...params);
    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;

    // Parse JSON fields
    const memos = data.map((m) => ({
      id: m.id,
      originalContent: m.original_content,
      userNote: m.user_note,
      tags: m.tags ? JSON.parse(m.tags) : [],
      source: m.source ? JSON.parse(m.source) : null,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));

    return res.json({
      ok: true,
      data: memos,
      cursor: hasMore ? data[data.length - 1]?.created_at : undefined,
      hasMore,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/memos
 * Create a new memo
 */
router.post('/memos', requireD1, requireUserAuth, async (req, res, next) => {
  try {
    const { originalContent, userNote, tags, source } = req.body || {};

    if (!originalContent || typeof originalContent !== 'string') {
      return res.status(400).json({ ok: false, error: 'originalContent is required' });
    }

    const id = `memo-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const tagsJson = JSON.stringify(Array.isArray(tags) ? tags : []);
    const sourceJson = source ? JSON.stringify(source) : null;

    await execute(
      `INSERT INTO memos (id, user_id, original_content, user_note, tags, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      req.userId,
      originalContent.trim().slice(0, 10000),
      userNote ? userNote.trim().slice(0, 4000) : null,
      tagsJson,
      sourceJson,
      now,
      now
    );

    return res.status(201).json({
      ok: true,
      data: {
        id,
        originalContent: originalContent.trim().slice(0, 10000),
        userNote: userNote ? userNote.trim().slice(0, 4000) : null,
        tags: Array.isArray(tags) ? tags : [],
        source: source || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * PUT /api/memos/:id
 * Update a memo
 */
router.put('/memos/:id', requireD1, requireUserAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { originalContent, userNote, tags, source } = req.body || {};

    // Check ownership
    const existing = await queryOne(
      `SELECT * FROM memos WHERE id = ? AND user_id = ?`,
      id,
      req.userId
    );

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Memo not found' });
    }

    // ETag check for optimistic concurrency
    const ifMatch = req.headers['if-match'];
    if (ifMatch && ifMatch !== existing.updated_at) {
      return res.status(412).json({ ok: false, error: 'Precondition failed - resource was modified' });
    }

    const now = new Date().toISOString();
    const newContent = originalContent ? originalContent.trim().slice(0, 10000) : existing.original_content;
    const newNote = userNote !== undefined ? (userNote ? userNote.trim().slice(0, 4000) : null) : existing.user_note;
    const newTags = tags !== undefined ? JSON.stringify(Array.isArray(tags) ? tags : []) : existing.tags;
    const newSource = source !== undefined ? (source ? JSON.stringify(source) : null) : existing.source;

    await execute(
      `UPDATE memos SET original_content = ?, user_note = ?, tags = ?, source = ?, updated_at = ? WHERE id = ?`,
      newContent,
      newNote,
      newTags,
      newSource,
      now,
      id
    );

    return res.json({
      ok: true,
      data: {
        id,
        originalContent: newContent,
        userNote: newNote,
        tags: JSON.parse(newTags),
        source: newSource ? JSON.parse(newSource) : null,
        createdAt: existing.created_at,
        updatedAt: now,
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * DELETE /api/memos/:id
 * Delete a memo
 */
router.delete('/memos/:id', requireD1, requireUserAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check ownership
    const existing = await queryOne(
      `SELECT * FROM memos WHERE id = ? AND user_id = ?`,
      id,
      req.userId
    );

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Memo not found' });
    }

    await execute(`DELETE FROM memos WHERE id = ?`, id);

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
