/**
 * Analytics Service
 * Handles view tracking and editor picks
 */
import { getApiBaseUrl } from '@/utils/network/apiBase';

// ============================================================================
// Types
// ============================================================================

export type PostStats = {
  total_views: number;
  views_7d: number;
  views_30d: number;
};

export type EditorPick = {
  post_slug: string;
  year: string;
  title: string;
  cover_image: string | null;
  category: string | null;
  rank: number;
  score: number;
  reason: string | null;
};

export type TrendingPost = {
  post_slug: string;
  year: string;
  recent_views: number;
  total_views: number;
};

export type AnalyticsReadResult<T> = {
  data: T;
  degraded: boolean;
  errorMessage: string | null;
  sourceStatus: number | null;
};

export type RealtimeVisitorsSnapshot = {
  activeVisitors: number;
  timestamp: number | null;
};

type AnalyticsErrorPayload = {
  degraded?: boolean;
  sourceStatus?: number;
  error?: {
    message?: string;
  };
};

function buildReadResult<T>(
  data: T,
  options: Partial<AnalyticsReadResult<T>> = {}
): AnalyticsReadResult<T> {
  return {
    data,
    degraded: Boolean(options.degraded),
    errorMessage: options.errorMessage ?? null,
    sourceStatus: options.sourceStatus ?? null,
  };
}

async function parseAnalyticsError(
  response: Response,
  fallbackMessage: string
): Promise<AnalyticsReadResult<null>> {
  const payload = (await response.json().catch(() => null)) as AnalyticsErrorPayload | null;
  return buildReadResult(null, {
    degraded: Boolean(payload?.degraded) || response.status >= 500,
    errorMessage: payload?.error?.message || fallbackMessage,
    sourceStatus: payload?.sourceStatus ?? response.status,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const ANALYTICS_SELECTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const ANALYTICS_YEAR_PATTERN = /^\d{4}$/;
const ANALYTICS_DISPLAY_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const MAX_ANALYTICS_LIMIT = 50;
const MAX_TRENDING_DAYS = 365;

function normalizePositiveInteger(value: number, fallback: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value)));
}

function decodeAnalyticsSelector(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

function normalizeAnalyticsSelector(value: string): string | null {
  const normalized = decodeAnalyticsSelector(value);
  if (!normalized) return null;
  return ANALYTICS_SELECTOR_PATTERN.test(normalized) ? normalized : null;
}

function normalizeAnalyticsYear(value: string): string | null {
  const normalized = decodeAnalyticsSelector(value);
  if (!normalized) return null;
  return ANALYTICS_YEAR_PATTERN.test(normalized) ? normalized : null;
}

function normalizeDisplayText(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!normalized || ANALYTICS_DISPLAY_CONTROL_PATTERN.test(normalized)) return null;
  return normalized;
}

function normalizeNullableDisplayText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return normalizeDisplayText(value);
}

function normalizeVisitorId(value: string): string | null {
  return normalizeAnalyticsSelector(value);
}

function parsePostStats(value: unknown): PostStats | null {
  if (!isRecord(value)) return null;
  if (
    !isFiniteNumber(value.total_views) ||
    !isFiniteNumber(value.views_7d) ||
    !isFiniteNumber(value.views_30d)
  ) {
    return null;
  }

  return {
    total_views: value.total_views,
    views_7d: value.views_7d,
    views_30d: value.views_30d,
  };
}

function parseEditorPick(value: unknown): EditorPick | null {
  if (!isRecord(value)) return null;
  const postSlug = typeof value.post_slug === 'string'
    ? normalizeAnalyticsSelector(value.post_slug)
    : null;
  const year = typeof value.year === 'string'
    ? normalizeAnalyticsYear(value.year)
    : null;
  const title = normalizeDisplayText(value.title);

  if (
    !postSlug ||
    !year ||
    !title ||
    !isFiniteNumber(value.rank) ||
    !isFiniteNumber(value.score)
  ) {
    return null;
  }

  return {
    post_slug: postSlug,
    year,
    title,
    cover_image: normalizeNullableDisplayText(value.cover_image),
    category: normalizeNullableDisplayText(value.category),
    rank: value.rank,
    score: value.score,
    reason: normalizeNullableDisplayText(value.reason),
  };
}

function parseEditorPicksPayload(value: unknown): EditorPick[] | null {
  if (!isRecord(value) || !Array.isArray(value.picks)) return null;

  const picks = value.picks.map(parseEditorPick);
  if (picks.some(pick => pick === null)) return null;

  return picks as EditorPick[];
}

function parseTrendingPost(value: unknown): TrendingPost | null {
  if (!isRecord(value)) return null;
  const postSlug = typeof value.post_slug === 'string'
    ? normalizeAnalyticsSelector(value.post_slug)
    : null;
  const year = typeof value.year === 'string'
    ? normalizeAnalyticsYear(value.year)
    : null;

  if (
    !postSlug ||
    !year ||
    !isFiniteNumber(value.recent_views) ||
    !isFiniteNumber(value.total_views)
  ) {
    return null;
  }

  return {
    post_slug: postSlug,
    year,
    recent_views: value.recent_views,
    total_views: value.total_views,
  };
}

function parseTrendingPayload(
  value: unknown
): { trending: TrendingPost[]; total: number } | null {
  if (!isRecord(value) || !Array.isArray(value.trending)) return null;

  const trending = value.trending.map(parseTrendingPost);
  if (trending.some(item => item === null)) return null;

  return {
    trending: trending as TrendingPost[],
    total: isFiniteNumber(value.total) ? value.total : trending.length,
  };
}

function parseRealtimeVisitorsSnapshot(
  value: unknown
): RealtimeVisitorsSnapshot | null {
  if (!isRecord(value)) return null;
  if (!isFiniteNumber(value.activeVisitors) || value.activeVisitors < 0) {
    return null;
  }
  if (
    value.timestamp !== undefined &&
    value.timestamp !== null &&
    !isFiniteNumber(value.timestamp)
  ) {
    return null;
  }

  return {
    activeVisitors: value.activeVisitors,
    timestamp:
      value.timestamp === undefined || value.timestamp === null
        ? null
        : value.timestamp,
  };
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Record a view for a post
 */
export async function recordView(year: string, slug: string): Promise<boolean> {
  const normalizedYear = normalizeAnalyticsYear(year);
  const normalizedSlug = normalizeAnalyticsSelector(slug);
  if (!normalizedYear || !normalizedSlug) {
    return false;
  }

  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year: normalizedYear, slug: normalizedSlug }),
    });

    if (!response.ok) {
      console.warn('Failed to record view:', response.status);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('Failed to record view:', err);
    return false;
  }
}

/**
 * Get stats for a specific post
 */
export async function getPostStats(
  year: string,
  slug: string
): Promise<AnalyticsReadResult<PostStats | null>> {
  const normalizedYear = normalizeAnalyticsYear(year);
  const normalizedSlug = normalizeAnalyticsSelector(slug);
  if (!normalizedYear || !normalizedSlug) {
    return buildReadResult(null, {
      degraded: true,
      errorMessage: 'Invalid post analytics identifier',
    });
  }

  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/v1/analytics/stats/${encodeURIComponent(normalizedYear)}/${encodeURIComponent(normalizedSlug)}`
    );

    if (!response.ok) {
      const result = await parseAnalyticsError(
        response,
        'Failed to load post analytics'
      );
      return buildReadResult(null, result);
    }

    const data = await response.json();
    const stats = isRecord(data) && isRecord(data.data)
      ? parsePostStats(data.data.stats)
      : null;
    if (!stats) {
      return buildReadResult(null, {
        degraded: true,
        errorMessage: 'Invalid post analytics response',
      });
    }

    return buildReadResult(stats);
  } catch (err) {
    console.warn('Failed to get post stats:', err);
    return buildReadResult(null, {
      degraded: true,
      errorMessage: 'Analytics backend unavailable',
    });
  }
}

/**
 * Get active editor picks from D1 database
 */
export async function getEditorPicks(
  limit: number = 3
): Promise<AnalyticsReadResult<EditorPick[]>> {
  try {
    const safeLimit = normalizePositiveInteger(limit, 3, MAX_ANALYTICS_LIMIT);
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/editor-picks?limit=${safeLimit}`);

    if (!response.ok) {
      return buildReadResult([], {
        degraded: true,
        errorMessage: 'Editor picks unavailable',
        sourceStatus: response.status,
      });
    }

    const data = await response.json();
    const picks = isRecord(data) && isRecord(data.data)
      ? parseEditorPicksPayload(data.data)
      : null;
    if (!picks) {
      return buildReadResult([], {
        degraded: true,
        errorMessage: 'Invalid editor picks analytics response',
      });
    }

    return buildReadResult(picks);
  } catch (err) {
    console.warn('Failed to get editor picks:', err);
    return buildReadResult([], {
      degraded: true,
      errorMessage: 'Editor picks unavailable',
    });
  }
}

/**
 * Get trending posts based on recent views
 */
export async function getTrendingPosts(
  limit: number = 5,
  days: number = 7
): Promise<AnalyticsReadResult<{ trending: TrendingPost[]; total: number }>> {
  try {
    const safeLimit = normalizePositiveInteger(limit, 5, MAX_ANALYTICS_LIMIT);
    const safeDays = normalizePositiveInteger(days, 7, MAX_TRENDING_DAYS);
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/trending?limit=${safeLimit}&days=${safeDays}`);

    if (!response.ok) {
      const result = await parseAnalyticsError(
        response,
        'Failed to load trending posts'
      );
      return buildReadResult(
        { trending: [], total: 0 },
        {
          degraded: result.degraded,
          errorMessage: result.errorMessage,
          sourceStatus: result.sourceStatus,
        }
      );
    }

    const data = await response.json();
    const parsed = isRecord(data) && isRecord(data.data)
      ? parseTrendingPayload(data.data)
      : null;
    if (!parsed) {
      return buildReadResult(
        { trending: [], total: 0 },
        {
          degraded: true,
          errorMessage: 'Invalid trending analytics response',
        }
      );
    }

    return buildReadResult(parsed);
  } catch (err) {
    console.warn('Failed to get trending posts:', err);
    return buildReadResult(
      { trending: [], total: 0 },
      {
        degraded: true,
        errorMessage: 'Analytics backend unavailable',
      }
    );
  }
}

// ============================================================================
// Realtime Visitor Tracking
// ============================================================================

const VISITOR_ID_KEY = 'analytics.visitorId';
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Get or create a persistent visitor ID
 */
function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  
  let visitorId = normalizeVisitorId(localStorage.getItem(VISITOR_ID_KEY) || '') || '';
  if (!visitorId) {
    localStorage.removeItem(VISITOR_ID_KEY);
    visitorId = normalizeVisitorId(crypto.randomUUID()) || '';
    if (visitorId) {
      localStorage.setItem(VISITOR_ID_KEY, visitorId);
    }
  }
  return visitorId;
}

/**
 * Send heartbeat to track active visitor
 */
export async function sendHeartbeat(): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const visitorId = getVisitorId();
    if (!visitorId) {
      return false;
    }
    
    const response = await fetch(`${baseUrl}/api/v1/analytics/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitorId }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Start heartbeat interval (call on app mount)
 */
export function startHeartbeat(): void {
  if (heartbeatInterval) return;
  
  // Send initial heartbeat
  sendHeartbeat();
  
  // Send heartbeat every 30 seconds
  heartbeatInterval = setInterval(() => {
    sendHeartbeat();
  }, 30000);
}

/**
 * Stop heartbeat interval (call on app unmount)
 */
export function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Get current active visitor count
 */
export async function getRealtimeVisitorsSnapshot(): Promise<
  AnalyticsReadResult<RealtimeVisitorsSnapshot>
> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/realtime`);

    if (!response.ok) {
      const result = await parseAnalyticsError(
        response,
        'Realtime visitor analytics unavailable'
      );
      return buildReadResult(
        { activeVisitors: 0, timestamp: null },
        {
          degraded: result.degraded,
          errorMessage: result.errorMessage,
          sourceStatus: result.sourceStatus,
        }
      );
    }

    const data = await response.json();
    const parsed = isRecord(data) && isRecord(data.data)
      ? parseRealtimeVisitorsSnapshot(data.data)
      : null;
    if (!parsed) {
      return buildReadResult(
        { activeVisitors: 0, timestamp: null },
        {
          degraded: true,
          errorMessage: 'Invalid realtime visitor analytics response',
        }
      );
    }

    return buildReadResult(parsed);
  } catch {
    return buildReadResult(
      { activeVisitors: 0, timestamp: null },
      {
        degraded: true,
        errorMessage: 'Realtime visitor analytics unavailable',
      }
    );
  }
}

export async function getRealtimeVisitors(): Promise<number> {
  const result = await getRealtimeVisitorsSnapshot();
  return result.data.activeVisitors;
}
