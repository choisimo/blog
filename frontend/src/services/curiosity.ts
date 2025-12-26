/**
 * Curiosity Event Tracking Service
 *
 * Web of Curiosity 기능을 위한 이벤트 트래킹 서비스
 * PRD 스키마 기반으로 의미 있는 사용자 행동만 추적
 *
 * @see docs/PRD-web-of-curiosity.md
 */

import { useCallback, useEffect, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CuriosityEventType =
  | 'post_view'
  | 'memo_create'
  | 'tag_click'
  | 'category_filter'
  | 'search';

export interface CuriosityEventContext {
  postId?: string;
  path?: string;
  title?: string;
  tags?: string[];
  selectionHash?: string;
  snippet?: string;
  tag?: string;
  category?: string;
  queryHash?: string;
  queryText?: string; // Only stored if user opts in
}

export interface CuriosityEventMeta {
  version: number;
  ua?: string;
  ref?: 'search' | 'tag' | 'direct' | 'internal';
}

export interface CuriosityEvent {
  id: string;
  type: CuriosityEventType;
  ts: number;
  context: CuriosityEventContext;
  meta: CuriosityEventMeta;
}

export interface CuriositySettings {
  enabled: boolean;
  storeSearchText: boolean;
  maxEvents: number;
  retentionDays: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'curiosity.events';
const SETTINGS_KEY = 'curiosity.settings';
const SCHEMA_VERSION = 1;

const DEFAULT_SETTINGS: CuriositySettings = {
  enabled: true,
  storeSearchText: false,
  maxEvents: 1500,
  retentionDays: 90,
};

// Events that should NOT be tracked (UI noise)
const NOISY_EVENTS = new Set([
  'panel_open',
  'panel_close',
  'scroll',
  'hover',
  'focus',
  'blur',
  'resize',
]);

// ─────────────────────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────────────────────

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `hash:${Math.abs(hash).toString(16)}`;
}

function inferReferrer(): CuriosityEventMeta['ref'] {
  const referrer = document.referrer;
  if (!referrer) return 'direct';

  try {
    const url = new URL(referrer);
    const currentHost = window.location.host;

    if (url.host === currentHost) return 'internal';
    if (url.host.includes('google') || url.host.includes('bing') || url.host.includes('naver')) {
      return 'search';
    }
  } catch {
    // Invalid URL
  }

  return 'direct';
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Layer
// ─────────────────────────────────────────────────────────────────────────────

class CuriosityStorage {
  private events: CuriosityEvent[] = [];
  private settings: CuriositySettings = { ...DEFAULT_SETTINGS };
  private initialized = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      // Load settings
      const settingsRaw = localStorage.getItem(SETTINGS_KEY);
      if (settingsRaw) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw) };
      }

      // Load events
      const eventsRaw = localStorage.getItem(STORAGE_KEY);
      if (eventsRaw) {
        const parsed = JSON.parse(eventsRaw);
        if (Array.isArray(parsed)) {
          this.events = parsed.filter(
            (e): e is CuriosityEvent =>
              e && typeof e.id === 'string' && typeof e.ts === 'number'
          );
          this.cleanupOldEvents();
        }
      }

      this.initialized = true;
    } catch (err) {
      console.warn('[Curiosity] Failed to load from storage:', err);
      this.events = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
    } catch (err) {
      console.warn('[Curiosity] Failed to save to storage:', err);
    }
  }

  private cleanupOldEvents(): void {
    const now = Date.now();
    const maxAge = this.settings.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = now - maxAge;

    // Remove old events
    this.events = this.events.filter((e) => e.ts >= cutoff);

    // Enforce max events limit (keep newest)
    if (this.events.length > this.settings.maxEvents) {
      this.events = this.events
        .sort((a, b) => b.ts - a.ts)
        .slice(0, this.settings.maxEvents);
    }
  }

  addEvent(event: CuriosityEvent): void {
    if (!this.settings.enabled) return;

    this.events.push(event);
    this.cleanupOldEvents();
    this.saveToStorage();
  }

  getEvents(): CuriosityEvent[] {
    return [...this.events];
  }

  getSettings(): CuriositySettings {
    return { ...this.settings };
  }

  updateSettings(updates: Partial<CuriositySettings>): void {
    this.settings = { ...this.settings, ...updates };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {}
  }

  clearEvents(): void {
    this.events = [];
    this.saveToStorage();
  }

  exportEvents(): string {
    return JSON.stringify(this.events, null, 2);
  }

  importEvents(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) return false;

      const valid = parsed.filter(
        (e): e is CuriosityEvent =>
          e && typeof e.id === 'string' && typeof e.ts === 'number'
      );

      this.events = [...this.events, ...valid];
      this.cleanupOldEvents();
      this.saveToStorage();
      return true;
    } catch {
      return false;
    }
  }

  getStats(): { total: number; byType: Record<CuriosityEventType, number> } {
    const byType: Record<CuriosityEventType, number> = {
      post_view: 0,
      memo_create: 0,
      tag_click: 0,
      category_filter: 0,
      search: 0,
    };

    for (const event of this.events) {
      if (byType[event.type] !== undefined) {
        byType[event.type]++;
      }
    }

    return { total: this.events.length, byType };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Service
// ─────────────────────────────────────────────────────────────────────────────

class CuriosityTracker {
  private storage: CuriosityStorage;
  private lastPostView: { postId: string; ts: number } | null = null;

  constructor() {
    this.storage = new CuriosityStorage();
  }

  /**
   * Track a post view event
   */
  trackPostView(postId: string, path: string, title: string, tags: string[] = []): void {
    // Debounce: Don't track same post within 5 seconds
    if (
      this.lastPostView &&
      this.lastPostView.postId === postId &&
      Date.now() - this.lastPostView.ts < 5000
    ) {
      return;
    }

    const event: CuriosityEvent = {
      id: generateEventId(),
      type: 'post_view',
      ts: Date.now(),
      context: {
        postId,
        path,
        title,
        tags,
      },
      meta: {
        version: SCHEMA_VERSION,
        ref: inferReferrer(),
      },
    };

    this.storage.addEvent(event);
    this.lastPostView = { postId, ts: Date.now() };

    // Dispatch event for FAB/other components to listen
    window.dispatchEvent(
      new CustomEvent('curiosity:event', { detail: event })
    );
  }

  /**
   * Track memo creation
   */
  trackMemoCreate(
    postId: string,
    snippet?: string,
    selectionHash?: string
  ): void {
    const event: CuriosityEvent = {
      id: generateEventId(),
      type: 'memo_create',
      ts: Date.now(),
      context: {
        postId,
        snippet: snippet?.slice(0, 200), // Limit snippet length
        selectionHash,
      },
      meta: {
        version: SCHEMA_VERSION,
      },
    };

    this.storage.addEvent(event);
    window.dispatchEvent(
      new CustomEvent('curiosity:event', { detail: event })
    );
  }

  /**
   * Track tag click
   */
  trackTagClick(tag: string, fromPostId?: string): void {
    const event: CuriosityEvent = {
      id: generateEventId(),
      type: 'tag_click',
      ts: Date.now(),
      context: {
        tag,
        postId: fromPostId,
      },
      meta: {
        version: SCHEMA_VERSION,
      },
    };

    this.storage.addEvent(event);
    window.dispatchEvent(
      new CustomEvent('curiosity:event', { detail: event })
    );
  }

  /**
   * Track category filter
   */
  trackCategoryFilter(category: string): void {
    const event: CuriosityEvent = {
      id: generateEventId(),
      type: 'category_filter',
      ts: Date.now(),
      context: {
        category,
      },
      meta: {
        version: SCHEMA_VERSION,
      },
    };

    this.storage.addEvent(event);
    window.dispatchEvent(
      new CustomEvent('curiosity:event', { detail: event })
    );
  }

  /**
   * Track search execution
   */
  trackSearch(query: string): void {
    const settings = this.storage.getSettings();
    const event: CuriosityEvent = {
      id: generateEventId(),
      type: 'search',
      ts: Date.now(),
      context: {
        queryHash: hashString(query),
        queryText: settings.storeSearchText ? query : undefined,
      },
      meta: {
        version: SCHEMA_VERSION,
      },
    };

    this.storage.addEvent(event);
    window.dispatchEvent(
      new CustomEvent('curiosity:event', { detail: event })
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Data Access
  // ─────────────────────────────────────────────────────────────────────────

  getEvents(): CuriosityEvent[] {
    return this.storage.getEvents();
  }

  getEventsByType(type: CuriosityEventType): CuriosityEvent[] {
    return this.storage.getEvents().filter((e) => e.type === type);
  }

  getEventsByTimeRange(startTs: number, endTs: number): CuriosityEvent[] {
    return this.storage.getEvents().filter(
      (e) => e.ts >= startTs && e.ts <= endTs
    );
  }

  getRecentEvents(limit: number = 50): CuriosityEvent[] {
    return this.storage
      .getEvents()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
  }

  getStats() {
    return this.storage.getStats();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Settings
  // ─────────────────────────────────────────────────────────────────────────

  getSettings(): CuriositySettings {
    return this.storage.getSettings();
  }

  updateSettings(updates: Partial<CuriositySettings>): void {
    this.storage.updateSettings(updates);
  }

  setEnabled(enabled: boolean): void {
    this.storage.updateSettings({ enabled });
  }

  isEnabled(): boolean {
    return this.storage.getSettings().enabled;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Data Management
  // ─────────────────────────────────────────────────────────────────────────

  clearAll(): void {
    this.storage.clearEvents();
  }

  exportData(): string {
    return this.storage.exportEvents();
  }

  importData(json: string): boolean {
    return this.storage.importEvents(json);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────────────────────────────────────────

export const curiosityTracker = new CuriosityTracker();

// ─────────────────────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useCuriosityEvents(options?: {
  type?: CuriosityEventType;
  limit?: number;
  startTs?: number;
  endTs?: number;
}) {
  const [events, setEvents] = useState<CuriosityEvent[]>([]);
  const [stats, setStats] = useState(curiosityTracker.getStats());

  const refresh = useCallback(() => {
    let result: CuriosityEvent[];

    if (options?.startTs && options?.endTs) {
      result = curiosityTracker.getEventsByTimeRange(options.startTs, options.endTs);
    } else if (options?.type) {
      result = curiosityTracker.getEventsByType(options.type);
    } else if (options?.limit) {
      result = curiosityTracker.getRecentEvents(options.limit);
    } else {
      result = curiosityTracker.getEvents();
    }

    setEvents(result);
    setStats(curiosityTracker.getStats());
  }, [options?.type, options?.limit, options?.startTs, options?.endTs]);

  useEffect(() => {
    refresh();

    const handler = () => refresh();
    window.addEventListener('curiosity:event', handler);
    return () => window.removeEventListener('curiosity:event', handler);
  }, [refresh]);

  return { events, stats, refresh };
}

export function useCuriositySettings() {
  const [settings, setSettingsState] = useState(curiosityTracker.getSettings());

  const updateSettings = useCallback((updates: Partial<CuriositySettings>) => {
    curiosityTracker.updateSettings(updates);
    setSettingsState(curiosityTracker.getSettings());
  }, []);

  return { settings, updateSettings };
}
