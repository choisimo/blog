import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Cpu, GitBranch, BarChart3, Activity, FlaskConical } from 'lucide-react';
import { ProvidersManager } from './ProvidersManager';
import { ModelsManager } from './ModelsManager';
import { RoutesManager } from './RoutesManager';
import { UsageMonitor } from './UsageMonitor';
import { TraceViewer } from './TraceViewer';
import { Playground } from './Playground';

export function AIManager() {
  return (
    <Tabs defaultValue="playground" className="space-y-6">
      <TabsList className="grid w-full max-w-4xl grid-cols-6">
        <TabsTrigger value="playground" className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4" />
          Playground
        </TabsTrigger>
        <TabsTrigger value="models" className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          Models
        </TabsTrigger>
        <TabsTrigger value="providers" className="flex items-center gap-2">
          <Cpu className="h-4 w-4" />
          Providers
        </TabsTrigger>
        <TabsTrigger value="routes" className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Routes
        </TabsTrigger>
        <TabsTrigger value="monitoring" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Monitoring
        </TabsTrigger>
        <TabsTrigger value="traces" className="flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Traces
        </TabsTrigger>
      </TabsList>

      <TabsContent value="playground">
        <Playground />
      </TabsContent>

      <TabsContent value="models">
        <ModelsManager />
      </TabsContent>

      <TabsContent value="providers">
        <ProvidersManager />
      </TabsContent>

      <TabsContent value="routes">
        <RoutesManager />
      </TabsContent>

      <TabsContent value="monitoring">
        <UsageMonitor />
      </TabsContent>

      <TabsContent value="traces">
        <TraceViewer />
      </TabsContent>
    </Tabs>
  );
}
