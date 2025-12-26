/**
 * AI Model Management Dashboard
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bot, Cpu, GitBranch, BarChart3 } from 'lucide-react';
import { ProvidersManager } from './ProvidersManager';
import { ModelsManager } from './ModelsManager';
import { RoutesManager } from './RoutesManager';
import { UsageMonitor } from './UsageMonitor';

export function AIManager() {
  return (
    <Tabs defaultValue="models" className="space-y-6">
      <TabsList className="grid w-full max-w-2xl grid-cols-4">
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
      </TabsList>

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
    </Tabs>
  );
}
