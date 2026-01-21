/**
 * Analytics Service
 * Handles view tracking and editor picks
 */
import { getApiBaseUrl } from '@/utils/apiBase';

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
export async function getPostStats(year: string, slug: string): Promise<PostStats | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/stats/${year}/${slug}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data?.stats || null;
  } catch (err) {
    console.warn('Failed to get post stats:', err);
    return null;
  }
}

/**
 * Get active editor picks from D1 database
 */
export async function getEditorPicks(limit: number = 3): Promise<EditorPick[]> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/editor-picks?limit=${limit}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data?.picks || [];
  } catch (err) {
    console.warn('Failed to get editor picks:', err);
    return [];
  }
}

/**
 * Get trending posts based on recent views
 */
export async function getTrendingPosts(limit: number = 5, days: number = 7): Promise<TrendingPost[]> {
  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/v1/analytics/trending?limit=${limit}&days=${days}`);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.data?.trending || [];
  } catch (err) {
    console.warn('Failed to get trending posts:', err);
    return [];
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
