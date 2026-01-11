/**
 * AI Usage Monitoring Component
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  AlertCircle,
  TrendingUp,
  Zap,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useUsage, useAIConfig } from './hooks';
import { toast } from '@/hooks/use-toast';

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div
            className={`h-10 w-10 rounded-full flex items-center justify-center ${
              trend === 'up'
                ? 'bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400'
                : trend === 'down'
                ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UsageBar({
  label,
  value,
  maxValue,
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  color?: string;
}) {
  const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color || 'bg-primary'}`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function UsageMonitor() {
  const { usage, loading, error, fetchUsage } = useUsage();
  const { reloadConfig, exportConfig, loading: configLoading } = useAIConfig();
  const [period, setPeriod] = useState('7d');
  const [groupBy, setGroupBy] = useState<'day' | 'model'>('day');

  useEffect(() => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 1;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    fetchUsage({ startDate, endDate, groupBy });
  }, [fetchUsage, period, groupBy]);

  const chartData = useMemo(() => {
    if (!usage?.breakdown) return [];
    return usage.breakdown;
  }, [usage]);

  const maxRequests = useMemo(() => {
    if (groupBy === 'model' && chartData.length > 0) {
      return Math.max(...chartData.map((d) => d.requests));
    }
    return 0;
  }, [chartData, groupBy]);

  const handleReload = async () => {
    const result = await reloadConfig();
    if (result.ok) {
      toast({
        title: 'Config Generated',
        description: `Generated with ${result.data?.modelCount} models. ${result.data?.message}`,
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error,
      });
    }
  };

  const handleExport = async () => {
    const result = await exportConfig();
    if (result.ok && result.data) {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-config-export-${result.data.exportedAt.split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: result.error,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Usage & Monitoring</CardTitle>
              <CardDescription>Track AI usage, costs, and performance</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1d">Last 24h</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'day' | 'model')}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">By Day</SelectItem>
                  <SelectItem value="model">By Model</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => fetchUsage()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-md flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : usage ? (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Requests"
              value={formatNumber(usage.summary.totalRequests)}
              icon={TrendingUp}
              trend="neutral"
            />
            <StatCard
              title="Total Tokens"
              value={formatNumber(usage.summary.totalTokens)}
              icon={Zap}
              trend="neutral"
            />
            <StatCard
              title="Total Cost"
              value={`$${usage.summary.totalCost.toFixed(2)}`}
              icon={DollarSign}
              trend={usage.summary.totalCost > 10 ? 'up' : 'neutral'}
            />
            <StatCard
              title="Avg Latency"
              value={`${usage.summary.avgLatencyMs}ms`}
              icon={Clock}
              trend={usage.summary.avgLatencyMs > 2000 ? 'down' : 'neutral'}
            />
          </div>

          {/* Success/Error Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{usage.summary.successCount}</p>
                  <p className="text-sm text-muted-foreground">Successful Requests</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center gap-4">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{usage.summary.errorCount}</p>
                  <p className="text-sm text-muted-foreground">Failed Requests</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {groupBy === 'day' ? 'Daily Usage' : 'Usage by Model'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                groupBy === 'model' ? (
                  <div className="space-y-4">
                    {chartData.map((item, idx) => (
                      <UsageBar
                        key={item.model?.id || idx}
                        label={item.model?.displayName || 'Unknown'}
                        value={item.requests}
                        maxValue={maxRequests}
                        color={
                          idx === 0
                            ? 'bg-blue-500'
                            : idx === 1
                            ? 'bg-green-500'
                            : idx === 2
                            ? 'bg-yellow-500'
                            : 'bg-gray-400'
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Date</th>
                          <th className="text-right p-2">Requests</th>
                          <th className="text-right p-2">Tokens</th>
                          <th className="text-right p-2">Cost</th>
                          <th className="text-right p-2">Avg Latency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.map((item, idx) => (
                          <tr key={item.date || idx} className="border-b">
                            <td className="p-2">{item.date}</td>
                            <td className="text-right p-2">{formatNumber(item.requests)}</td>
                            <td className="text-right p-2">{formatNumber(item.tokens)}</td>
                            <td className="text-right p-2">${item.cost.toFixed(4)}</td>
                            <td className="text-right p-2">{item.avgLatencyMs}ms</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No usage data available for this period.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Config Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configuration Actions</CardTitle>
              <CardDescription>Manage n8n workflow configuration sync</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button onClick={handleReload} disabled={configLoading}>
                {configLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Generate n8n Config
              </Button>
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export Config
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
