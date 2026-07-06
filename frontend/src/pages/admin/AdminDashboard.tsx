import { lazy, Suspense, type KeyboardEvent, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  Settings,
  Cloud,
  Bot,
  Key,
  Database,
  Activity,
  BarChart3,
  FileText,
  LogOut,
  Server,
  ScrollText,
} from 'lucide-react';

const ConfigManager = lazy(() => import('@/components/features/admin/ConfigManager').then(m => ({ default: m.ConfigManager })));
const WorkersManager = lazy(() => import('@/components/features/admin/WorkersManager').then(m => ({ default: m.WorkersManager })));
const AIManager = lazy(() => import('@/components/features/admin/ai').then(m => ({ default: m.AIManager })));
const SecretsManager = lazy(() => import('@/components/features/admin/secrets').then(m => ({ default: m.SecretsManager })));
const RAGManager = lazy(() => import('@/components/features/admin/rag').then(m => ({ default: m.RAGManager })));
const SystemHealth = lazy(() => import('@/components/features/admin/health').then(m => ({ default: m.SystemHealth })));
const AnalyticsManager = lazy(() => import('@/components/features/admin/analytics').then(m => ({ default: m.AnalyticsManager })));
const LogViewer = lazy(() => import('@/components/features/admin/logs').then(m => ({ default: m.LogViewer })));
const ContentManager = lazy(() => import('@/components/features/admin/content').then(m => ({ default: m.ContentManager })));

type NavTab =
  | 'health'
  | 'rag'
  | 'analytics'
  | 'logs'
  | 'content'
  | 'ai'
  | 'config'
  | 'secrets'
  | 'workers';

const NAV_TABS: {
  id: NavTab;
  label: string;
  icon: ReactNode;
  group?: 'infra' | 'ops' | 'config';
}[] = [
  {
    id: 'health',
    label: 'Health',
    icon: <Activity className='h-3.5 w-3.5' />,
    group: 'infra',
  },
  {
    id: 'rag',
    label: 'RAG',
    icon: <Database className='h-3.5 w-3.5' />,
    group: 'infra',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className='h-3.5 w-3.5' />,
    group: 'ops',
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: <ScrollText className='h-3.5 w-3.5' />,
    group: 'ops',
  },
  {
    id: 'content',
    label: 'Content',
    icon: <FileText className='h-3.5 w-3.5' />,
    group: 'ops',
  },
  {
    id: 'ai',
    label: 'AI',
    icon: <Bot className='h-3.5 w-3.5' />,
    group: 'config',
  },
  {
    id: 'config',
    label: 'Env',
    icon: <Settings className='h-3.5 w-3.5' />,
    group: 'config',
  },
  {
    id: 'secrets',
    label: 'Secrets',
    icon: <Key className='h-3.5 w-3.5' />,
    group: 'config',
  },
  {
    id: 'workers',
    label: 'Workers',
    icon: <Cloud className='h-3.5 w-3.5' />,
    group: 'config',
  },
];

interface AdminDashboardProps {
  userEmail?: string;
  onLogout: () => void;
}

function isNavTab(value: string | undefined): value is NavTab {
  return value !== undefined && NAV_TABS.some(tab => tab.id === value);
}

function normalizeAdminSubtab(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    /[\r\n/\\]/.test(normalized) ||
    /%(?:0a|0d|2f|5c)/i.test(normalized) ||
    !/^[a-z0-9-]+$/.test(normalized)
  ) {
    return undefined;
  }
  return normalized;
}

function normalizeAdminDisplayText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, 160) : null;
}

export function AdminDashboard({ userEmail, onLogout }: AdminDashboardProps) {
  const navigate = useNavigate();
  const { section, subtab } = useParams<{ section?: string; subtab?: string }>();

  if (!isNavTab(section)) {
    return <Navigate to='/admin/config/health' replace />;
  }

  const activeTab = section;
  const activeSubtab = normalizeAdminSubtab(subtab);
  if (subtab !== undefined && !activeSubtab) {
    return <Navigate to={`/admin/config/${activeTab}`} replace />;
  }
  const activeTabIndex = NAV_TABS.findIndex(tab => tab.id === activeTab);
  const safeUserEmail = normalizeAdminDisplayText(userEmail);

  const setActiveTab = (tab: NavTab) => {
    if (tab === activeTab) return;
    navigate(`/admin/config/${tab}`, { replace: false });
  };

  const focusNavTab = (index: number) => {
    const focus = () => {
      const buttons = document.querySelectorAll<HTMLButtonElement>(
        '[data-admin-nav-tab]',
      );
      buttons[index]?.focus();
    };

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(focus);
      return;
    }

    window.setTimeout(focus, 0);
  };

  const activateNavTabAt = (index: number) => {
    const tab = NAV_TABS[index];
    if (!tab) return;
    setActiveTab(tab.id);
    focusNavTab(index);
  };

  const navigateToSubtab = (sectionId: NavTab, nextSubtab: string) => {
    const normalizedSubtab = normalizeAdminSubtab(nextSubtab);
    if (!normalizedSubtab) return;
    navigate(`/admin/config/${sectionId}/${normalizedSubtab}`, { replace: true });
  };

  const handleNavKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      activateNavTabAt((index + 1) % NAV_TABS.length);
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      activateNavTabAt((index - 1 + NAV_TABS.length) % NAV_TABS.length);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      activateNavTabAt(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      activateNavTabAt(NAV_TABS.length - 1);
    }
  };

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-zinc-950'>
      {/* ── Sticky Top Bar ── */}
      <header className='sticky top-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm'>
        <div className='flex items-center justify-between px-3 h-11'>
          {/* Left: Brand + Nav */}
          <div className='flex items-center gap-1 min-w-0'>
            {/* Brand */}
            <div className='flex items-center gap-1.5 mr-2 shrink-0'>
              <div className='flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-100'>
                <Server className='h-3 w-3 text-white dark:text-zinc-900' />
              </div>
              <span className='text-xs font-bold text-zinc-800 dark:text-zinc-200 tracking-tight hidden sm:inline'>
                noblog admin
              </span>
            </div>

            {/* Divider */}
            <div className='h-4 w-px bg-zinc-200 dark:bg-zinc-700 shrink-0 hidden sm:block' aria-hidden='true' />

            {/* Nav tabs — scrollable on narrow screens */}
            <nav
              className='flex items-center gap-0.5 overflow-x-auto scrollbar-hide'
              aria-label='Admin navigation'
              role='tablist'
            >
              {NAV_TABS.map((tab, index) => (
                <button
                  key={tab.id}
                  id={`admin-tab-${tab.id}`}
                  data-admin-nav-tab
                  type='button'
                  role='tab'
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={event => handleNavKeyDown(event, index)}
                  aria-controls={`admin-panel-${tab.id}`}
                  aria-label={tab.label}
                  aria-selected={activeTab === tab.id}
                  tabIndex={index === activeTabIndex ? 0 : -1}
                  className={`
                    admin-nav-btn
                    relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md
                    whitespace-nowrap min-h-[32px] min-w-[32px]
                    transition-all duration-150
                    outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 focus-visible:ring-offset-1
                    ${
                      activeTab === tab.id
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 active:scale-95'
                    }
                  `}
                >
                  {tab.icon}
                  <span className='hidden md:inline'>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Right: User + Logout */}
          <div className='flex items-center gap-1.5 shrink-0 ml-2'>
            {safeUserEmail && (
              <span className='hidden sm:inline font-mono text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700 max-w-[160px] truncate'>
                {safeUserEmail}
              </span>
            )}
            <button
              type='button'
              onClick={onLogout}
              aria-label='Logout'
              className='flex items-center gap-1 text-xs text-zinc-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors min-h-[32px] px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 outline-none'
            >
              <LogOut className='h-3.5 w-3.5' />
              <span className='hidden sm:inline'>Logout</span>
            </button>
          </div>
        </div>

        {/* ── Mobile: active tab label indicator ── */}
        <div className='sm:hidden flex items-center gap-1.5 px-3 pb-2'>
          <span className='text-xs text-zinc-400 dark:text-zinc-500'>
            {NAV_TABS.find(t => t.id === activeTab)?.icon}
          </span>
          <span className='text-xs font-medium text-zinc-700 dark:text-zinc-300 capitalize'>
            {NAV_TABS.find(t => t.id === activeTab)?.label}
          </span>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className='p-3 md:p-4 max-w-screen-2xl mx-auto'>
        {/* Tab content with fade-in on switch */}
        <div
          id={`admin-panel-${activeTab}`}
          className='admin-tab-content'
          role='tabpanel'
          aria-labelledby={`admin-tab-${activeTab}`}
        >
          <Suspense fallback={<div className='flex items-center justify-center py-12'><div className='h-5 w-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin' /></div>}>
          {activeTab === 'health' && <SystemHealth />}
          {activeTab === 'rag' && <RAGManager />}
          {activeTab === 'analytics' && <AnalyticsManager />}
          {activeTab === 'logs' && <LogViewer />}
          {activeTab === 'content' && (
            <ContentManager
              subtab={activeSubtab}
              onSubtabChange={nextSubtab =>
                navigateToSubtab('content', nextSubtab)
              }
            />
          )}
          {activeTab === 'ai' && (
            <AIManager
              subtab={activeSubtab}
              onSubtabChange={nextSubtab => navigateToSubtab('ai', nextSubtab)}
            />
          )}
          {activeTab === 'config' && <ConfigManager />}
          {activeTab === 'secrets' && (
            <SecretsManager
              subtab={activeSubtab}
              onSubtabChange={nextSubtab =>
                navigateToSubtab('secrets', nextSubtab)
              }
            />
          )}
          {activeTab === 'workers' && (
            <WorkersManager
              subtab={activeSubtab}
              onSubtabChange={nextSubtab =>
                navigateToSubtab('workers', nextSubtab)
              }
            />
          )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
