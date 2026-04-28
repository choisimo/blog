import { Hono } from 'hono';
import type { HonoEnv, Env } from '../types';
import { success, badRequest, notFound, unauthorized, forbidden, conflict } from '../lib/response';
import { queryAll, execute, executeBatch, queryOne } from '../lib/d1';
import { getUserIdFromToken } from '../lib/auth-helpers';

const memos = new Hono<HonoEnv>();

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

type SaveMemoBody = {
  content: string;
  createVersion?: boolean;
  changeSummary?: string;
  expectedVersion?: number;
};

function getExpectedVersion(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return null;
  }
  return value;
}

async function createInitialMemo(
  db: D1Database,
  userId: string,
  content: string,
  now: string
): Promise<string> {
  const memoId = `memo-${crypto.randomUUID()}`;
  await executeBatch(db, [
    db
      .prepare(
        `INSERT INTO memo_content (id, user_id, content, version, created_at, updated_at)
         VALUES (?, ?, ?, 1, ?, ?)`
      )
      .bind(memoId, userId, content, now, now),
    db
      .prepare(
        `INSERT INTO memo_versions (memo_id, user_id, version, content, content_length, change_summary, created_at)
         VALUES (?, ?, 1, ?, ?, ?, ?)`
      )
      .bind(memoId, userId, content, content.length, 'Initial save', now),
  ]);
  return memoId;
}

async function updateMemoContent(
  db: D1Database,
  options: {
    memoId: string;
    userId: string;
    content: string;
    expectedVersion: number;
    newVersion: number;
    now: string;
    createVersion: boolean;
    snapshotVersion?: number;
    snapshotContent?: string;
    changeSummary?: string | null;
  }
): Promise<boolean> {
  const updateStatement = db
    .prepare(`UPDATE memo_content SET content = ?, version = ?, updated_at = ? WHERE id = ? AND version = ?`)
    .bind(options.content, options.newVersion, options.now, options.memoId, options.expectedVersion);

  if (!options.createVersion) {
    const result = await updateStatement.run();
    return (result.meta?.changes || 0) > 0;
  }

  const results = await executeBatch(db, [
    updateStatement,
    db
      .prepare(
        `INSERT INTO memo_versions (memo_id, user_id, version, content, content_length, change_summary, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM memo_content WHERE id = ? AND version = ? AND updated_at = ?
         ) AND NOT EXISTS (
           SELECT 1 FROM memo_versions WHERE memo_id = ? AND version = ?
         )`
      )
      .bind(
        options.memoId,
        options.userId,
        options.snapshotVersion ?? options.expectedVersion,
        options.snapshotContent ?? '',
        (options.snapshotContent ?? '').length,
        options.changeSummary || null,
        options.now,
        options.memoId,
        options.newVersion,
        options.now,
        options.memoId,
        options.snapshotVersion ?? options.expectedVersion
      ),
  ]);

  return (results[0]?.meta?.changes || 0) > 0;
}

async function pruneMemoVersions(db: D1Database, memoId: string): Promise<void> {
  await execute(
    db,
    `DELETE FROM memo_versions
     WHERE memo_id = ? AND id NOT IN (
       SELECT id FROM memo_versions WHERE memo_id = ? ORDER BY version DESC LIMIT 50
     )`,
    memoId,
    memoId
  );
}

async function saveMemoForUser(c: any, userId: string) {
  const body = (await c.req.json().catch(() => ({}))) as SaveMemoBody;
  const { content, createVersion = false, changeSummary } = body;

  if (typeof content !== 'string') {
    return badRequest(c, 'content is required');
  }

  if (content.length > 100000) {
    return badRequest(c, 'Content too large (max 100KB)');
  }

  const db = c.env.DB;
  const now = new Date().toISOString();

  const existing = await queryOne<MemoContent>(
    db,
    `SELECT id, version, content FROM memo_content WHERE user_id = ?`,
    userId
  );

  if (!existing) {
    const expectedVersion = body.expectedVersion === undefined ? 0 : getExpectedVersion(body.expectedVersion);
    if (expectedVersion !== 0) {
      return conflict(c, 'Memo version conflict');
    }

    try {
      const memoId = await createInitialMemo(db, userId, content, now);
      return success(c, { id: memoId, version: 1 }, 201);
    } catch (err) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return conflict(c, 'Memo version conflict');
      }
      throw err;
    }
  }

  const expectedVersion = getExpectedVersion(body.expectedVersion);
  if (expectedVersion === null) {
    return badRequest(c, 'expectedVersion is required');
  }
  if (expectedVersion !== existing.version) {
    return conflict(c, 'Memo version conflict');
  }

  const newVersion = createVersion ? existing.version + 1 : existing.version;
  const updated = await updateMemoContent(db, {
    memoId: existing.id,
    userId,
    content,
    expectedVersion,
    newVersion,
    now,
    createVersion,
    snapshotVersion: existing.version,
    snapshotContent: existing.content,
    changeSummary,
  });

  if (!updated) {
    return conflict(c, 'Memo version conflict');
  }

  if (createVersion) {
    await pruneMemoVersions(db, existing.id);
  }

  return success(c, { id: existing.id, version: newVersion });
}

async function restoreMemoVersionForUser(c: any, userId: string, version: number) {
  const body = (await c.req.json().catch(() => ({}))) as { expectedVersion?: number };
  const db = c.env.DB;
  const now = new Date().toISOString();

  const memo = await queryOne<MemoContent>(
    db,
    `SELECT id, version, content FROM memo_content WHERE user_id = ?`,
    userId
  );

  if (!memo) {
    return notFound(c, 'Memo not found');
  }

  const expectedVersion =
    body.expectedVersion === undefined ? memo.version : getExpectedVersion(body.expectedVersion);
  if (expectedVersion === null || expectedVersion !== memo.version) {
    return conflict(c, 'Memo version conflict');
  }

  const versionData = await queryOne<MemoVersion>(
    db,
    `SELECT content FROM memo_versions WHERE memo_id = ? AND version = ?`,
    memo.id,
    version
  );

  if (!versionData) {
    return notFound(c, 'Version not found');
  }

  const newVersion = memo.version + 1;
  const updated = await updateMemoContent(db, {
    memoId: memo.id,
    userId,
    content: versionData.content,
    expectedVersion,
    newVersion,
    now,
    createVersion: true,
    snapshotVersion: memo.version,
    snapshotContent: memo.content,
    changeSummary: `Restored from version ${version}`,
  });

  if (!updated) {
    return conflict(c, 'Memo version conflict');
  }

  return success(c, {
    id: memo.id,
    version: newVersion,
    restoredFrom: version,
  });
}


// ============================================================================
// JWT-based routes (no userId in path)
// These routes extract userId from the JWT token
// ============================================================================

// GET /memos - Get current memo content for authenticated user
memos.get('/', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
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

// PUT /memos - Save memo content for authenticated user
memos.put('/', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
  }
  return saveMemoForUser(c, userId);
});

// GET /memos/versions - Get version history for authenticated user
memos.get('/versions', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
  }

  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 50);
  const offset = parseInt(c.req.query('offset') || '0');

  const db = c.env.DB;

  const memo = await queryOne<MemoContent>(
    db,
    `SELECT id FROM memo_content WHERE user_id = ?`,
    userId
  );

  if (!memo) {
    return success(c, { versions: [], total: 0 });
  }

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

// GET /memos/versions/:version - Get specific version for authenticated user
memos.get('/versions/:version', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
  }

  const versionStr = c.req.param('version');
  const version = parseInt(versionStr);
  if (isNaN(version)) {
    return badRequest(c, 'Invalid version number');
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

// POST /memos/restore/:version - Restore a specific version for authenticated user
memos.post('/restore/:version', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
  }

  const versionStr = c.req.param('version');
  const version = parseInt(versionStr);
  if (isNaN(version)) {
    return badRequest(c, 'Invalid version number');
  }
  return restoreMemoVersionForUser(c, userId, version);
});

// DELETE /memos - Delete memo for authenticated user
memos.delete('/', async (c) => {
  const userId = await getUserIdFromToken(c);
  if (!userId) {
    return unauthorized(c, 'Authentication required');
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

  await execute(db, `DELETE FROM memo_versions WHERE memo_id = ?`, memo.id);
  await execute(db, `DELETE FROM memo_content WHERE id = ?`, memo.id);

  return success(c, { deleted: true });
});

// ============================================================================
// Legacy routes with userId in path (for backward compatibility)
// ============================================================================

async function requireOwnerFromPath(c: any): Promise<string | Response> {
  const userId = await getUserIdFromToken(c);
  if (!userId) return unauthorized(c, 'Authentication required');
  const paramUserId = c.req.param('userId');
  if (userId !== paramUserId) return forbidden(c, 'User ID mismatch');
  return userId;
}

// GET /memos/:userId - Get current memo content for a user
memos.get('/:userId', async (c) => {
  const result = await requireOwnerFromPath(c);
  if (result instanceof Response) return result;
  const userId = result;

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
  const result = await requireOwnerFromPath(c);
  if (result instanceof Response) return result;
  const userId = result;
  return saveMemoForUser(c, userId);
});

// GET /memos/:userId/versions - Get version history for a user's memo
memos.get('/:userId/versions', async (c) => {
  const result = await requireOwnerFromPath(c);
  if (result instanceof Response) return result;
  const userId = result;

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
  const result = await requireOwnerFromPath(c);
  if (result instanceof Response) return result;
  const userId = result;
  const versionStr = c.req.param('version');

  if (!versionStr) {
    return badRequest(c, 'version is required');
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
  const result = await requireOwnerFromPath(c);
  if (result instanceof Response) return result;
  const userId = result;
  const versionStr = c.req.param('version');

  if (!versionStr) {
    return badRequest(c, 'version is required');
  }

  const version = parseInt(versionStr);
  if (isNaN(version)) {
    return badRequest(c, 'Invalid version number');
  }
  return restoreMemoVersionForUser(c, userId, version);
});

// DELETE /memos/:userId - Delete memo and all versions
memos.delete('/:userId', async (c) => {
  const result = await requireOwnerFromPath(c);
  if (result instanceof Response) return result;
  const userId = result;

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
