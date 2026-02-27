/**
 * Memo Service - API client for memo versioning
 *
 * Handles communication with the /api/v1/memos endpoints
 * for memo content CRUD and version history management.
 */

import { getApiBaseUrl } from '@/utils/apiBase';

// ============================================================================
// Types
// ============================================================================

export interface Memo {
  id: string | null;
  userId: string;
  content: string;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MemoVersion {
  id: number;
  memoId: string;
  version: number;
  content?: string;
  contentLength: number;
  changeSummary: string | null;
  createdAt: string;
}

export interface MemoResponse {
  ok: boolean;
  data?: { memo: Memo };
  error?: { message: string };
}

export interface MemoSaveResponse {
  ok: boolean;
  data?: { id: string; version: number };
  error?: { message: string };
}

export interface MemoVersionsResponse {
  ok: boolean;
  data?: { versions: MemoVersion[]; total: number };
  error?: { message: string };
}

export interface MemoVersionResponse {
  ok: boolean;
  data?: { version: MemoVersion };
  error?: { message: string };
}

export interface MemoRestoreResponse {
  ok: boolean;
  data?: { id: string; version: number; restoredFrom: number };
  error?: { message: string };
}

// ============================================================================
// Helper
// ============================================================================

function buildUrl(path: string): string {
  const base = getApiBaseUrl();
  return `${base.replace(/\/$/, '')}/api/v1/memos${path}`;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get current memo content for a user
 */
export async function getMemo(userId: string): Promise<MemoResponse> {
  try {
    const res = await fetch(buildUrl(`/${encodeURIComponent(userId)}`), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return data as MemoResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch memo';
    return { ok: false, error: { message } };
  }
}

/**
 * Save memo content
 *
 * @param userId - User ID
 * @param content - Memo content
 * @param createVersion - Whether to create a version snapshot
 * @param changeSummary - Optional description of changes
 */
export async function saveMemo(
  userId: string,
  content: string,
  createVersion = false,
  changeSummary?: string
): Promise<MemoSaveResponse> {
  try {
    const res = await fetch(buildUrl(`/${encodeURIComponent(userId)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, createVersion, changeSummary }),
    });

    const data = await res.json();
    return data as MemoSaveResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save memo';
    return { ok: false, error: { message } };
  }
}

/**
 * Get version history for a user's memo
 *
 * @param userId - User ID
 * @param limit - Max versions to return (default 20, max 50)
 * @param offset - Pagination offset
 */
export async function getMemoVersions(
  userId: string,
  limit = 20,
  offset = 0
): Promise<MemoVersionsResponse> {
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });

    const res = await fetch(
      buildUrl(`/${encodeURIComponent(userId)}/versions?${params}`),
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await res.json();
    return data as MemoVersionsResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch versions';
    return { ok: false, error: { message } };
  }
}

/**
 * Get specific version content
 *
 * @param userId - User ID
 * @param version - Version number
 */
export async function getMemoVersion(
  userId: string,
  version: number
): Promise<MemoVersionResponse> {
  try {
    const res = await fetch(
      buildUrl(`/${encodeURIComponent(userId)}/versions/${version}`),
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await res.json();
    return data as MemoVersionResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch version';
    return { ok: false, error: { message } };
  }
}

/**
 * Restore a specific version
 *
 * @param userId - User ID
 * @param version - Version number to restore
 */
export async function restoreMemoVersion(
  userId: string,
  version: number
): Promise<MemoRestoreResponse> {
  try {
    const res = await fetch(
      buildUrl(`/${encodeURIComponent(userId)}/restore/${version}`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const data = await res.json();
    return data as MemoRestoreResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to restore version';
    return { ok: false, error: { message } };
  }
}

/**
 * Delete memo and all versions
 *
 * @param userId - User ID
 */
export async function deleteMemo(
  userId: string
): Promise<{ ok: boolean; error?: { message: string } }> {
  try {
    const res = await fetch(buildUrl(`/${encodeURIComponent(userId)}`), {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json();
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete memo';
    return { ok: false, error: { message } };
  }
}
