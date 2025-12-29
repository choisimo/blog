/**
 * Audit Log Viewer
 */

import { useState, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuditLog } from './hooks';
import type { SecretAuditLog } from './types';

export function AuditLogViewer() {
  const { logs, loading, error, pagination, fetchLogs } = useAuditLog();
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    fetchLogs({
      action: actionFilter === 'all' ? undefined : actionFilter,
      limit: pageSize,
      offset: page * pageSize,
    });
  }, [fetchLogs, actionFilter, page]);

  const getActionBadge = (action: SecretAuditLog['action']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      created: 'default',
      updated: 'secondary',
      rotated: 'secondary',
      deleted: 'destructive',
      accessed: 'outline',
    };
    return <Badge variant={variants[action] || 'outline'}>{action}</Badge>;
  };

  const totalPages = Math.ceil(pagination.total / pageSize);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>History of all secret changes and access</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="updated">Updated</SelectItem>
                <SelectItem value="rotated">Rotated</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
                <SelectItem value="accessed">Accessed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() =>
                fetchLogs({
                  action: actionFilter === 'all' ? undefined : actionFilter,
                  limit: pageSize,
                  offset: page * pageSize,
                })
              }
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-4">
                {getActionBadge(log.action)}
                <div>
                  <code className="text-sm font-mono">{log.key_name || log.secret_id}</code>
                  {log.changed_by && (
                    <span className="text-xs text-muted-foreground ml-2">by {log.changed_by}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {log.ip_address && <span>{log.ip_address}</span>}
                <span>{new Date(log.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}

          {logs.length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-8">No audit logs found</p>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <span className="text-sm text-muted-foreground">
              Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, pagination.total)} of{' '}
              {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
