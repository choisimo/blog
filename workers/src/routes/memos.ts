import { Hono } from 'hono';
import type { Env } from '../types';
import { success, badRequest, notFound } from '../lib/response';
import { queryAll, execute, queryOne } from '../lib/d1';

const memos = new Hono<{ Bindings: Env }>();

// Types
interface MemoContent {
  id: string;
  user_id: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface MemoVersion {
  id: number;
  memo_id: string;
  user_id: string;
  version: number;
  content: string;
  content_length: number;
  change_summary: string | null;
  created_at: string;
}

// GET /memos/:userId - Get current memo content for a user
memos.get('/:userId', async (c) => {
  const userId = c.req.param('userId');
  if (!userId) {
    return badRequest(c, 'userId is required');
  }

  const db = c.env.DB;
  const memo = await queryOne<MemoContent>(
    db,
    `SELECT id, user_id, content, version, created_at, updated_at
     FROM memo_content
     WHERE user_id = ?
     LIMIT 1`,
    userId
  );

  if (!memo) {
    // Return empty memo if none exists
    return success(c, {
      memo: {
        id: null,
        userId,
        content: '',
        version: 0,
        createdAt: null,
        updatedAt: null,
      },
    });
  }

  return success(c, {
    memo: {
      id: memo.id,
      userId: memo.user_id,
      content: memo.content,
      version: memo.version,
      createdAt: memo.created_at,
      updatedAt: memo.updated_at,
    },
  });
});

// PUT /memos/:userId - Save memo content (creates version if significant change)
memos.put('/:userId', async (c) => {
  const userId = c.req.param('userId');
  if (!userId) {
    return badRequest(c, 'userId is required');
  }

  const body = await c.req.json().catch(() => ({}));
  const { content, createVersion = false, changeSummary } = body as {
    content: string;
    createVersion?: boolean;
    changeSummary?: string;
  };

  if (typeof content !== 'string') {
    return badRequest(c, 'content is required');
  }

  // Limit content size (100KB)
  if (content.length > 100000) {
    return badRequest(c, 'Content too large (max 100KB)');
  }

  const db = c.env.DB;
  const now = new Date().toISOString();

  // Check if memo exists
  const existing = await queryOne<MemoContent>(
    db,
    `SELECT id, version, content FROM memo_content WHERE user_id = ?`,
    userId
  );

  if (!existing) {
    // Create new memo
    const memoId = `memo-${crypto.randomUUID()}`;
    await execute(
      db,
      `INSERT INTO memo_content (id, user_id, content, version, created_at, updated_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      memoId,
      userId,
      content,
      now,
      now
    );

    // Create initial version
    await execute(
      db,
      `INSERT INTO memo_versions (memo_id, user_id, version, content, content_length, change_summary, created_at)
       VALUES (?, ?, 1, ?, ?, ?, ?)`,
      memoId,
      userId,
      content,
      content.length,
      'Initial save',
      now
    );

    return success(c, { id: memoId, version: 1 }, 201);
  }

  // Update existing memo
  const newVersion = createVersion ? existing.version + 1 : existing.version;

  await execute(
    db,
    `UPDATE memo_content SET content = ?, version = ?, updated_at = ? WHERE id = ?`,
    content,
    newVersion,
    now,
    existing.id
  );

  // Create version snapshot if requested
  if (createVersion) {
    await execute(
      db,
      `INSERT INTO memo_versions (memo_id, user_id, version, content, content_length, change_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      existing.id,
      userId,
      newVersion,
      content,
      content.length,
      changeSummary || null,
      now
    );

    // Keep only last 50 versions
    await execute(
      db,
      `DELETE FROM memo_versions
       WHERE memo_id = ? AND id NOT IN (
         SELECT id FROM memo_versions WHERE memo_id = ? ORDER BY version DESC LIMIT 50
       )`,
      existing.id,
      existing.id
    );
  }

  return success(c, { id: existing.id, version: newVersion });
});

// GET /memos/:userId/versions - Get version history for a user's memo
memos.get('/:userId/versions', async (c) => {
  const userId = c.req.param('userId');
  if (!userId) {
    return badRequest(c, 'userId is required');
  }

  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  const db = c.env.DB;

  // Get memo_id first
  const memo = await queryOne<MemoContent>(
    db,
    `SELECT id FROM memo_content WHERE user_id = ?`,
    userId
  );

  if (!memo) {
    return success(c, { versions: [], total: 0 });
  }

  // Get versions (without full content for list view)
  const versions = await queryAll<MemoVersion>(
    db,
    `SELECT id, memo_id, user_id, version, content_length, change_summary, created_at
     FROM memo_versions
     WHERE memo_id = ?
     ORDER BY version DESC
     LIMIT ? OFFSET ?`,
    memo.id,
    limit,
    offset
  );

  // Get total count
  const countResult = await queryOne<{ count: number }>(
    db,
    `SELECT COUNT(*) as count FROM memo_versions WHERE memo_id = ?`,
    memo.id
  );

  return success(c, {
    versions: versions.map((v) => ({
      id: v.id,
      memoId: v.memo_id,
      version: v.version,
      contentLength: v.content_length,
      changeSummary: v.change_summary,
      createdAt: v.created_at,
    })),
    total: countResult?.count || 0,
  });
});

// GET /memos/:userId/versions/:version - Get specific version content
memos.get('/:userId/versions/:version', async (c) => {
  const userId = c.req.param('userId');
  const versionStr = c.req.param('version');

  if (!userId || !versionStr) {
    return badRequest(c, 'userId and version are required');
  }

  const version = parseInt(versionStr);
  if (isNaN(version)) {
    return badRequest(c, 'Invalid version number');
  }

  const db = c.env.DB;

  // Get memo_id first
  const memo = await queryOne<MemoContent>(
    db,
    `SELECT id FROM memo_content WHERE user_id = ?`,
    userId
  );

  if (!memo) {
    return notFound(c, 'Memo not found');
  }

  const versionData = await queryOne<MemoVersion>(
    db,
    `SELECT id, memo_id, user_id, version, content, content_length, change_summary, created_at
     FROM memo_versions
     WHERE memo_id = ? AND version = ?`,
    memo.id,
    version
  );

  if (!versionData) {
    return notFound(c, 'Version not found');
  }

  return success(c, {
    version: {
      id: versionData.id,
      memoId: versionData.memo_id,
      version: versionData.version,
      content: versionData.content,
      contentLength: versionData.content_length,
      changeSummary: versionData.change_summary,
      createdAt: versionData.created_at,
    },
  });
});

// POST /memos/:userId/restore/:version - Restore a specific version
memos.post('/:userId/restore/:version', async (c) => {
  const userId = c.req.param('userId');
  const versionStr = c.req.param('version');

  if (!userId || !versionStr) {
    return badRequest(c, 'userId and version are required');
  }

  const version = parseInt(versionStr);
  if (isNaN(version)) {
    return badRequest(c, 'Invalid version number');
  }

  const db = c.env.DB;
  const now = new Date().toISOString();

  // Get memo_id first
  const memo = await queryOne<MemoContent>(
    db,
    `SELECT id, version FROM memo_content WHERE user_id = ?`,
    userId
  );

  if (!memo) {
    return notFound(c, 'Memo not found');
  }

  // Get the version to restore
  const versionData = await queryOne<MemoVersion>(
    db,
    `SELECT content FROM memo_versions WHERE memo_id = ? AND version = ?`,
    memo.id,
    version
  );

  if (!versionData) {
    return notFound(c, 'Version not found');
  }

  // Create new version with restored content
  const newVersion = memo.version + 1;

  await execute(
    db,
    `UPDATE memo_content SET content = ?, version = ?, updated_at = ? WHERE id = ?`,
    versionData.content,
    newVersion,
    now,
    memo.id
  );

  // Save version snapshot
  await execute(
    db,
    `INSERT INTO memo_versions (memo_id, user_id, version, content, content_length, change_summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    memo.id,
    userId,
    newVersion,
    versionData.content,
    versionData.content.length,
    `Restored from version ${version}`,
    now
  );

  return success(c, {
    id: memo.id,
    version: newVersion,
    restoredFrom: version,
  });
});

// DELETE /memos/:userId - Delete memo and all versions
memos.delete('/:userId', async (c) => {
  const userId = c.req.param('userId');
  if (!userId) {
    return badRequest(c, 'userId is required');
  }

  const db = c.env.DB;

  const memo = await queryOne<MemoContent>(
    db,
    `SELECT id FROM memo_content WHERE user_id = ?`,
    userId
  );

  if (!memo) {
    return notFound(c, 'Memo not found');
  }

  // Delete versions first (cascade should handle this, but being explicit)
  await execute(db, `DELETE FROM memo_versions WHERE memo_id = ?`, memo.id);
  await execute(db, `DELETE FROM memo_content WHERE id = ?`, memo.id);

  return success(c, { deleted: true });
});

export default memos;
