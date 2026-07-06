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
const MAX_EVENT_ID_LENGTH = 160;
const MAX_CONTEXT_TEXT_LENGTH = 500;
const MAX_CONTEXT_TAGS = 20;
const MAX_UA_LENGTH = 512;
const MAX_EVENTS_LIMIT = 5000;
const MAX_RETENTION_DAYS = 365;
const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const DEFAULT_SETTINGS: CuriositySettings = {
  enabled: true,
  storeSearchText: false,
  maxEvents: 1500,
  retentionDays: 90,
};

const CURIOSITY_EVENT_TYPES: CuriosityEventType[] = [
  'post_view',
  'memo_create',
  'tag_click',
  'category_filter',
  'search',
];

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
  } catch { void 0; }

  return 'direct';
}

function isCuriosityEventType(value: unknown): value is CuriosityEventType {
  return typeof value === 'string' && CURIOSITY_EVENT_TYPES.includes(value as CuriosityEventType);
}

function normalizePositiveInteger(
  value: unknown,
  fallback: number,
  max: number
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(1, Math.floor(value)))
    : fallback;
}

function normalizeSettings(value: unknown): CuriositySettings {
  const candidate = value && typeof value === 'object'
    ? value as Partial<CuriositySettings>
    : {};

  return {
    enabled: typeof candidate.enabled === 'boolean'
      ? candidate.enabled
      : DEFAULT_SETTINGS.enabled,
    storeSearchText: typeof candidate.storeSearchText === 'boolean'
      ? candidate.storeSearchText
      : DEFAULT_SETTINGS.storeSearchText,
    maxEvents: normalizePositiveInteger(
      candidate.maxEvents,
      DEFAULT_SETTINGS.maxEvents,
      MAX_EVENTS_LIMIT
    ),
    retentionDays: normalizePositiveInteger(
      candidate.retentionDays,
      DEFAULT_SETTINGS.retentionDays,
      MAX_RETENTION_DAYS
    ),
  };
}

function normalizeSingleLineText(value: unknown, maxLength = MAX_CONTEXT_TEXT_LENGTH): string | undefined {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || SINGLE_LINE_CONTROL_PATTERN.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function normalizeMultilineText(value: unknown, maxLength = MAX_CONTEXT_TEXT_LENGTH): string | undefined {
  if (typeof value !== 'string') return undefined;

  const normalized = value
    .replace(/\r\n?/g, '\n')
    .replace(MULTILINE_CONTROL_PATTERN, ' ')
    .trim();
  if (!normalized) return undefined;

  return normalized.slice(0, maxLength);
}

function normalizeTags(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const tags = value
    .slice(0, MAX_CONTEXT_TAGS)
    .map(tag => normalizeSingleLineText(tag))
    .filter((tag): tag is string => Boolean(tag));

  return tags.length > 0 ? tags : undefined;
}

function normalizeEventContext(value: unknown): CuriosityEventContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const context = value as CuriosityEventContext;
  const normalized: CuriosityEventContext = {};

  const postId = normalizeSingleLineText(context.postId);
  const path = normalizeSingleLineText(context.path);
  const title = normalizeSingleLineText(context.title);
  const tags = normalizeTags(context.tags);
  const selectionHash = normalizeSingleLineText(context.selectionHash);
  const snippet = normalizeMultilineText(context.snippet, 200);
  const tag = normalizeSingleLineText(context.tag);
  const category = normalizeSingleLineText(context.category);
  const queryHash = normalizeSingleLineText(context.queryHash);
  const queryText = normalizeMultilineText(context.queryText);

  if (postId) normalized.postId = postId;
  if (path) normalized.path = path;
  if (title) normalized.title = title;
  if (tags) normalized.tags = tags;
  if (selectionHash) normalized.selectionHash = selectionHash;
  if (snippet) normalized.snippet = snippet;
  if (tag) normalized.tag = tag;
  if (category) normalized.category = category;
  if (queryHash) normalized.queryHash = queryHash;
  if (queryText) normalized.queryText = queryText;

  return normalized;
}

function normalizeEventMeta(value: unknown): CuriosityEventMeta | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const meta = value as CuriosityEventMeta;
  if (typeof meta.version !== 'number' || !Number.isFinite(meta.version)) {
    return null;
  }

  const normalized: CuriosityEventMeta = {
    version: Math.max(1, Math.floor(meta.version)),
  };
  const ua = normalizeSingleLineText(meta.ua, MAX_UA_LENGTH);
  if (ua) normalized.ua = ua;
  if (
    meta.ref === 'search' ||
    meta.ref === 'tag' ||
    meta.ref === 'direct' ||
    meta.ref === 'internal'
  ) {
    normalized.ref = meta.ref;
  }

  return normalized;
}

function normalizeCuriosityEvent(value: unknown): CuriosityEvent | null {
  if (!value || typeof value !== 'object') return null;
  const event = value as CuriosityEvent;
  const id = normalizeSingleLineText(event.id, MAX_EVENT_ID_LENGTH);
  const context = normalizeEventContext(event.context);
  const meta = normalizeEventMeta(event.meta);

  if (!id || !isCuriosityEventType(event.type) || !Number.isFinite(event.ts) || !context || !meta) {
    return null;
  }

  return {
    id,
    type: event.type,
    ts: event.ts,
    context,
    meta,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Layer
// ─────────────────────────────────────────────────────────────────────────────

class CuriosityStorage {
  private events: CuriosityEvent[] = [];
  private settings: CuriositySettings = { ...DEFAULT_SETTINGS };

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      // Load settings
      const settingsRaw = localStorage.getItem(SETTINGS_KEY);
      if (settingsRaw) {
        this.settings = normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw) });
      }

      // Load events
      const eventsRaw = localStorage.getItem(STORAGE_KEY);
      if (eventsRaw) {
        const parsed = JSON.parse(eventsRaw);
        if (Array.isArray(parsed)) {
          this.events = parsed
            .map(normalizeCuriosityEvent)
            .filter((event): event is CuriosityEvent => Boolean(event));
          this.cleanupOldEvents();
        }
      }
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
    this.settings = normalizeSettings({ ...this.settings, ...updates });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { void 0; }
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

      const valid = parsed
        .map(normalizeCuriosityEvent)
        .filter((event): event is CuriosityEvent => Boolean(event));

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
    const context = normalizeEventContext({ postId, path, title, tags });
    if (!context?.postId || !context.path || !context.title) return;

    // Debounce: Don't track same post within 5 seconds
    if (
      this.lastPostView &&
      this.lastPostView.postId === context.postId &&
      Date.now() - this.lastPostView.ts < 5000
    ) {
      return;
    }

    const event: CuriosityEvent = {
      id: generateEventId(),
      type: 'post_view',
      ts: Date.now(),
      context,
      meta: {
        version: SCHEMA_VERSION,
        ref: inferReferrer(),
      },
    };

    this.storage.addEvent(event);
    this.lastPostView = { postId: context.postId, ts: Date.now() };

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
    const context = normalizeEventContext({ postId, snippet, selectionHash });
    if (!context?.postId) return;

    const event: CuriosityEvent = {
      id: generateEventId(),
      type: 'memo_create',
      ts: Date.now(),
      context,
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
    const context = normalizeEventContext({ tag, postId: fromPostId });
    if (!context?.tag) return;

    const event: CuriosityEvent = {
      id: generateEventId(),
      type: 'tag_click',
      ts: Date.now(),
      context,
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
    const context = normalizeEventContext({ category });
    if (!context?.category) return;

    const event: CuriosityEvent = {
      id: generateEventId(),
      type: 'category_filter',
      ts: Date.now(),
      context,
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
    const normalizedQuery = normalizeMultilineText(query);
    if (!normalizedQuery) return;

    const event: CuriosityEvent = {
      id: generateEventId(),
      type: 'search',
      ts: Date.now(),
      context: {
        queryHash: hashString(normalizedQuery),
        queryText: settings.storeSearchText ? normalizedQuery : undefined,
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
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || startTs > endTs) {
      return [];
    }

    return this.storage.getEvents().filter(
      (e) => e.ts >= startTs && e.ts <= endTs
    );
  }

  getRecentEvents(limit: number = 50): CuriosityEvent[] {
    const safeLimit = normalizePositiveInteger(limit, 50, MAX_EVENTS_LIMIT);
    return this.storage
      .getEvents()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, safeLimit);
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
