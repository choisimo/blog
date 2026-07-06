/**
 * Search History Service
 * Manages recent search queries in localStorage
 */

const STORAGE_KEY = 'blog.searchHistory';
const MAX_HISTORY = 5;
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
const WHITESPACE_PATTERN = /\s+/g;

export interface SearchHistoryItem {
    query: string;
    timestamp: number;
}

function normalizeSearchQuery(value: unknown): string | null {
    if (typeof value !== 'string') return null;

    const normalized = value
        .replace(CONTROL_CHAR_PATTERN, ' ')
        .replace(WHITESPACE_PATTERN, ' ')
        .trim();
    if (normalized.length < MIN_QUERY_LENGTH || normalized.length > MAX_QUERY_LENGTH) {
        return null;
    }

    return normalized;
}

function normalizeTimestamp(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.floor(value)
        : null;
}

function normalizeSearchHistoryItem(item: unknown): SearchHistoryItem | null {
    if (!item || typeof item !== 'object') return null;

    const query = normalizeSearchQuery((item as SearchHistoryItem).query);
    const timestamp = normalizeTimestamp((item as SearchHistoryItem).timestamp);
    return query && timestamp !== null ? { query, timestamp } : null;
}

function compactSearchHistory(items: SearchHistoryItem[]): SearchHistoryItem[] {
    const seen = new Set<string>();

    return items.filter(item => {
        const key = item.query.toLowerCase();
        if (seen.has(key)) return false;

        seen.add(key);
        return true;
    });
}

function dispatchSearchHistoryUpdate(): void {
    window.dispatchEvent(new CustomEvent('searchHistory:update'));
}

function writeSearchHistory(items: SearchHistoryItem[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        dispatchSearchHistoryUpdate();
    } catch {
        // Storage can be unavailable or quota-limited; keep callers non-fatal.
    }
}

function removeStoredSearchHistory(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
        dispatchSearchHistoryUpdate();
    } catch {
        // Storage can be unavailable; clearing history should remain best-effort.
    }
}

/**
 * Get all search history items
 */
export function getSearchHistory(): SearchHistoryItem[] {
    if (typeof window === 'undefined') return [];

    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];

        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return [];

        return compactSearchHistory(
            data
                .map(normalizeSearchHistoryItem)
                .filter((item): item is SearchHistoryItem => Boolean(item))
        ).slice(0, MAX_HISTORY);
    } catch {
        return [];
    }
}

/**
 * Get recent search queries (just the strings)
 */
export function getRecentQueries(): string[] {
    return getSearchHistory().map(item => item.query);
}

/**
 * Add a search query to history
 * Deduplicates and maintains max size
 */
export function addSearchQuery(query: string): void {
    if (typeof window === 'undefined') return;

    const normalizedQuery = normalizeSearchQuery(query);
    if (!normalizedQuery) return;

    const current = getSearchHistory();

    // Remove existing entry with same query (case-insensitive)
    const filtered = current.filter(
        item => item.query.toLowerCase() !== normalizedQuery.toLowerCase()
    );

    // Add new entry at the beginning
    const next: SearchHistoryItem[] = [
        { query: normalizedQuery, timestamp: Date.now() },
        ...filtered,
    ].slice(0, MAX_HISTORY);

    writeSearchHistory(next);
}

/**
 * Remove a specific query from history
 */
export function removeSearchQuery(query: string): void {
    if (typeof window === 'undefined') return;

    const normalizedQuery = normalizeSearchQuery(query);
    if (!normalizedQuery) return;

    const current = getSearchHistory();
    const next = current.filter(
        item => item.query.toLowerCase() !== normalizedQuery.toLowerCase()
    );

    writeSearchHistory(next);
}

/**
 * Clear all search history
 */
export function clearSearchHistory(): void {
    if (typeof window === 'undefined') return;

    removeStoredSearchHistory();
}
