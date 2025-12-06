/**
 * Cloudflare D1 HTTP API Client
 *
 * Uses Cloudflare's REST API to access D1 databases.
 * Requires: CF_ACCOUNT_ID, CF_API_TOKEN, D1_DATABASE_ID
 *
 * API: POST https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}/query
 */

import { config } from '../config.js';

// Get credentials from environment
const getCredentials = () => {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;
  const databaseId = process.env.D1_DATABASE_ID;

  if (!accountId || !apiToken || !databaseId) {
    throw new Error(
      'D1 credentials not configured. Set CF_ACCOUNT_ID, CF_API_TOKEN, D1_DATABASE_ID'
    );
  }

  return { accountId, apiToken, databaseId };
};

/**
 * Execute a SQL query against D1
 * @param {string} sql - SQL query
 * @param {...any} params - Query parameters
 * @returns {Promise<{results: any[], meta: any}>}
 */
export async function query(sql, ...params) {
  const { accountId, apiToken, databaseId } = getCredentials();

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sql,
      params: params.length > 0 ? params : undefined,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`D1 API error (${response.status}): ${text}`);
  }

  const data = await response.json();

  if (!data.success) {
    const errorMsg = data.errors?.map((e) => e.message).join(', ') || 'Unknown error';
    throw new Error(`D1 query failed: ${errorMsg}`);
  }

  // D1 API returns array of results (one per statement)
  const result = data.result?.[0];
  return {
    results: result?.results || [],
    meta: result?.meta || {},
  };
}

/**
 * Query and return all rows
 * @param {string} sql
 * @param {...any} params
 * @returns {Promise<any[]>}
 */
export async function queryAll(sql, ...params) {
  const { results } = await query(sql, ...params);
  return results;
}

/**
 * Query and return first row
 * @param {string} sql
 * @param {...any} params
 * @returns {Promise<any|null>}
 */
export async function queryOne(sql, ...params) {
  const { results } = await query(sql, ...params);
  return results[0] || null;
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE)
 * @param {string} sql
 * @param {...any} params
 * @returns {Promise<{changes: number, lastRowId: number}>}
 */
export async function execute(sql, ...params) {
  const { meta } = await query(sql, ...params);
  return {
    changes: meta.changes || 0,
    lastRowId: meta.last_row_id || 0,
  };
}

/**
 * Check if D1 is configured and available
 * @returns {boolean}
 */
export function isD1Configured() {
  try {
    getCredentials();
    return true;
  } catch {
    return false;
  }
}

/**
 * Test D1 connection
 * @returns {Promise<boolean>}
 */
export async function testConnection() {
  try {
    await queryOne('SELECT 1 as test');
    return true;
  } catch (err) {
    console.error('D1 connection test failed:', err.message);
    return false;
  }
}
