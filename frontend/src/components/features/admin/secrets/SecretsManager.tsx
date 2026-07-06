import { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  List,
  History,
} from 'lucide-react';
import { useSecretsOverview } from './hooks';
import { SecretsListManager } from './SecretsListManager';
import { AuditLogViewer } from './AuditLogViewer';
import { AdminSubtabs } from '@/components/molecules/AdminSubtabs';

type TabId = 'overview' | 'secrets' | 'audit';
type RecentActivityAction = 'created' | 'updated' | 'deleted' | 'rotated' | 'accessed';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Key className="h-3.5 w-3.5" /> },
  { id: 'secrets', label: 'All Secrets', icon: <List className="h-3.5 w-3.5" /> },
  { id: 'audit', label: 'Audit Log', icon: <History className="h-3.5 w-3.5" /> },
];
const RECENT_ACTIVITY_ACTIONS = new Set<RecentActivityAction>([
  'created',
  'updated',
  'deleted',
  'rotated',
  'accessed',
]);
const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;
const OVERVIEW_ERROR_FALLBACK = 'Failed to load secrets overview';

function normalizeSafeText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeOverviewError(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return normalizeSafeText(value, OVERVIEW_ERROR_FALLBACK);
}

function normalizeCategoryId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized || /[\u0000-\u001F\u007F/\\]/.test(normalized) || !/^[a-z0-9_-]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeActivityAction(value: unknown): RecentActivityAction | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return RECENT_ACTIVITY_ACTIONS.has(normalized as RecentActivityAction)
    ? (normalized as RecentActivityAction)
    : null;
}

function normalizeActivitySelector(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || /[\u0000-\u001F\u007F/\\]/.test(normalized) || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

interface SecretsManagerProps {
  subtab?: string;
  onSubtabChange?: (subtab: string) => void;
}

export function SecretsManager({ subtab, onSubtabChange }: SecretsManagerProps) {
  const { overview, health, loading, error, fetchOverview } = useSecretsOverview();
  const validTabs = TABS.map(t => t.id);
  const [localTab, setLocalTab] = useState<TabId>('overview');
  const activeTab: TabId =
    subtab && validTabs.includes(subtab as TabId) ? (subtab as TabId) : localTab;
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const safeError = normalizeOverviewError(error);
  const safeCategories = (overview?.categories ?? []).flatMap((cat) => {
    const id = normalizeCategoryId(cat.id);
    if (!id) return [];
    return [{
      ...cat,
      id,
      display_name: normalizeSafeText(cat.display_name, id),
      description: normalizeSafeText(cat.description),
      secret_count: normalizeCount(cat.secret_count),
    }];
  });
  const safeRecentActivity = (overview?.recentActivity ?? []).flatMap((log) => {
    const action = normalizeActivityAction(log.action);
    const secretSelector = normalizeActivitySelector(log.key_name) ?? normalizeActivitySelector(log.secret_id);
    if (!action || !secretSelector) return [];
    return [{
      ...log,
      action,
      key_name: secretSelector,
      secret_id: secretSelector,
    }];
  });

  const setActiveTab = (nextTab: string) => {
    if (!validTabs.includes(nextTab as TabId)) return;
    const tab = nextTab as TabId;
    setLocalTab(tab);
    onSubtabChange?.(tab);
    if (tab !== 'secrets') setSelectedCategoryId(null);
  };

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const missingRequired = overview?.stats?.missing_required ?? 0;
  const expiringSoon = overview?.stats?.expiring_soon ?? 0;

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <Key className="h-3.5 w-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-700">Secrets Management</span>
        </div>
        <button
          type="button"
          onClick={fetchOverview}
          disabled={loading}
          aria-label="Refresh secrets overview"
          title="Refresh secrets overview"
          className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {safeError && (
        <div className="px-4 py-2 border-b border-zinc-100 bg-red-50">
          <p className="text-xs text-red-600">{safeError}</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-100 border-b border-zinc-100">
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Shield className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400">Encryption</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                health?.status === 'healthy'
                  ? 'bg-emerald-500'
                  : health?.status === 'unhealthy'
                  ? 'bg-red-500'
                  : 'bg-zinc-400'
              }`}
            />
            <span className="text-xs font-medium text-zinc-700 capitalize">
              {normalizeSafeText(health?.encryption, 'Unknown')}
            </span>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Key className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400">Total Secrets</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-zinc-800">
              {overview?.stats?.total ?? '-'}
            </span>
            <span className="text-xs text-zinc-400">
              ({overview?.stats?.configured ?? 0} configured)
            </span>
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400">Missing Required</span>
          </div>
          {missingRequired > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded">
                {missingRequired}
              </span>
              <span className="text-xs text-zinc-400">need attention</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle className="h-3 w-3" />
              All configured
            </div>
          )}
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="h-3.5 w-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-400">Expiring Soon</span>
          </div>
          {expiringSoon > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">
                {expiringSoon}
              </span>
              <span className="text-xs text-zinc-400">in 7 days</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle className="h-3 w-3" />
              None expiring
            </div>
          )}
        </div>
      </div>

      <AdminSubtabs
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <span className="text-xs font-semibold text-zinc-700">Categories</span>
              </div>
              {safeCategories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
                  {safeCategories.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
                        setLocalTab('secrets');
                        onSubtabChange?.('secrets');
                      }}
                      className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-zinc-100 flex items-center justify-center">
                          <Key className="h-3 w-3 text-zinc-500" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-zinc-800">{cat.display_name}</p>
                          <p className="text-xs text-zinc-400">{cat.description}</p>
                        </div>
                      </div>
                      <span className="font-mono text-xs text-zinc-400 bg-zinc-100 px-1 py-0.5 rounded">
                        {cat.secret_count}
                      </span>
                    </button>
                  ))}
                </div>
              ) : !safeError ? (
                <p className="px-4 py-3 text-xs text-zinc-400">No categories found.</p>
              ) : null}
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <span className="text-xs font-semibold text-zinc-700">Recent Activity</span>
              </div>
              {safeRecentActivity.length > 0 ? (
                <div className="divide-y divide-zinc-100">
                  {safeRecentActivity.map((log) => (
                    <div key={log.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs px-1 py-0.5 rounded border ${
                            log.action === 'deleted'
                              ? 'bg-red-50 text-red-600 border-red-200'
                              : log.action === 'created'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : 'bg-zinc-100 text-zinc-600 border-zinc-200'
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="font-mono text-xs text-zinc-600">
                          {log.key_name || log.secret_id}
                        </span>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : !safeError ? (
                <p className="px-4 py-4 text-xs text-zinc-400 text-center">No recent activity.</p>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'secrets' && (
          <SecretsListManager
            categories={safeCategories}
            initialCategoryFilter={selectedCategoryId}
          />
        )}

        {activeTab === 'audit' && <AuditLogViewer />}
      </div>
    </div>
  );
}
