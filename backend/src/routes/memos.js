import { Router } from 'express';
import crypto from 'crypto';
import { queryAll, queryOne, execute, isD1Configured } from '../lib/d1.js';
import { requireUserAuth, requireUserOwnership } from '../middleware/userAuth.js';

const router = Router();

const requireDb = (req, res, next) => {
  if (!isD1Configured()) {
    return res.status(503).json({ ok: false, error: 'Database not configured' });
  }
  next();
};

function clampInt(v, def, min, max) {
  const n = parseInt(String(v ?? ''), 10);
  if (Number.isNaN(n)) return def;
  return Math.max(min, Math.min(max, n));
}

async function ensureMemoRow(userId) {
  const existing = await queryOne(`SELECT * FROM memo_content WHERE user_id = ?`, userId);
  if (existing) return existing;

  const id = `memo-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO memo_content (id, user_id, content, version, created_at, updated_at)
     VALUES (?, ?, '', 1, ?, ?)` ,
    id,
    userId,
    now,
    now
  );
  return queryOne(`SELECT * FROM memo_content WHERE user_id = ?`, userId);
}

router.get('/:userId', requireDb, requireUserAuth, requireUserOwnership('userId'), async (req, res, next) => {
  try {
    const userId = req.userId;

    const row = await ensureMemoRow(userId);

    return res.json({
      ok: true,
      data: {
        memo: {
          id: row?.id ?? null,
          userId,
          content: row?.content ?? '',
          version: row?.version ?? 1,
          createdAt: row?.created_at ?? null,
          updatedAt: row?.updated_at ?? null,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.put('/:userId', requireDb, requireUserAuth, requireUserOwnership('userId'), async (req, res, next) => {
  try {
    const userId = req.userId;

    const { content, createVersion = false, changeSummary } = req.body || {};
    const newContent = String(content ?? '');

    const row = await ensureMemoRow(userId);
    const memoId = row?.id ?? `memo-${crypto.randomUUID()}`;
    const prevVersion = row?.version ?? 1;
    const nextVersion = prevVersion + 1;
    const now = new Date().toISOString();

    // Save version snapshot if requested
    if (createVersion) {
      await execute(
        `INSERT INTO memo_versions (memo_id, user_id, version, content, content_length, change_summary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)` ,
        memoId,
        userId,
        nextVersion,
        newContent,
        newContent.length,
        changeSummary ? String(changeSummary).slice(0, 400) : null,
        now
      );
    }

    await execute(
      `UPDATE memo_content
       SET content = ?, version = ?, updated_at = ?
       WHERE user_id = ?` ,
      newContent,
      nextVersion,
      now,
      userId
    );

    return res.json({ ok: true, data: { id: memoId, version: nextVersion } });
  } catch (err) {
    return next(err);
  }
});

router.get('/:userId/versions', requireDb, requireUserAuth, requireUserOwnership('userId'), async (req, res, next) => {
  try {
    const userId = req.userId;

    const limit = clampInt(req.query.limit, 20, 1, 50);
    const offset = clampInt(req.query.offset, 0, 0, 10000);

    const row = await ensureMemoRow(userId);
    const memoId = row?.id;

    const totalRow = await queryOne(
      `SELECT COUNT(*) as cnt FROM memo_versions WHERE user_id = ? AND memo_id = ?`,
      userId,
      memoId
    );

    const versions = await queryAll(
      `SELECT id, memo_id, version, content_length, change_summary, created_at
       FROM memo_versions
       WHERE user_id = ? AND memo_id = ?
       ORDER BY version DESC
       LIMIT ? OFFSET ?`,
      userId,
      memoId,
      limit,
      offset
    );

    return res.json({
      ok: true,
      data: {
        versions: versions.map((v) => ({
          id: v.id,
          memoId: v.memo_id,
          version: v.version,
          contentLength: v.content_length ?? 0,
          changeSummary: v.change_summary ?? null,
          createdAt: v.created_at,
        })),
        total: totalRow?.cnt ?? 0,
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/:userId/versions/:version', requireDb, requireUserAuth, requireUserOwnership('userId'), async (req, res, next) => {
  try {
    const userId = req.userId;
    const version = clampInt(req.params.version, 0, 1, 1_000_000);

    const row = await ensureMemoRow(userId);
    const memoId = row?.id;

    const v = await queryOne(
      `SELECT id, memo_id, version, content, content_length, change_summary, created_at
       FROM memo_versions
       WHERE user_id = ? AND memo_id = ? AND version = ?`,
      userId,
      memoId,
      version
    );

    if (!v) return res.status(404).json({ ok: false, error: { message: 'Version not found' } });

    return res.json({
      ok: true,
      data: {
        version: {
          id: v.id,
          memoId: v.memo_id,
          version: v.version,
          content: v.content,
          contentLength: v.content_length ?? (v.content ? String(v.content).length : 0),
          changeSummary: v.change_summary ?? null,
          createdAt: v.created_at,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/:userId/restore/:version', requireDb, requireUserAuth, requireUserOwnership('userId'), async (req, res, next) => {
  try {
    const userId = req.userId;
    const version = clampInt(req.params.version, 0, 1, 1_000_000);

    const row = await ensureMemoRow(userId);
    const memoId = row?.id;

    const v = await queryOne(
      `SELECT content FROM memo_versions WHERE user_id = ? AND memo_id = ? AND version = ?`,
      userId,
      memoId,
      version
    );

    if (!v) return res.status(404).json({ ok: false, error: { message: 'Version not found' } });

    const now = new Date().toISOString();
    const nextVersion = (row?.version ?? 1) + 1;

    await execute(
      `UPDATE memo_content SET content = ?, version = ?, updated_at = ? WHERE user_id = ?`,
      v.content,
      nextVersion,
      now,
      userId
    );

    return res.json({ ok: true, data: { id: memoId, version: nextVersion, restoredFrom: version } });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:userId', requireDb, requireUserAuth, requireUserOwnership('userId'), async (req, res, next) => {
  try {
    const userId = req.userId;

    const row = await queryOne(`SELECT id FROM memo_content WHERE user_id = ?`, userId);
    if (!row) return res.json({ ok: true });

    await execute(`DELETE FROM memo_versions WHERE memo_id = ? AND user_id = ?`, row.id, userId);
    await execute(`DELETE FROM memo_content WHERE user_id = ?`, userId);

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
