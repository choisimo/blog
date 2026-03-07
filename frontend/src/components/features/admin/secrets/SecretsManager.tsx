/**
 * Secrets Manager - Main Component
 *
 * Centralized secrets/API keys management UI
 */

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export function SecretsManager() {
  const { overview, health, loading, error, fetchOverview } = useSecretsOverview();
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-500';
      case 'unhealthy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Key className="h-5 w-5" />
            Secrets Management
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Centralized management for API keys, tokens, and secrets
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOverview} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Encryption Status */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Encryption
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getStatusColor(health?.status || 'unknown')}`} />
              <span className="text-lg font-semibold capitalize">
                {health?.encryption || 'Unknown'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Secrets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Key className="h-4 w-4" />
              Total Secrets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{overview?.stats?.total ?? '-'}</span>
              <span className="text-sm text-muted-foreground">
                ({overview?.stats?.configured ?? 0} configured)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Missing Required */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Missing Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {(overview?.stats?.missing_required ?? 0) > 0 ? (
                <>
                  <Badge variant="destructive">{overview?.stats?.missing_required}</Badge>
                  <span className="text-sm text-muted-foreground">need attention</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">All configured</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Expiring Soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {(overview?.stats?.expiring_soon ?? 0) > 0 ? (
                <>
                  <Badge variant="secondary">{overview?.stats?.expiring_soon}</Badge>
                  <span className="text-sm text-muted-foreground">in next 7 days</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">None expiring</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="secrets" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            All Secrets
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Categories</CardTitle>
              <CardDescription>Secrets organized by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overview?.categories?.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                    onClick={() => {
                      setActiveTab('secrets');
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Key className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{cat.display_name}</p>
                        <p className="text-xs text-muted-foreground">{cat.description}</p>
                      </div>
                    </div>
                    <Badge variant="secondary">{cat.secret_count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest changes to secrets</CardDescription>
            </CardHeader>
            <CardContent>
              {overview?.recentActivity && overview.recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {overview.recentActivity.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            log.action === 'deleted'
                              ? 'destructive'
                              : log.action === 'created'
                                ? 'default'
                                : 'secondary'
                          }
                        >
                          {log.action}
                        </Badge>
                        <span className="font-mono text-sm">{log.key_name || log.secret_id}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Secrets List Tab */}
        <TabsContent value="secrets">
          <SecretsListManager categories={overview?.categories ?? []} />
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <AuditLogViewer />
        </TabsContent>
      </Tabs>
    </div>
  );
}
