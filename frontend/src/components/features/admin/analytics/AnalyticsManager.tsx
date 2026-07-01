import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Star,
  Eye,
  BarChart3,
  Table,
  Users,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
} from "lucide-react";
import { getApiBaseUrl } from "@/utils/network/apiBase";
import { adminApiFetch, adminFetchRaw } from "@/services/admin/apiClient";
import { getRealtimeVisitorsSnapshot } from "@/services/content/analytics";
import { PostMetricsDetail } from "./PostMetricsDetail";

interface PostStat {
  post_slug: string;
  year: string;
  total_views: number;
  views_7d: number;
  views_30d: number;
  last_viewed_at: string | null;
}

interface EditorPick {
  post_slug: string;
  year: string;
  title: string;
  cover_image: string | null;
  category: string | null;
  rank: number;
  score: number;
  reason: string | null;
  is_active: number;
  expires_at: string | null;
}

interface TrendingPost {
  post_slug: string;
  year: string;
  recent_views: number;
  total_views: number;
}

interface PostStatsResult {
  stats: PostStat[];
  errorMessage?: string;
}

interface EditorPicksResult {
  picks: EditorPick[];
  errorMessage?: string;
}

interface StatsRefreshResult {
  success: boolean;
  message: string;
}

function getAnalyticsErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as { error?: unknown; message?: unknown };
  if (typeof record.error === "string" && record.error) return record.error;
  if (record.error && typeof record.error === "object") {
    const nested = record.error as { message?: unknown; code?: unknown };
    if (typeof nested.message === "string" && nested.message) {
      return nested.message;
    }
    if (typeof nested.code === "string" && nested.code) return nested.code;
  }
  if (typeof record.message === "string" && record.message) {
    return record.message;
  }
  return fallback;
}

async function getEditorPicksResult(): Promise<EditorPicksResult> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/v1/analytics/editor-picks?limit=10`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        picks: [],
        errorMessage: getAnalyticsErrorMessage(
          data,
          "Failed to load editor picks",
        ),
      };
    }
    return { picks: data.data?.picks ?? [] };
  } catch (err) {
    return {
      picks: [],
      errorMessage:
        err instanceof Error ? err.message : "Failed to load editor picks",
    };
  }
}

async function getTrendingPosts(
  days: number = 7,
  offset: number = 0,
): Promise<{ trending: TrendingPost[]; total: number; degraded?: boolean; errorMessage?: string }> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(
      `${base}/api/v1/analytics/trending?days=${days}&limit=10&offset=${offset}`,
    );
    const data = await res.json();
    if (!res.ok) {
      return {
        trending: [],
        total: 0,
        degraded: Boolean(data?.degraded),
        errorMessage: data?.error?.message || "Analytics backend unavailable",
      };
    }
    return {
      trending: data.data?.trending ?? [],
      total: data.data?.total ?? 0,
      degraded: Boolean(data?.degraded),
    };
  } catch {
    return { trending: [], total: 0, degraded: true, errorMessage: "Analytics backend unavailable" };
  }
}

async function refreshStats(): Promise<StatsRefreshResult> {
  const base = getApiBaseUrl();
  try {
    const res = await adminFetchRaw(`${base}/api/v1/analytics/refresh-stats`, {
      method: "POST",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        message: getAnalyticsErrorMessage(data, "Refresh failed."),
      };
    }
    return {
      success: true,
      message: data.data?.message || "Stats refreshed successfully.",
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "Refresh failed.",
    };
  }
}

function RealtimeVisitorsSection() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeVisitors, setActiveVisitors] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [degradedMessage, setDegradedMessage] = useState<string | null>(null);

  const fetchVisitors = useCallback(
    async (reason: "initial" | "refresh" = "refresh") => {
      if (reason === "initial") {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const result = await getRealtimeVisitorsSnapshot();
      setActiveVisitors(result.data.activeVisitors);
      setLastUpdated(result.data.timestamp ?? Date.now());
      setDegradedMessage(
        result.degraded
          ? result.errorMessage || "Realtime visitor analytics unavailable"
          : null
      );
      setLoading(false);
      setRefreshing(false);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const clearTimer = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const sync = () => {
      if (cancelled || document.hidden) {
        return;
      }
      void fetchVisitors("refresh");
    };

    void fetchVisitors("initial");
    intervalId = setInterval(sync, 30000);

    const handleVisibilityChange = () => {
      if (cancelled) return;
      if (document.hidden) {
        clearTimer();
        return;
      }
      void fetchVisitors("refresh");
      if (!intervalId) {
        intervalId = setInterval(sync, 30000);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchVisitors]);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-700">
            Realtime Visitors
          </span>
        </div>
        <button
          type="button"
          onClick={() => void fetchVisitors("refresh")}
          disabled={loading || refreshing}
          className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          aria-label="Refresh realtime visitors"
        >
          <RefreshCw
            className={`h-3 w-3 ${
              loading || refreshing ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>
      {degradedMessage && (
        <div className="px-4 py-2 border-b border-amber-100 bg-amber-50 text-xs text-amber-700">
          {degradedMessage}
        </div>
      )}
      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Loading...
          </div>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <span className="font-mono text-2xl font-semibold text-zinc-900">
                {activeVisitors.toLocaleString()}
              </span>
              <span className="pb-0.5 text-xs text-zinc-400">
                active within 60s
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Best-effort signal backed by heartbeat writes and KV-based reads.
            </p>
            {lastUpdated && (
              <p className="text-xs text-zinc-400">
                Last updated:{" "}
                <span className="font-mono">
                  {new Date(lastUpdated).toLocaleString()}
                </span>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function EditorPicksSection() {
  const [picks, setPicks] = useState<EditorPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formSlug, setFormSlug] = useState("");
  const [formYear, setFormYear] = useState("");
  const [formRank, setFormRank] = useState("");
  const [formReason, setFormReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const fetchPicks = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await getEditorPicksResult();
    setPicks(result.picks);
    setLoadError(result.errorMessage ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPicks();
  }, [fetchPicks]);

  const handleRemove = async (year: string, slug: string) => {
    setRemoveError(null);
    const base = getApiBaseUrl();
    try {
      const res = await adminFetchRaw(
        `${base}/api/v1/analytics/admin/editor-picks/${year}/${slug}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setRemoveError("Failed to remove pick.");
        return;
      }
      await fetchPicks();
    } catch {
      setRemoveError("Failed to remove pick.");
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);
    const base = getApiBaseUrl();
    try {
      const body: {
        post_slug: string;
        year: string;
        rank?: number;
        reason?: string;
      } = { post_slug: formSlug.trim(), year: formYear.trim() };
      if (formRank) body.rank = parseInt(formRank, 10);
      if (formReason.trim()) body.reason = formReason.trim();
      const res = await adminFetchRaw(
        `${base}/api/v1/analytics/admin/editor-picks`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        setFormError("Failed to add pick.");
        setFormSubmitting(false);
        return;
      }
      setFormSlug("");
      setFormYear("");
      setFormRank("");
      setFormReason("");
      setShowAddForm(false);
      await fetchPicks();
    } catch {
      setFormError("Failed to add pick.");
    }
    setFormSubmitting(false);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-700">
            Editor Picks
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setShowAddForm((v) => !v);
              setFormError(null);
            }}
            className="h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
          >
            Add Pick
          </button>
          <button
            type="button"
            onClick={fetchPicks}
            disabled={loading}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="px-4 py-3 border-b border-zinc-100 space-y-2"
        >
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value)}
              placeholder="post-slug"
              required
              className="flex-1 min-w-0 h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
            />
            <input
              type="text"
              value={formYear}
              onChange={(e) => setFormYear(e.target.value)}
              placeholder="2025"
              required
              className="w-20 h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
            />
            <input
              type="number"
              value={formRank}
              onChange={(e) => setFormRank(e.target.value)}
              placeholder="1"
              min={1}
              max={99}
              className="w-16 h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
            />
          </div>
          <input
            type="text"
            value={formReason}
            onChange={(e) => setFormReason(e.target.value)}
            placeholder="Reason..."
            className="w-full h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-700 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
          />
          {formError && (
            <p className="text-xs text-red-500">{formError}</p>
          )}
          <div className="flex gap-1.5">
            <button
              type="submit"
              disabled={formSubmitting}
              className="h-7 px-2 text-xs rounded-md bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {formSubmitting ? "Saving..." : "Submit"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setFormError(null);
              }}
              className="h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {removeError && (
        <p className="px-4 py-2 text-xs text-red-500">{removeError}</p>
      )}
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-400">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Loading...
        </div>
      ) : loadError ? (
        <div className="px-4 py-3 text-xs text-red-700 bg-red-50 border-t border-red-100">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="font-medium">Unable to load editor picks</p>
                <p>{loadError}</p>
              </div>
              <button
                type="button"
                aria-label="Retry editor picks"
                onClick={fetchPicks}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : picks.length === 0 ? (
        <p className="px-4 py-3 text-xs text-zinc-400">
          No editor picks configured.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          <div className="grid grid-cols-12 px-4 py-2 bg-zinc-50 border-b border-zinc-100">
            <span className="col-span-1 text-xs text-zinc-400">#</span>
            <span className="col-span-6 text-xs text-zinc-400">Post</span>
            <span className="col-span-2 text-xs text-zinc-400">Category</span>
            <span className="col-span-2 text-xs text-zinc-400 text-right">
              Score
            </span>
            <span className="col-span-1" />
          </div>
          {picks.map((pick) => (
            <div
              key={`${pick.year}/${pick.post_slug}`}
              className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-zinc-50"
            >
              <span className="col-span-1 font-mono text-xs text-zinc-400">
                {pick.rank}
              </span>
              <div className="col-span-6">
                <a
                  href={`/#/blog/${pick.year}/${pick.post_slug}`}
                  className="text-xs font-medium text-zinc-800 hover:text-zinc-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {pick.title || pick.post_slug}
                </a>
                {pick.reason && (
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">
                    {pick.reason}
                  </p>
                )}
              </div>
              <span className="col-span-2 font-mono text-xs text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded w-fit">
                {pick.category || "-"}
              </span>
              <span className="col-span-2 text-xs font-medium text-zinc-700 text-right">
                {pick.score}
              </span>
              <div className="col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRemove(pick.year, pick.post_slug)}
                  className="text-xs text-red-400 hover:text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendingPostsSection() {
  const [trending, setTrending] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [degradedMessage, setDegradedMessage] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    const result = await getTrendingPosts(days, page * PAGE_SIZE);
    setTrending(result.trending);
    setTotal(result.total);
    setDegradedMessage(result.degraded ? result.errorMessage || "Analytics backend unavailable" : null);
    setLoading(false);
  }, [days, page]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const offset = page * PAGE_SIZE;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-700">
            Trending Posts
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex border border-zinc-200 rounded-md overflow-hidden">
            {[7, 14, 30].map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => {
                  setDays(d);
                  setPage(0);
                }}
                className={`px-2 py-1 text-xs transition-colors ${
                  days === d
                    ? "bg-zinc-900 text-white"
                    : "bg-white text-zinc-500 hover:bg-zinc-50"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={fetchTrending}
            disabled={loading}
            className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      {degradedMessage && (
        <div className="px-4 py-2 border-b border-amber-100 bg-amber-50 text-xs text-amber-700">
          {degradedMessage}
        </div>
      )}
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-400">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Loading...
        </div>
      ) : trending.length === 0 ? (
        <p className="px-4 py-3 text-xs text-zinc-400">
          No trending data for this period.
        </p>
      ) : (
        <>
          <div className="divide-y divide-zinc-100">
            {trending.map((post, idx) => (
              <div
                key={`${post.year}/${post.post_slug}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-zinc-400 w-4">
                    {offset + idx + 1}
                  </span>
                  <div>
                    <a
                      href={`/#/blog/${post.year}/${post.post_slug}`}
                      className="text-xs font-medium text-zinc-800 hover:text-zinc-600 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {post.post_slug}
                    </a>
                    <p className="text-xs text-zinc-400">{post.year}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs font-medium text-zinc-700">
                    <Eye className="h-3 w-3 text-zinc-400" />
                    {post.recent_views.toLocaleString()}
                  </div>
                  <p className="text-xs text-zinc-400">
                    total: {post.total_views.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100">
              <span className="text-xs text-zinc-400">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
                  className="h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function StatsRefreshSection() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setResult(null);
    const refreshResult = await refreshStats();
    setResult(refreshResult);
    if (refreshResult.success) setLastRefresh(new Date());
    setRefreshing(false);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
        <BarChart3 className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-700">
          Stats Refresh
        </span>
      </div>
      <div className="px-4 py-3 space-y-3">
        <p className="text-xs text-zinc-400">
          Manually trigger 7-day and 30-day view count aggregation.
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 h-8 px-3 text-xs font-medium rounded-md bg-zinc-900 hover:bg-zinc-800 text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Refreshing..." : "Run Refresh"}
        </button>
        {result && (
          <p
            className={`text-xs ${result.success ? "text-emerald-600" : "text-red-600"}`}
          >
            {result.message}
          </p>
        )}
        {lastRefresh && (
          <p className="text-xs text-zinc-400">
            Last refresh:{" "}
            <span className="font-mono">{lastRefresh.toLocaleString()}</span>
          </p>
        )}
      </div>
    </div>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export async function getAllPostStatsResult(
  orderBy: string,
): Promise<PostStatsResult> {
  const result = await adminApiFetch<{ stats?: PostStat[] }>(
    `/posts?orderBy=${encodeURIComponent(orderBy)}`,
    { pathPrefix: "/api/v1/admin/analytics" },
  );
  if (!result.ok) {
    return {
      stats: [],
      errorMessage: result.error || "Failed to load post stats",
    };
  }
  return { stats: result.data?.stats ?? [] };
}

// eslint-disable-next-line react-refresh/only-export-components
export async function getAllPostStats(orderBy: string): Promise<PostStat[]> {
  return (await getAllPostStatsResult(orderBy)).stats;
}

type SortField = "total_views" | "views_7d" | "views_30d" | "last_viewed_at";

export function AllPostsSection() {
  const [stats, setStats] = useState<PostStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("total_views");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{
    slug: string;
    year: string;
  } | null>(null);
  const PAGE_SIZE = 10;

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    const result = await getAllPostStatsResult(sortBy);
    setStats(result.stats);
    setErrorMessage(result.errorMessage ?? null);
    setLoading(false);
  }, [sortBy]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (selected) {
    return (
      <PostMetricsDetail
        slug={selected.slug}
        year={selected.year}
        onBack={() => setSelected(null)}
      />
    );
  }

  const paginated = stats.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(stats.length / PAGE_SIZE);

  const SortButton = ({
    field,
    label,
  }: {
    field: SortField;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => {
        setSortBy(field);
        setPage(0);
      }}
      className="flex items-center gap-0.5 hover:text-zinc-700 transition-colors"
    >
      {label}
      {sortBy === field ? (
        <ChevronDownIcon className="h-3 w-3" />
      ) : (
        <ChevronUp className="h-3 w-3 opacity-30" />
      )}
    </button>
  );

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Table className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-700">All Posts</span>
          <span className="font-mono text-xs text-zinc-400">
            ({stats.length})
          </span>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-400">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Loading...
        </div>
      ) : errorMessage ? (
        <div className="px-4 py-3 text-xs text-red-700 bg-red-50 border-t border-red-100">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="font-medium">Unable to load post stats</p>
                <p>{errorMessage}</p>
              </div>
              <button
                type="button"
                aria-label="Retry post stats"
                onClick={fetchStats}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : stats.length === 0 ? (
        <p className="px-4 py-3 text-xs text-zinc-400">
          No post stats recorded yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-12 px-4 py-2 bg-zinc-50 border-b border-zinc-100 text-xs text-zinc-400">
            <span className="col-span-5">Post</span>
            <span className="col-span-2 text-right">
              <SortButton field="total_views" label="Total" />
            </span>
            <span className="col-span-2 text-right">
              <SortButton field="views_7d" label="7d" />
            </span>
            <span className="col-span-2 text-right">
              <SortButton field="views_30d" label="30d" />
            </span>
            <span className="col-span-1" />
          </div>
          <div className="divide-y divide-zinc-100">
            {paginated.map((s) => (
              <div
                key={`${s.year}/${s.post_slug}`}
                className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-zinc-50 text-xs"
              >
                <div className="col-span-5">
                  <a
                    href={`/#/blog/${s.year}/${s.post_slug}`}
                    className="font-medium text-zinc-800 hover:text-zinc-600 hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.post_slug}
                  </a>
                  <p className="text-zinc-400 font-mono">{s.year}</p>
                </div>
                <div className="col-span-2 text-right font-mono text-zinc-700 flex items-center justify-end gap-1">
                  <Eye className="h-3 w-3 text-zinc-400" />
                  {Number(s.total_views).toLocaleString()}
                </div>
                <span className="col-span-2 text-right font-mono text-zinc-500">
                  {Number(s.views_7d).toLocaleString()}
                </span>
                <span className="col-span-2 text-right font-mono text-zinc-500">
                  {Number(s.views_30d).toLocaleString()}
                </span>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setSelected({ slug: s.post_slug, year: s.year })
                    }
                    className="text-xs text-zinc-400 hover:text-zinc-700 hover:underline"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100">
              <span className="text-xs text-zinc-400">
                Page {page + 1} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                  disabled={page >= totalPages - 1}
                  className="h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AnalyticsManager() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <TrendingPostsSection />
        <div className="space-y-4">
          <RealtimeVisitorsSection />
          <StatsRefreshSection />
          <EditorPicksSection />
        </div>
      </div>
      <AllPostsSection />
    </div>
  );
}
