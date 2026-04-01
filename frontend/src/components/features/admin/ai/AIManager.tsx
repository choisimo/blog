import { Bot, Cpu, GitBranch, BarChart3, Activity, FlaskConical, MessageSquare } from 'lucide-react';
import { ProvidersManager } from './ProvidersManager';
import { ModelsManager } from './ModelsManager';
import { RoutesManager } from './RoutesManager';
import { UsageMonitor } from './UsageMonitor';
import { TraceViewer } from './TraceViewer';
import { Playground } from './Playground';
import { PromptsManager } from './PromptsManager';
import { AdminSubtabs } from '@/components/molecules/AdminSubtabs';

type TabId = 'playground' | 'models' | 'providers' | 'routes' | 'monitoring' | 'traces' | 'prompts';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'playground', label: 'Playground', icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { id: 'models', label: 'Models', icon: <Bot className="h-3.5 w-3.5" /> },
  { id: 'providers', label: 'Providers', icon: <Cpu className="h-3.5 w-3.5" /> },
  { id: 'routes', label: 'Routes', icon: <GitBranch className="h-3.5 w-3.5" /> },
  { id: 'monitoring', label: 'Monitoring', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: 'traces', label: 'Traces', icon: <Activity className="h-3.5 w-3.5" /> },
  { id: 'prompts', label: 'Prompts', icon: <MessageSquare className="h-3.5 w-3.5" /> },
];

interface AIManagerProps {
  subtab?: string;
  onSubtabChange?: (subtab: string) => void;
}

export function AIManager({ subtab, onSubtabChange }: AIManagerProps) {
  const validTabs = TABS.map(t => t.id);
  const activeTab: TabId =
    subtab && validTabs.includes(subtab as TabId) ? (subtab as TabId) : 'playground';

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <AdminSubtabs tabs={TABS} activeTab={activeTab} onTabChange={(id) => onSubtabChange?.(id)} />

      <div className="p-4">
        {activeTab === 'playground' && <Playground />}
        {activeTab === 'models' && <ModelsManager />}
        {activeTab === 'providers' && <ProvidersManager />}
        {activeTab === 'routes' && <RoutesManager />}
        {activeTab === 'monitoring' && <UsageMonitor />}
        {activeTab === 'traces' && <TraceViewer />}
        {activeTab === 'prompts' && <PromptsManager />}
      </div>
    </div>
  );
}
