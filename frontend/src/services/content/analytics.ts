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

// ============================================================================
// API Functions
// ============================================================================

/**
 * Record a view for a post
 */
export async function recordView(year: string, slug: string): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ year, slug }),
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
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/stats/${year}/${slug}`);

    if (!response.ok) {
      const result = await parseAnalyticsError(
        response,
        'Failed to load post analytics'
      );
      return buildReadResult(null, result);
    }

    const data = await response.json();
    return buildReadResult(data.data?.stats || null);
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
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/editor-picks?limit=${limit}`);

    if (!response.ok) {
      return buildReadResult([], {
        degraded: true,
        errorMessage: 'Editor picks unavailable',
        sourceStatus: response.status,
      });
    }

    const data = await response.json();
    return buildReadResult(data.data?.picks || []);
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
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/trending?limit=${limit}&days=${days}`);

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
    return buildReadResult({
      trending: data.data?.trending || [],
      total: data.data?.total || 0,
    });
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
  
  let visitorId = localStorage.getItem(VISITOR_ID_KEY);
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, visitorId);
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
export async function getRealtimeVisitors(): Promise<number> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/realtime`);

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    return data.data?.activeVisitors || 0;
  } catch {
    return 0;
  }
}
