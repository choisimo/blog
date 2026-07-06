import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowLeft, Eye, Clock, Globe, Monitor } from 'lucide-react';
import { adminApiFetch } from '@/services/admin/apiClient';

interface Visit {
  id: number;
  ip_address: string | null;
  user_agent: string | null;
  referer: string | null;
  path: string | null;
  session_id: string | null;
  visited_at: string;
}

interface HourlyPoint {
  hour: string;
  visits: number;
}

interface VisitsData {
  visits: Visit[];
  total: number;
}

interface MetricsData {
  hourly: HourlyPoint[];
}

interface PostMetricsDetailProps {
  slug: string;
  year: string;
  onBack: () => void;
}

const ANALYTICS_SELECTOR_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function decodeSelector(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeAnalyticsSelector(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const decoded = decodeSelector(trimmed);
  if (!decoded) return null;

  if ([trimmed, decoded].some((candidate) => /[\r\n\\/]/.test(candidate))) {
    return null;
  }

  return ANALYTICS_SELECTOR_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeAnalyticsYear(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^\d{4}$/.test(trimmed) ? trimmed : null;
}

function normalizeDisplayText(value: unknown, fallback = '—'): string {
  if (typeof value !== 'string') return fallback;
  const decoded = decodeSelector(value);
  if (!decoded || /[\r\n]/.test(decoded)) return fallback;
  const cleaned = value.replace(/[\r\n]+/g, ' ').trim();
  return cleaned || fallback;
}

function normalizeVisitPath(value: unknown): string {
  if (typeof value !== 'string') return '—';
  const trimmed = value.trim();
  const decoded = decodeSelector(trimmed);
  if (!decoded || /[\r\n\\]/.test(decoded)) return '—';
  return trimmed.startsWith('/') ? trimmed : '—';
}

export function normalizeVisitRefererHost(value: unknown): string {
  if (typeof value !== 'string') return '—';

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('//')) return '—';

  const decoded = decodeSelector(trimmed);
  if (
    !decoded ||
    [trimmed, decoded].some((candidate) => /[\u0000-\u001F\u007F\s\\]/.test(candidate))
  ) {
    return '—';
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.hostname || '—'
      : '—';
  } catch {
    return '—';
  }
}

function normalizeVisitDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /[\r\n]/.test(trimmed)) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : trimmed;
}

function formatVisitDate(value: unknown): string {
  const safeDate = normalizeVisitDate(value);
  if (!safeDate) return '—';
  return new Date(safeDate).toLocaleString('en-US', {
    month: 'numeric', day: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
}

function normalizeHourlyPoint(point: HourlyPoint): HourlyPoint | null {
  const safeHour = normalizeVisitDate(point.hour);
  if (!safeHour) return null;
  return {
    hour: safeHour,
    visits: Number.isFinite(Number(point.visits)) ? Number(point.visits) : 0,
  };
}

function parseBrowserName(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR')) return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('OPR') || ua.includes('Opera')) return 'Opera';
  if (ua.includes('curl')) return 'curl';
  if (ua.includes('bot') || ua.includes('Bot') || ua.includes('spider')) return 'Bot';
  return 'Other';
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function HourlyChart({ data }: { data: HourlyPoint[] }) {
  if (data.length === 0) {
    return <p className="text-xs text-zinc-400 py-4 text-center">No hourly data</p>;
  }
  const max = Math.max(...data.map(d => Number(d.visits)), 1);
  return (
    <div className="flex items-end gap-0.5 h-20 w-full">
      {data.map((point) => {
        const height = Math.max(4, (Number(point.visits) / max) * 80);
        const safeHour = normalizeVisitDate(point.hour);
        const label = safeHour
          ? new Date(safeHour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
          : '—';
        return (
          <div
            key={point.hour}
            className="flex-1 group relative"
            title={`${label}: ${point.visits} visits`}
          >
            <div
              className="w-full bg-zinc-300 group-hover:bg-zinc-500 rounded-sm transition-colors"
              style={{ height: `${height}px` }}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-zinc-900 text-white text-xs px-1.5 py-0.5 rounded whitespace-nowrap z-10">
              {label}: {point.visits}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PostMetricsDetail({ slug, year, onBack }: PostMetricsDetailProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [total, setTotal] = useState(0);
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const PAGE_SIZE = 50;
  const safeYear = normalizeAnalyticsYear(year);
  const safeSlug = normalizeAnalyticsSelector(slug);

  const fetchData = useCallback(async (pageNum: number) => {
    if (!safeYear || !safeSlug) {
      setVisits([]);
      setTotal(0);
      setHourly([]);
      setError('Invalid post analytics selector');
      setMetricsError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    if (pageNum === 0) setMetricsError(null);
    const offset = pageNum * PAGE_SIZE;
    const postPath = `/posts/${encodeURIComponent(safeYear)}/${encodeURIComponent(safeSlug)}`;

    try {
      const [visitsResult, metricsResult] = await Promise.all([
        adminApiFetch<VisitsData>(
          `${postPath}/visits?limit=${PAGE_SIZE}&offset=${offset}`,
          { pathPrefix: '/api/v1/admin/analytics' },
        ),
        pageNum === 0
          ? adminApiFetch<MetricsData>(
              `${postPath}/metrics`,
              { pathPrefix: '/api/v1/admin/analytics' },
            )
          : Promise.resolve(null),
      ]);

      if (!visitsResult.ok || !visitsResult.data) {
        throw new Error(visitsResult.error || 'Failed to load visit logs');
      }

      setVisits(visitsResult.data.visits ?? []);
      setTotal(visitsResult.data.total ?? 0);

      if (metricsResult) {
        if (metricsResult.ok && metricsResult.data) {
          setHourly(
            (metricsResult.data.hourly ?? [])
              .map(normalizeHourlyPoint)
              .filter((point): point is HourlyPoint => point !== null),
          );
          setMetricsError(null);
        } else {
          setHourly([]);
          setMetricsError(metricsResult.error || 'Failed to load hourly traffic');
        }
      }
    } catch (err) {
      setVisits([]);
      setTotal(0);
      if (pageNum === 0) {
        setHourly([]);
        setMetricsError(null);
      }
      setError(getErrorMessage(err, 'Failed to load visit logs'));
    } finally {
      setLoading(false);
    }
  }, [safeSlug, safeYear]);

  useEffect(() => {
    fetchData(page);
  }, [fetchData, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to all posts
        </button>
        <span className="text-zinc-300">|</span>
        <span className="font-mono text-xs text-zinc-700 font-semibold">
          {safeYear ?? 'invalid'}/{safeSlug ?? 'invalid'}
        </span>
        <div className="flex items-center gap-1 text-xs text-zinc-500">
          <Eye className="h-3 w-3" />
          <span className="font-semibold text-zinc-800">{total.toLocaleString()}</span> total visits
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-4">
        <p className="text-xs font-semibold text-zinc-600 mb-3">Last 7 days — hourly traffic</p>
        {metricsError ? (
          <div className="space-y-1 py-4 text-center">
            <p className="text-xs font-medium text-red-600">{metricsError}</p>
            <p className="text-xs text-zinc-400">Unable to load hourly traffic.</p>
          </div>
        ) : (
          <HourlyChart data={hourly} />
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-700">Visitor Log</span>
            <span className="font-mono text-xs text-zinc-400">({total.toLocaleString()} total)</span>
          </div>
          <button
            type="button"
            onClick={() => fetchData(page)}
            disabled={loading}
            aria-label="Refresh visitor log"
            title="Refresh visitor log"
            className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-4 py-3 text-xs text-zinc-400">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Loading...
          </div>
        ) : error ? (
          <div className="px-4 py-3 space-y-1">
            <p className="text-xs font-medium text-red-600">{error}</p>
            <p className="text-xs text-zinc-400">Unable to load visitor log.</p>
          </div>
        ) : visits.length === 0 ? (
          <p className="px-4 py-3 text-xs text-zinc-400">No visits recorded yet.</p>
        ) : (
          <>
            <div className="grid grid-cols-12 px-4 py-2 bg-zinc-50 border-b border-zinc-100">
              <span className="col-span-2 text-xs text-zinc-400">IP</span>
              <span className="col-span-3 text-xs text-zinc-400">Browser</span>
              <span className="col-span-3 text-xs text-zinc-400">Referer</span>
              <span className="col-span-2 text-xs text-zinc-400">Path</span>
              <span className="col-span-2 text-xs text-zinc-400 text-right">Time</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {visits.map((v) => (
                <div key={v.id} className="grid grid-cols-12 px-4 py-2 items-center hover:bg-zinc-50 text-xs">
                  <span className="col-span-2 font-mono text-zinc-600 truncate" title={normalizeDisplayText(v.ip_address)}>
                    {normalizeDisplayText(v.ip_address)}
                  </span>
                  <div className="col-span-3 flex items-center gap-1 text-zinc-500">
                    <Monitor className="h-3 w-3 shrink-0" />
                    <span className="truncate">{parseBrowserName(v.user_agent)}</span>
                  </div>
                  <span className="col-span-3 text-zinc-400 truncate" title={normalizeVisitRefererHost(v.referer)}>
                    {normalizeVisitRefererHost(v.referer)}
                  </span>
                  <span className="col-span-2 font-mono text-zinc-400 truncate" title={normalizeVisitPath(v.path)}>
                    {normalizeVisitPath(v.path)}
                  </span>
                  <div className="col-span-2 flex items-center justify-end gap-1 text-zinc-400">
                    <Clock className="h-3 w-3" />
                    <span className="font-mono">
                      {formatVisitDate(v.visited_at)}
                    </span>
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
    </div>
  );
}
