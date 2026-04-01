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

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <Key className="h-3.5 w-3.5" /> },
  { id: 'secrets', label: 'All Secrets', icon: <List className="h-3.5 w-3.5" /> },
  { id: 'audit', label: 'Audit Log', icon: <History className="h-3.5 w-3.5" /> },
];

interface SecretsManagerProps {
  subtab?: string;
  onSubtabChange?: (subtab: string) => void;
}

export function SecretsManager({ subtab, onSubtabChange }: SecretsManagerProps) {
  const { overview, health, loading, error, fetchOverview } = useSecretsOverview();
  const validTabs = TABS.map(t => t.id);
  const activeTab: TabId =
    subtab && validTabs.includes(subtab as TabId) ? (subtab as TabId) : 'overview';
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

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
          className="h-7 w-7 flex items-center justify-center rounded-md border border-zinc-200 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 border-b border-zinc-100 bg-red-50">
          <p className="text-xs text-red-600">{error}</p>
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
              {health?.encryption || 'Unknown'}
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
        onTabChange={(id) => {
          onSubtabChange?.(id);
          if (id !== 'secrets') setSelectedCategoryId(null);
        }}
      />

      <div className="p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <span className="text-xs font-semibold text-zinc-700">Categories</span>
              </div>
              {!overview?.categories || overview.categories.length === 0 ? (
                <p className="px-4 py-3 text-xs text-zinc-400">No categories found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-100">
                  {overview.categories.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => {
                        setSelectedCategoryId(cat.id);
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
              )}
            </div>

            <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <span className="text-xs font-semibold text-zinc-700">Recent Activity</span>
              </div>
              {!overview?.recentActivity || overview.recentActivity.length === 0 ? (
                <p className="px-4 py-4 text-xs text-zinc-400 text-center">No recent activity.</p>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {overview.recentActivity.map((log) => (
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
              )}
            </div>
          </div>
        )}

        {activeTab === 'secrets' && (
          <SecretsListManager
            categories={overview?.categories ?? []}
            initialCategoryFilter={selectedCategoryId}
          />
        )}

        {activeTab === 'audit' && <AuditLogViewer />}
      </div>
    </div>
  );
}
