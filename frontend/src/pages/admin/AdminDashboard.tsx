import { lazy, Suspense, type KeyboardEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
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
  ScrollText,
} from 'lucide-react';

import { WorkspaceShell } from '@/components/organisms/layout';

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
    icon: <Activity className="h-3.5 w-3.5" />,
    group: 'infra',
  },
  {
    id: 'rag',
    label: 'RAG',
    icon: <Database className="h-3.5 w-3.5" />,
    group: 'infra',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className="h-3.5 w-3.5" />,
    group: 'ops',
  },
  {
    id: 'logs',
    label: 'Logs',
    icon: <ScrollText className="h-3.5 w-3.5" />,
    group: 'ops',
  },
  {
    id: 'content',
    label: 'Content',
    icon: <FileText className="h-3.5 w-3.5" />,
    group: 'ops',
  },
  {
    id: 'ai',
    label: 'AI',
    icon: <Bot className="h-3.5 w-3.5" />,
    group: 'config',
  },
  {
    id: 'config',
    label: 'Env',
    icon: <Settings className="h-3.5 w-3.5" />,
    group: 'config',
  },
  {
    id: 'secrets',
    label: 'Secrets',
    icon: <Key className="h-3.5 w-3.5" />,
    group: 'config',
  },
  {
    id: 'workers',
    label: 'Workers',
    icon: <Cloud className="h-3.5 w-3.5" />,
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

const ADMIN_DISPLAY_ESCAPE_SEQUENCE_PATTERN =
  /\u001B(?:\][\s\S]*?(?:\u0007|\u001B\\|$)|\[[0-?]*[ -/]*(?:[@-~]|$))/g;

function normalizeAdminDisplayText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(ADMIN_DISPLAY_ESCAPE_SEQUENCE_PATTERN, ' ')
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
    <WorkspaceShell className="ui-admin-workspace" header={
      <header className="ui-admin-topbar">
        <Link className="ui-wordmark" to='/' aria-label='블로그 홈'>noblog <span>admin</span></Link>
        <div className="ui-admin-account">
          {safeUserEmail && <span className="ui-account-name" title={safeUserEmail}>{safeUserEmail}</span>}
          <button type='button' onClick={onLogout} className="ui-plain-button" aria-label='Logout'>
            <LogOut aria-hidden='true' size={16} /><span>로그아웃</span>
          </button>
        </div>
      </header>
    } navigation={
      <aside className="ui-admin-navigation">
        <p className="ui-nav-caption">관리 작업공간</p>
        <nav className="ui-admin-sidebar" role='tablist' aria-label='Admin navigation' aria-orientation='vertical'>
          {NAV_TABS.map((tab, index) => (
            <button key={tab.id} id={`admin-tab-${tab.id}`} data-admin-nav-tab
              type='button' role='tab' onClick={() => setActiveTab(tab.id)}
              onKeyDown={event => handleNavKeyDown(event, index)}
              aria-controls={`admin-panel-${tab.id}`} aria-label={tab.label}
              aria-selected={activeTab === tab.id} tabIndex={index === activeTabIndex ? 0 : -1}
              className="ui-admin-nav-item">
              <span aria-hidden='true'>{tab.icon}</span><span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="ui-admin-mobile-nav">
          <label htmlFor='admin-section-select'>관리 섹션</label>
          <select id='admin-section-select' value={activeTab} onChange={event => {
            if (isNavTab(event.target.value)) setActiveTab(event.target.value);
          }}>
            {NAV_TABS.map(tab => <option value={tab.id} key={tab.id}>{tab.label}</option>)}
          </select>
        </div>
        <Link className="ui-admin-back-link" to='/'>블로그로 돌아가기</Link>
      </aside>
    }>
      <header className="ui-admin-page-heading">
        <p className="ui-eyebrow">Administration</p>
        <h1 id='admin-current-section'>{NAV_TABS.find(tab => tab.id === activeTab)?.label}</h1>
      </header>
      <div id={`admin-panel-${activeTab}`} className="ui-admin-panel" role='tabpanel'
        aria-labelledby='admin-current-section' tabIndex={0}>
        <Suspense fallback={<div className="ui-section-loading" role='status' aria-live='polite'>선택한 관리 화면을 불러오는 중입니다.</div>}>
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
    </WorkspaceShell>
  );
}
