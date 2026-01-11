/**
 * Secrets Management API Routes
 *
 * Centralized secrets management with:
 * - AES-256-GCM encryption at rest
 * - Audit logging for all changes
 * - Category-based organization
 * - Secure value retrieval
 */

import { Hono } from 'hono';
import type { HonoEnv, Env, Secret, SecretCategory, SecretPublic, SecretAuditLog } from '../types';
import { success, badRequest, notFound, error } from '../lib/response';
import { requireAdmin } from '../middleware/auth';
import {
  encryptSecret,
  decryptSecret,
  hashValue,
  maskSecret,
  generateSecret,
  generateApiKey,
  validateEncryption,
} from '../lib/crypto';

const secrets = new Hono<HonoEnv>();

// All routes require admin authentication
secrets.use('*', requireAdmin);

// ============================================================================
// Helper Functions
// ============================================================================

function generateId(): string {
  return 'sec_' + crypto.randomUUID().replace(/-/g, '').substring(0, 24);
}

/**
 * Log an audit event for a secret
 */
async function logAudit(
  db: D1Database,
  secretId: string,
  action: SecretAuditLog['action'],
  options: {
    oldValueHash?: string | null;
    newValueHash?: string | null;
    changedBy?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO secrets_audit_log 
       (secret_id, action, old_value_hash, new_value_hash, changed_by, ip_address, user_agent, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      secretId,
      action,
      options.oldValueHash ?? null,
      options.newValueHash ?? null,
      options.changedBy ?? 'admin',
      options.ipAddress ?? null,
      options.userAgent ?? null,
      options.metadata ? JSON.stringify(options.metadata) : null
    )
    .run();
}

/**
 * Transform Secret to SecretPublic (remove encrypted values, add metadata)
 */
function toPublic(secret: Secret, categoryName?: string): SecretPublic {
  return {
    id: secret.id,
    category_id: secret.category_id,
    key_name: secret.key_name,
    display_name: secret.display_name,
    description: secret.description,
    is_required: secret.is_required,
    is_sensitive: secret.is_sensitive,
    value_type: secret.value_type,
    validation_pattern: secret.validation_pattern,
    default_value: secret.default_value,
    env_fallback: secret.env_fallback,
    last_rotated_at: secret.last_rotated_at,
    expires_at: secret.expires_at,
    created_at: secret.created_at,
    updated_at: secret.updated_at,
    created_by: secret.created_by,
    updated_by: secret.updated_by,
    has_value: !!(secret.encrypted_value && secret.iv),
    category_name: categoryName,
  };
}

// ============================================================================
// Categories
// ============================================================================

/**
 * GET /categories - List all categories
 */
secrets.get('/categories', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT * FROM secret_categories ORDER BY sort_order ASC`
  ).all<SecretCategory>();

  return success(c, { categories: result.results });
});

/**
 * POST /categories - Create a category
 */
secrets.post('/categories', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { name, displayName, description, icon, sortOrder } = body as {
    name?: string;
    displayName?: string;
    description?: string;
    icon?: string;
    sortOrder?: number;
  };

  if (!name || !displayName) {
    return badRequest(c, 'name and displayName are required');
  }

  const id = 'cat_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_');

  try {
    await c.env.DB.prepare(
      `INSERT INTO secret_categories (id, name, display_name, description, icon, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(id, name, displayName, description ?? null, icon ?? null, sortOrder ?? 50)
      .run();

    const category = await c.env.DB.prepare(
      `SELECT * FROM secret_categories WHERE id = ?`
    )
      .bind(id)
      .first<SecretCategory>();

    return success(c, { category }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return badRequest(c, 'Category with this name already exists');
    }
    throw err;
  }
});

// ============================================================================
// Secrets CRUD
// ============================================================================

/**
 * GET / - List all secrets (without values)
 */
secrets.get('/', async (c) => {
  const categoryId = c.req.query('categoryId');
  const includeExpired = c.req.query('includeExpired') === 'true';

  let query = `
    SELECT s.*, c.name as category_name
    FROM secrets s
    LEFT JOIN secret_categories c ON s.category_id = c.id
    WHERE 1=1
  `;
  const params: (string | null)[] = [];

  if (categoryId) {
    query += ' AND s.category_id = ?';
    params.push(categoryId);
  }

  if (!includeExpired) {
    query += ' AND (s.expires_at IS NULL OR s.expires_at > datetime("now"))';
  }

  query += ' ORDER BY c.sort_order ASC, s.key_name ASC';

  const result = await c.env.DB.prepare(query)
    .bind(...params)
    .all<Secret & { category_name: string }>();

  const secretsPublic = result.results.map((s) => toPublic(s, s.category_name));

  return success(c, { secrets: secretsPublic });
});

/**
 * GET /:id - Get a single secret (without value unless ?reveal=true)
 */
secrets.get('/:id', async (c) => {
  const { id } = c.req.param();
  const reveal = c.req.query('reveal') === 'true';

  const secret = await c.env.DB.prepare(
    `SELECT s.*, c.name as category_name
     FROM secrets s
     LEFT JOIN secret_categories c ON s.category_id = c.id
     WHERE s.id = ? OR s.key_name = ?`
  )
    .bind(id, id)
    .first<Secret & { category_name: string }>();

  if (!secret) {
    return notFound(c, 'Secret not found');
  }

  const result = toPublic(secret, secret.category_name);

  // Optionally reveal masked value (for copying)
  if (reveal && secret.encrypted_value && secret.iv) {
    try {
      const decrypted = await decryptSecret(secret.encrypted_value, secret.iv, c.env);
      result.masked_value = secret.is_sensitive ? maskSecret(decrypted, 6) : decrypted;

      // Log access
      await logAudit(c.env.DB, secret.id, 'accessed', {
        changedBy: 'admin',
        ipAddress: c.req.header('CF-Connecting-IP'),
        userAgent: c.req.header('User-Agent'),
      });
    } catch {
      // Decryption failed - likely wrong key
      result.masked_value = '[decryption failed]';
    }
  }

  return success(c, { secret: result });
});

/**
 * POST / - Create a new secret
 */
secrets.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const {
    categoryId,
    keyName,
    displayName,
    description,
    value,
    isRequired,
    isSensitive,
    valueType,
    validationPattern,
    defaultValue,
    envFallback,
    expiresAt,
  } = body as {
    categoryId?: string;
    keyName?: string;
    displayName?: string;
    description?: string;
    value?: string;
    isRequired?: boolean;
    isSensitive?: boolean;
    valueType?: string;
    validationPattern?: string;
    defaultValue?: string;
    envFallback?: string;
    expiresAt?: string;
  };

  if (!categoryId || !keyName || !displayName) {
    return badRequest(c, 'categoryId, keyName, and displayName are required');
  }

  // Validate key name format (uppercase with underscores)
  if (!/^[A-Z][A-Z0-9_]*$/.test(keyName)) {
    return badRequest(c, 'keyName must be uppercase with underscores (e.g., OPENAI_API_KEY)');
  }

  const id = generateId();
  let encryptedValue: string | null = null;
  let iv: string | null = null;
  let valueHash: string | null = null;

  // Encrypt value if provided
  if (value) {
    const encrypted = await encryptSecret(value, c.env);
    encryptedValue = encrypted.encryptedValue;
    iv = encrypted.iv;
    valueHash = await hashValue(value);
  }

  try {
    await c.env.DB.prepare(
      `INSERT INTO secrets (
        id, category_id, key_name, display_name, description,
        encrypted_value, iv, is_required, is_sensitive, value_type,
        validation_pattern, default_value, env_fallback, expires_at,
        created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        categoryId,
        keyName,
        displayName,
        description ?? null,
        encryptedValue,
        iv,
        isRequired ? 1 : 0,
        isSensitive !== false ? 1 : 0, // Default true
        valueType ?? 'string',
        validationPattern ?? null,
        defaultValue ?? null,
        envFallback ?? keyName, // Default fallback to same key name
        expiresAt ?? null,
        'admin',
        'admin'
      )
      .run();

    // Log creation
    await logAudit(c.env.DB, id, 'created', {
      newValueHash: valueHash,
      changedBy: 'admin',
      ipAddress: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
    });

    const secret = await c.env.DB.prepare(`SELECT * FROM secrets WHERE id = ?`)
      .bind(id)
      .first<Secret>();

    return success(c, { secret: toPublic(secret!) }, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes('UNIQUE')) {
      return badRequest(c, 'Secret with this key name already exists');
    }
    throw err;
  }
});

/**
 * PUT /:id - Update a secret
 */
secrets.put('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json().catch(() => ({}));

  const existing = await c.env.DB.prepare(`SELECT * FROM secrets WHERE id = ? OR key_name = ?`)
    .bind(id, id)
    .first<Secret>();

  if (!existing) {
    return notFound(c, 'Secret not found');
  }

  const {
    displayName,
    description,
    value,
    isRequired,
    isSensitive,
    valueType,
    validationPattern,
    defaultValue,
    envFallback,
    expiresAt,
  } = body as {
    displayName?: string;
    description?: string;
    value?: string;
    isRequired?: boolean;
    isSensitive?: boolean;
    valueType?: string;
    validationPattern?: string;
    defaultValue?: string;
    envFallback?: string;
    expiresAt?: string;
  };

  // Build update query
  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (displayName !== undefined) {
    updates.push('display_name = ?');
    values.push(displayName);
  }
  if (description !== undefined) {
    updates.push('description = ?');
    values.push(description);
  }
  if (isRequired !== undefined) {
    updates.push('is_required = ?');
    values.push(isRequired ? 1 : 0);
  }
  if (isSensitive !== undefined) {
    updates.push('is_sensitive = ?');
    values.push(isSensitive ? 1 : 0);
  }
  if (valueType !== undefined) {
    updates.push('value_type = ?');
    values.push(valueType);
  }
  if (validationPattern !== undefined) {
    updates.push('validation_pattern = ?');
    values.push(validationPattern);
  }
  if (defaultValue !== undefined) {
    updates.push('default_value = ?');
    values.push(defaultValue);
  }
  if (envFallback !== undefined) {
    updates.push('env_fallback = ?');
    values.push(envFallback);
  }
  if (expiresAt !== undefined) {
    updates.push('expires_at = ?');
    values.push(expiresAt);
  }

  let oldValueHash: string | null = null;
  let newValueHash: string | null = null;

  // Handle value update
  if (value !== undefined) {
    // Get old value hash for audit
    if (existing.encrypted_value && existing.iv) {
      try {
        const oldValue = await decryptSecret(existing.encrypted_value, existing.iv, c.env);
        oldValueHash = await hashValue(oldValue);
      } catch {
        // Ignore decryption errors
      }
    }

    if (value === '' || value === null) {
      // Clear value
      updates.push('encrypted_value = ?', 'iv = ?');
      values.push(null, null);
    } else {
      // Encrypt new value
      const encrypted = await encryptSecret(value, c.env);
      updates.push('encrypted_value = ?', 'iv = ?', 'last_rotated_at = ?');
      values.push(encrypted.encryptedValue, encrypted.iv, new Date().toISOString());
      newValueHash = await hashValue(value);
    }
  }

  if (updates.length === 0) {
    return badRequest(c, 'No fields to update');
  }

  updates.push('updated_at = ?', 'updated_by = ?');
  values.push(new Date().toISOString(), 'admin');
  values.push(existing.id);

  await c.env.DB.prepare(
    `UPDATE secrets SET ${updates.join(', ')} WHERE id = ?`
  )
    .bind(...values)
    .run();

  // Log update
  await logAudit(c.env.DB, existing.id, value !== undefined ? 'rotated' : 'updated', {
    oldValueHash,
    newValueHash,
    changedBy: 'admin',
    ipAddress: c.req.header('CF-Connecting-IP'),
    userAgent: c.req.header('User-Agent'),
  });

  const updated = await c.env.DB.prepare(`SELECT * FROM secrets WHERE id = ?`)
    .bind(existing.id)
    .first<Secret>();

  return success(c, { secret: toPublic(updated!) });
});

/**
 * DELETE /:id - Delete a secret
 */
secrets.delete('/:id', async (c) => {
  const { id } = c.req.param();

  const existing = await c.env.DB.prepare(`SELECT * FROM secrets WHERE id = ? OR key_name = ?`)
    .bind(id, id)
    .first<Secret>();

  if (!existing) {
    return notFound(c, 'Secret not found');
  }

  // Check for references
  const refs = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM secret_references WHERE secret_id = ? AND is_active = 1`
  )
    .bind(existing.id)
    .first<{ count: number }>();

  if (refs && refs.count > 0) {
    return badRequest(c, `Cannot delete: secret is referenced by ${refs.count} active resource(s)`);
  }

  // Log deletion before deleting
  await logAudit(c.env.DB, existing.id, 'deleted', {
    changedBy: 'admin',
    ipAddress: c.req.header('CF-Connecting-IP'),
    userAgent: c.req.header('User-Agent'),
    metadata: { keyName: existing.key_name },
  });

  await c.env.DB.prepare(`DELETE FROM secrets WHERE id = ?`).bind(existing.id).run();

  return success(c, { deleted: existing.id, keyName: existing.key_name });
});

// ============================================================================
// Value Operations
// ============================================================================

/**
 * POST /:id/reveal - Get decrypted value (for copying)
 */
secrets.post('/:id/reveal', async (c) => {
  const { id } = c.req.param();

  const secret = await c.env.DB.prepare(`SELECT * FROM secrets WHERE id = ? OR key_name = ?`)
    .bind(id, id)
    .first<Secret>();

  if (!secret) {
    return notFound(c, 'Secret not found');
  }

  if (!secret.encrypted_value || !secret.iv) {
    return badRequest(c, 'Secret has no value set');
  }

  try {
    const value = await decryptSecret(secret.encrypted_value, secret.iv, c.env);

    // Log access
    await logAudit(c.env.DB, secret.id, 'accessed', {
      changedBy: 'admin',
      ipAddress: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
      metadata: { action: 'reveal' },
    });

    return success(c, {
      id: secret.id,
      keyName: secret.key_name,
      value,
    });
  } catch {
    return error(c, 'Failed to decrypt secret. Encryption key may have changed.', 500);
  }
});

/**
 * POST /generate - Generate a new secure value
 */
secrets.post('/generate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { type = 'secret', length = 32, prefix } = body as {
    type?: 'secret' | 'apiKey' | 'uuid';
    length?: number;
    prefix?: string;
  };

  let value: string;

  switch (type) {
    case 'apiKey':
      value = generateApiKey(prefix || 'sk');
      break;
    case 'uuid':
      value = crypto.randomUUID();
      break;
    default:
      value = generateSecret(Math.min(Math.max(length, 16), 128));
  }

  return success(c, { value, type });
});

// ============================================================================
// Bulk Operations
// ============================================================================

/**
 * GET /export - Export all secrets (for backup, without actual values)
 */
secrets.get('/export', async (c) => {
  const includeValues = c.req.query('includeValues') === 'true';

  const [categoriesResult, secretsResult] = await Promise.all([
    c.env.DB.prepare(`SELECT * FROM secret_categories ORDER BY sort_order`).all<SecretCategory>(),
    c.env.DB.prepare(`SELECT * FROM secrets ORDER BY category_id, key_name`).all<Secret>(),
  ]);

  let secretsExport: Array<SecretPublic & { value?: string }> = secretsResult.results.map((s) =>
    toPublic(s)
  );

  // Optionally include decrypted values (for migration/backup)
  if (includeValues) {
    secretsExport = await Promise.all(
      secretsResult.results.map(async (s) => {
        const pub = toPublic(s);
        if (s.encrypted_value && s.iv) {
          try {
            (pub as SecretPublic & { value?: string }).value = await decryptSecret(
              s.encrypted_value,
              s.iv,
              c.env
            );
          } catch {
            // Skip if decryption fails
          }
        }
        return pub;
      })
    );

    // Log bulk access
    await logAudit(c.env.DB, 'BULK_EXPORT', 'accessed', {
      changedBy: 'admin',
      ipAddress: c.req.header('CF-Connecting-IP'),
      userAgent: c.req.header('User-Agent'),
      metadata: { count: secretsResult.results.length },
    });
  }

  return success(c, {
    exportedAt: new Date().toISOString(),
    categories: categoriesResult.results,
    secrets: secretsExport,
  });
});

/**
 * POST /import - Import secrets from backup
 */
secrets.post('/import', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { secrets: importSecrets, overwrite = false } = body as {
    secrets?: Array<{
      categoryId: string;
      keyName: string;
      displayName: string;
      description?: string;
      value?: string;
      isRequired?: boolean;
      isSensitive?: boolean;
      valueType?: string;
      envFallback?: string;
    }>;
    overwrite?: boolean;
  };

  if (!importSecrets || !Array.isArray(importSecrets)) {
    return badRequest(c, 'secrets array is required');
  }

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [] as string[],
  };

  for (const item of importSecrets) {
    try {
      const existing = await c.env.DB.prepare(`SELECT id FROM secrets WHERE key_name = ?`)
        .bind(item.keyName)
        .first<{ id: string }>();

      if (existing && !overwrite) {
        results.skipped++;
        continue;
      }

      const id = existing?.id || generateId();
      let encryptedValue: string | null = null;
      let iv: string | null = null;

      if (item.value) {
        const encrypted = await encryptSecret(item.value, c.env);
        encryptedValue = encrypted.encryptedValue;
        iv = encrypted.iv;
      }

      if (existing) {
        // Update
        await c.env.DB.prepare(
          `UPDATE secrets SET 
           display_name = ?, description = ?, encrypted_value = ?, iv = ?,
           is_required = ?, is_sensitive = ?, value_type = ?, env_fallback = ?,
           updated_at = ?, updated_by = ?
           WHERE id = ?`
        )
          .bind(
            item.displayName,
            item.description ?? null,
            encryptedValue,
            iv,
            item.isRequired ? 1 : 0,
            item.isSensitive !== false ? 1 : 0,
            item.valueType ?? 'string',
            item.envFallback ?? item.keyName,
            new Date().toISOString(),
            'admin',
            id
          )
          .run();
        results.updated++;
      } else {
        // Create
        await c.env.DB.prepare(
          `INSERT INTO secrets (
           id, category_id, key_name, display_name, description,
           encrypted_value, iv, is_required, is_sensitive, value_type,
           env_fallback, created_by, updated_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            id,
            item.categoryId,
            item.keyName,
            item.displayName,
            item.description ?? null,
            encryptedValue,
            iv,
            item.isRequired ? 1 : 0,
            item.isSensitive !== false ? 1 : 0,
            item.valueType ?? 'string',
            item.envFallback ?? item.keyName,
            'admin',
            'admin'
          )
          .run();
        results.created++;
      }
    } catch (err) {
      results.errors.push(`${item.keyName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return success(c, results);
});

// ============================================================================
// Audit Log
// ============================================================================

/**
 * GET /audit - Get audit log
 */
secrets.get('/audit', async (c) => {
  const secretId = c.req.query('secretId');
  const action = c.req.query('action');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);
  const offset = parseInt(c.req.query('offset') || '0');

  let query = `
    SELECT a.*, s.key_name
    FROM secrets_audit_log a
    LEFT JOIN secrets s ON a.secret_id = s.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (secretId) {
    query += ' AND a.secret_id = ?';
    params.push(secretId);
  }

  if (action) {
    query += ' AND a.action = ?';
    params.push(action);
  }

  query += ' ORDER BY a.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const result = await c.env.DB.prepare(query)
    .bind(...params)
    .all<SecretAuditLog & { key_name: string | null }>();

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM secrets_audit_log WHERE 1=1';
  const countParams: string[] = [];
  if (secretId) {
    countQuery += ' AND secret_id = ?';
    countParams.push(secretId);
  }
  if (action) {
    countQuery += ' AND action = ?';
    countParams.push(action);
  }

  const countResult = await c.env.DB.prepare(countQuery)
    .bind(...countParams)
    .first<{ total: number }>();

  return success(c, {
    logs: result.results,
    pagination: {
      total: countResult?.total ?? 0,
      limit,
      offset,
    },
  });
});

// ============================================================================
// Health & Status
// ============================================================================

/**
 * GET /health - Check encryption health
 */
secrets.get('/health', async (c) => {
  const isHealthy = await validateEncryption(c.env);

  // Count secrets
  const stats = await c.env.DB.prepare(
    `SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN encrypted_value IS NOT NULL THEN 1 ELSE 0 END) as with_value,
      SUM(CASE WHEN expires_at IS NOT NULL AND expires_at < datetime('now') THEN 1 ELSE 0 END) as expired
     FROM secrets`
  ).first<{ total: number; with_value: number; expired: number }>();

  return success(c, {
    status: isHealthy ? 'healthy' : 'unhealthy',
    encryption: isHealthy ? 'ok' : 'failed',
    stats: {
      totalSecrets: stats?.total ?? 0,
      withValue: stats?.with_value ?? 0,
      expired: stats?.expired ?? 0,
    },
  });
});

/**
 * GET /overview - Get secrets overview for dashboard
 */
secrets.get('/overview', async (c) => {
  const [categoriesResult, statsResult, recentAuditResult] = await Promise.all([
    c.env.DB.prepare(
      `SELECT c.*, COUNT(s.id) as secret_count
       FROM secret_categories c
       LEFT JOIN secrets s ON c.id = s.category_id
       GROUP BY c.id
       ORDER BY c.sort_order`
    ).all<SecretCategory & { secret_count: number }>(),

    c.env.DB.prepare(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN encrypted_value IS NOT NULL THEN 1 ELSE 0 END) as configured,
        SUM(CASE WHEN is_required = 1 AND encrypted_value IS NULL THEN 1 ELSE 0 END) as missing_required,
        SUM(CASE WHEN expires_at IS NOT NULL AND expires_at < datetime('now', '+7 days') THEN 1 ELSE 0 END) as expiring_soon
       FROM secrets`
    ).first<{
      total: number;
      configured: number;
      missing_required: number;
      expiring_soon: number;
    }>(),

    c.env.DB.prepare(
      `SELECT a.*, s.key_name
       FROM secrets_audit_log a
       LEFT JOIN secrets s ON a.secret_id = s.id
       ORDER BY a.created_at DESC
       LIMIT 10`
    ).all<SecretAuditLog & { key_name: string | null }>(),
  ]);

  return success(c, {
    categories: categoriesResult.results,
    stats: statsResult,
    recentActivity: recentAuditResult.results,
  });
});

export default secrets;
