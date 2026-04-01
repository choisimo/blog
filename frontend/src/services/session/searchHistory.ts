/**
 * Search History Service
 * Manages recent search queries in localStorage
 */

const STORAGE_KEY = 'blog.searchHistory';
const MAX_HISTORY = 5;

export interface SearchHistoryItem {
    query: string;
    timestamp: number;
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

        return data as SearchHistoryItem[];
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

    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    const current = getSearchHistory();

    // Remove existing entry with same query (case-insensitive)
    const filtered = current.filter(
        item => item.query.toLowerCase() !== trimmed.toLowerCase()
    );

    // Add new entry at the beginning
    const next: SearchHistoryItem[] = [
        { query: trimmed, timestamp: Date.now() },
        ...filtered,
    ].slice(0, MAX_HISTORY);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('searchHistory:update'));
}

/**
 * Remove a specific query from history
 */
export function removeSearchQuery(query: string): void {
    if (typeof window === 'undefined') return;

    const current = getSearchHistory();
    const next = current.filter(
        item => item.query.toLowerCase() !== query.toLowerCase()
    );

    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('searchHistory:update'));
}

/**
 * Clear all search history
 */
export function clearSearchHistory(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('searchHistory:update'));
}
