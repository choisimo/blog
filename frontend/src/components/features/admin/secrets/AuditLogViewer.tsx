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

const AUDIT_ACTIONS = new Set<SecretAuditLog['action']>([
  'created',
  'updated',
  'deleted',
  'rotated',
  'accessed',
]);
const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;
const AUDIT_ERROR_FALLBACK = 'Failed to load audit logs';

function normalizeAuditAction(value: unknown): SecretAuditLog['action'] | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return AUDIT_ACTIONS.has(normalized as SecretAuditLog['action'])
    ? (normalized as SecretAuditLog['action'])
    : null;
}

function normalizeAuditSelector(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || /[\r\n/\\]/.test(normalized) || !/^[A-Za-z0-9_-]+$/.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeAuditText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || null;
}

function normalizeAuditError(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return normalizeAuditText(value) ?? AUDIT_ERROR_FALLBACK;
}

function normalizeAuditLog(log: SecretAuditLog): SecretAuditLog | null {
  const action = normalizeAuditAction(log.action);
  const secretId = normalizeAuditSelector(log.secret_id);
  const keyName = normalizeAuditSelector(log.key_name);
  if (!action || (!secretId && !keyName)) return null;

  return {
    ...log,
    action,
    secret_id: secretId ?? keyName ?? 'unknown-secret',
    key_name: keyName,
    changed_by: normalizeAuditText(log.changed_by),
    ip_address: normalizeAuditText(log.ip_address),
  };
}

export function AuditLogViewer() {
  const { logs, loading, error, pagination, fetchLogs } = useAuditLog();
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const safeLogs = logs.flatMap((log) => {
    const normalized = normalizeAuditLog(log);
    return normalized ? [normalized] : [];
  });
  const safeError = normalizeAuditError(error);

  const handleActionFilterChange = (nextAction: string) => {
    setActionFilter(normalizeAuditAction(nextAction) ?? 'all');
    setPage(0);
  };

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
            <Select value={actionFilter} onValueChange={handleActionFilterChange}>
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
              aria-label="Refresh audit log"
              title="Refresh audit log"
              onClick={() =>
                fetchLogs({
                  action: actionFilter === 'all' ? undefined : actionFilter,
                  limit: pageSize,
                  offset: page * pageSize,
                })
              }
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {safeError && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {safeError}
          </div>
        )}

        <div className="space-y-2">
          {safeLogs.map((log) => (
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

          {safeLogs.length === 0 && !loading && !safeError && (
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
