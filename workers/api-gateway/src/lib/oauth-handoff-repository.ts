import type { D1Database } from '@cloudflare/workers-types';

import { execute } from './d1';

export type OAuthHandoffProvider = 'github' | 'google';

export type OAuthHandoffRecord = {
  id: string;
  provider: OAuthHandoffProvider;
  email: string;
  accessToken: string;
  refreshToken: string;
  createdAt: string;
  expiresAt: string;
};

type OAuthHandoffRow = {
  id: string;
  provider: OAuthHandoffProvider;
  email: string;
  access_token: string;
  refresh_token: string;
  created_at: string;
  expires_at: string;
};

function mapRow(row: OAuthHandoffRow): OAuthHandoffRecord {
  return {
    id: row.id,
    provider: row.provider,
    email: row.email,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function createOAuthHandoff(
  db: D1Database,
  record: OAuthHandoffRecord
): Promise<OAuthHandoffRecord> {
  await execute(db, 'DELETE FROM oauth_handoffs WHERE expires_at < ?', record.createdAt);
  await execute(
    db,
    `INSERT INTO oauth_handoffs (
       id, provider, email, access_token, refresh_token, created_at, expires_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    record.id,
    record.provider,
    record.email,
    record.accessToken,
    record.refreshToken,
    record.createdAt,
    record.expiresAt
  );

  return record;
}

export async function consumeOAuthHandoff(
  db: D1Database,
  id: string,
  now: string
): Promise<OAuthHandoffRecord | null> {
  const stmt = db.prepare(
    `DELETE FROM oauth_handoffs
      WHERE id = ?
        AND expires_at >= ?
      RETURNING id, provider, email, access_token, refresh_token, created_at, expires_at`
  ).bind(id, now);
  const { results } = await stmt.all<OAuthHandoffRow>();
  const row = results?.[0];
  return row ? mapRow(row) : null;
}
