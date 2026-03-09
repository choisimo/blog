import { useState } from 'react';
import { Bot, Cpu, GitBranch, BarChart3, Activity, FlaskConical } from 'lucide-react';
import { ProvidersManager } from './ProvidersManager';
import { ModelsManager } from './ModelsManager';
import { RoutesManager } from './RoutesManager';
import { UsageMonitor } from './UsageMonitor';
import { TraceViewer } from './TraceViewer';
import { Playground } from './Playground';

type TabId = 'playground' | 'models' | 'providers' | 'routes' | 'monitoring' | 'traces';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'playground', label: 'Playground', icon: <FlaskConical className="h-3.5 w-3.5" /> },
  { id: 'models', label: 'Models', icon: <Bot className="h-3.5 w-3.5" /> },
  { id: 'providers', label: 'Providers', icon: <Cpu className="h-3.5 w-3.5" /> },
  { id: 'routes', label: 'Routes', icon: <GitBranch className="h-3.5 w-3.5" /> },
  { id: 'monitoring', label: 'Monitoring', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: 'traces', label: 'Traces', icon: <Activity className="h-3.5 w-3.5" /> },
];

export function AIManager() {
  const [activeTab, setActiveTab] = useState<TabId>('playground');

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <div className="flex items-center gap-0.5 border-b border-zinc-200 px-2 pt-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-zinc-900 text-zinc-900'
                : 'border-transparent text-zinc-400 hover:text-zinc-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {activeTab === 'playground' && <Playground />}
        {activeTab === 'models' && <ModelsManager />}
        {activeTab === 'providers' && <ProvidersManager />}
        {activeTab === 'routes' && <RoutesManager />}
        {activeTab === 'monitoring' && <UsageMonitor />}
        {activeTab === 'traces' && <TraceViewer />}
      </div>
    </div>
  );
}
