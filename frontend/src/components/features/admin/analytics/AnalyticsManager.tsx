import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp, Star, Eye, BarChart3, Table, ChevronUp, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { getApiBaseUrl } from '@/utils/network/apiBase';
import { useAuthStore } from '@/stores/session/useAuthStore';
import { PostMetricsDetail } from './PostMetricsDetail';

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

async function getEditorPicks(): Promise<EditorPick[]> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/v1/analytics/editor-picks?limit=10`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.picks ?? [];
  } catch {
    return [];
  }
}

async function getTrendingPosts(days: number = 7): Promise<TrendingPost[]> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/v1/analytics/trending?days=${days}&limit=10`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.trending ?? [];
  } catch {
    return [];
  }
}

async function refreshStats(token: string): Promise<boolean> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/v1/analytics/refresh-stats`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function EditorPicksSection() {
  const [picks, setPicks] = useState<EditorPick[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPicks = useCallback(async () => {
    setLoading(true);
    const result = await getEditorPicks();
    setPicks(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPicks();
  }, [fetchPicks]);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-700">Editor Picks</span>
        </div>
        <button
          type="button"
          onClick={fetchPicks}
          disabled={loading}
          className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-400">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Loading...
        </div>
      ) : picks.length === 0 ? (
        <p className="px-4 py-3 text-xs text-zinc-400">No editor picks configured.</p>
      ) : (
        <div className="divide-y divide-zinc-100">
          <div className="grid grid-cols-12 px-4 py-2 bg-zinc-50 border-b border-zinc-100">
            <span className="col-span-1 text-xs text-zinc-400">#</span>
            <span className="col-span-7 text-xs text-zinc-400">Post</span>
            <span className="col-span-2 text-xs text-zinc-400">Category</span>
            <span className="col-span-2 text-xs text-zinc-400 text-right">Score</span>
          </div>
          {picks.map((pick) => (
            <div key={`${pick.year}/${pick.post_slug}`} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-zinc-50">
              <span className="col-span-1 font-mono text-xs text-zinc-400">{pick.rank}</span>
              <div className="col-span-7">
                <a
                  href={`/#/blog/${pick.year}/${pick.post_slug}`}
                  className="text-xs font-medium text-zinc-800 hover:text-zinc-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {pick.title || pick.post_slug}
                </a>
                {pick.reason && (
                  <p className="text-xs text-zinc-400 mt-0.5 truncate">{pick.reason}</p>
                )}
              </div>
              <span className="col-span-2 font-mono text-xs text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded w-fit">
                {pick.category || '-'}
              </span>
              <span className="col-span-2 text-xs font-medium text-zinc-700 text-right">{pick.score}</span>
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

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    const result = await getTrendingPosts(days);
    setTrending(result);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-700">Trending Posts</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex border border-zinc-200 rounded-md overflow-hidden">
            {[7, 14, 30].map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDays(d)}
                className={`px-2 py-1 text-xs transition-colors ${
                  days === d
                    ? 'bg-zinc-900 text-white'
                    : 'bg-white text-zinc-500 hover:bg-zinc-50'
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
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-400">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Loading...
        </div>
      ) : trending.length === 0 ? (
        <p className="px-4 py-3 text-xs text-zinc-400">No trending data for this period.</p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {trending.map((post, idx) => (
            <div
              key={`${post.year}/${post.post_slug}`}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-50"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-zinc-400 w-4">{idx + 1}</span>
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
                <p className="text-xs text-zinc-400">total: {post.total_views.toLocaleString()}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatsRefreshSection() {
  const { getValidAccessToken } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setResult(null);
    const token = await getValidAccessToken();
    if (token) {
      const success = await refreshStats(token);
      setResult({
        success,
        message: success ? 'Stats refreshed successfully.' : 'Refresh failed.',
      });
      if (success) setLastRefresh(new Date());
    } else {
      setResult({ success: false, message: 'Authentication required.' });
    }
    setRefreshing(false);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
        <BarChart3 className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-semibold text-zinc-700">Stats Refresh</span>
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
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Run Refresh'}
        </button>
        {result && (
          <p className={`text-xs ${result.success ? 'text-emerald-600' : 'text-red-600'}`}>
            {result.message}
          </p>
        )}
        {lastRefresh && (
          <p className="text-xs text-zinc-400">
            Last refresh:{' '}
            <span className="font-mono">{lastRefresh.toLocaleString()}</span>
          </p>
        )}
      </div>
    </div>
  );
}

async function getAllPostStats(orderBy: string): Promise<PostStat[]> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/v1/admin/analytics/posts?orderBy=${orderBy}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.stats ?? [];
  } catch {
    return [];
  }
}

type SortField = 'total_views' | 'views_7d' | 'views_30d' | 'last_viewed_at';

function AllPostsSection() {
  const [stats, setStats] = useState<PostStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortField>('total_views');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<{ slug: string; year: string } | null>(null);
  const PAGE_SIZE = 50;

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const result = await getAllPostStats(sortBy);
    setStats(result);
    setLoading(false);
  }, [sortBy]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

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

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      type="button"
      onClick={() => { setSortBy(field); setPage(0); }}
      className="flex items-center gap-0.5 hover:text-zinc-700 transition-colors"
    >
      {label}
      {sortBy === field ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 opacity-30" />}
    </button>
  );

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Table className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-700">All Posts</span>
          <span className="font-mono text-xs text-zinc-400">({stats.length})</span>
        </div>
        <button
          type="button"
          onClick={fetchStats}
          disabled={loading}
          className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-400">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Loading...
        </div>
      ) : stats.length === 0 ? (
        <p className="px-4 py-3 text-xs text-zinc-400">No post stats recorded yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-12 px-4 py-2 bg-zinc-50 border-b border-zinc-100 text-xs text-zinc-400">
            <span className="col-span-5">Post</span>
            <span className="col-span-2 text-right"><SortButton field="total_views" label="Total" /></span>
            <span className="col-span-2 text-right"><SortButton field="views_7d" label="7d" /></span>
            <span className="col-span-2 text-right"><SortButton field="views_30d" label="30d" /></span>
            <span className="col-span-1" />
          </div>
          <div className="divide-y divide-zinc-100">
            {paginated.map((s) => (
              <div key={`${s.year}/${s.post_slug}`} className="grid grid-cols-12 px-4 py-2.5 items-center hover:bg-zinc-50 text-xs">
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
                <span className="col-span-2 text-right font-mono text-zinc-500">{Number(s.views_7d).toLocaleString()}</span>
                <span className="col-span-2 text-right font-mono text-zinc-500">{Number(s.views_30d).toLocaleString()}</span>
                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setSelected({ slug: s.post_slug, year: s.year })}
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
              <span className="text-xs text-zinc-400">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 px-2 text-xs rounded-md border border-zinc-200 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
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
          <StatsRefreshSection />
          <EditorPicksSection />
        </div>
      </div>
      <AllPostsSection />
    </div>
  );
}
