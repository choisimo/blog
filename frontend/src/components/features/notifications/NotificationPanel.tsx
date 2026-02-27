import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotificationStore, type AppNotification } from '@/stores/useNotificationStore';
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  Info,
  AlertCircle,
  CheckCircle2,
  Zap,
  BotMessageSquare,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

// ============================================================================
// Icon helper
// ============================================================================

function NotificationIcon({ type, className }: { type: AppNotification['type']; className?: string }) {
  const cls = cn('h-4 w-4 shrink-0', className);
  switch (type) {
    case 'ai_task_complete':
    case 'agent_complete':
      return <BotMessageSquare className={cn(cls, 'text-emerald-500')} />;
    case 'ai_task_error':
    case 'error':
      return <AlertCircle className={cn(cls, 'text-destructive')} />;
    case 'rag_complete':
    case 'chat_task_complete':
      return <Zap className={cn(cls, 'text-blue-500')} />;
    case 'success':
      return <CheckCircle2 className={cn(cls, 'text-emerald-500')} />;
    case 'info':
      return <Info className={cn(cls, 'text-muted-foreground')} />;
    default:
      return <Info className={cn(cls, 'text-muted-foreground')} />;
  }
}

// ============================================================================
// Single notification row
// ============================================================================

function NotificationRow({
  notification,
  isTerminal,
  onMarkRead,
  onRemove,
}: {
  notification: AppNotification;
  isTerminal: boolean;
  onMarkRead: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  let relativeTime = '';
  try {
    relativeTime = formatDistanceToNow(new Date(notification.createdAt), {
      addSuffix: true,
      locale: ko,
    });
  } catch {
    relativeTime = '';
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 px-4 py-3 border-b transition-colors cursor-default',
        isTerminal
          ? 'border-primary/10 hover:bg-primary/5'
          : 'border-border/40 hover:bg-muted/40',
        !notification.read && !isTerminal && 'bg-primary/[0.03]',
        !notification.read && isTerminal && 'bg-primary/[0.04]'
      )}
    >
      {/* Unread dot */}
      <div className='mt-1 shrink-0 flex items-center justify-center w-5 h-5'>
        {!notification.read ? (
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isTerminal ? 'bg-primary' : 'bg-primary'
            )}
          />
        ) : (
          <span className='w-2 h-2 rounded-full bg-transparent' />
        )}
      </div>

      {/* Type icon */}
      <NotificationIcon type={notification.type} className='mt-0.5' />

      {/* Content */}
      <div className='flex-1 min-w-0 space-y-0.5'>
        <p
          className={cn(
            'text-sm font-medium leading-tight truncate',
            notification.read && 'text-muted-foreground font-normal',
            isTerminal && !notification.read && 'font-mono text-primary'
          )}
        >
          {notification.title}
        </p>
        {notification.message && (
          <p
            className={cn(
              'text-xs text-muted-foreground leading-relaxed line-clamp-2',
              isTerminal && 'font-mono text-primary/60'
            )}
          >
            {notification.message}
          </p>
        )}
        {relativeTime && (
          <p className={cn('text-[10px] text-muted-foreground/60 mt-0.5', isTerminal && 'font-mono')}>
            {relativeTime}
          </p>
        )}
      </div>

      {/* Action buttons (show on hover) */}
      <div className='flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0'>
        {!notification.read && (
          <button
            type='button'
            onClick={() => onMarkRead(notification.id)}
            aria-label='읽음 표시'
            className={cn(
              'flex items-center justify-center h-6 w-6 rounded transition-colors',
              isTerminal
                ? 'text-primary/50 hover:text-primary hover:bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Check className='h-3.5 w-3.5' />
          </button>
        )}
        <button
          type='button'
          onClick={() => onRemove(notification.id)}
          aria-label='알림 삭제'
          className={cn(
            'flex items-center justify-center h-6 w-6 rounded transition-colors',
            isTerminal
              ? 'text-primary/50 hover:text-destructive hover:bg-destructive/10'
              : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
          )}
        >
          <X className='h-3.5 w-3.5' />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// NotificationPanel
// ============================================================================

export function NotificationPanel() {
  const { isTerminal } = useTheme();
  const { notifications, unreadCount, markRead, markAllRead, removeNotification, clearRead } =
    useNotificationStore();

  const hasRead = notifications.some((n) => n.read);

  return (
    <div className={cn('flex flex-col', isTerminal && 'font-mono')}>
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b',
          isTerminal ? 'border-primary/20 bg-[hsl(var(--terminal-titlebar))]' : 'border-border/40'
        )}
      >
        <div className='flex items-center gap-2'>
          <Bell className={cn('h-4 w-4', isTerminal ? 'text-primary' : 'text-foreground')} />
          <span className={cn('text-sm font-semibold', isTerminal && 'text-primary terminal-glow')}>
            {isTerminal ? '>_ 알림' : '알림'}
          </span>
          {unreadCount > 0 && (
            <span
              className={cn(
                'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                isTerminal
                  ? 'bg-primary/20 text-primary border border-primary/40'
                  : 'bg-primary text-primary-foreground'
              )}
            >
              {unreadCount}
            </span>
          )}
        </div>

        {/* Bulk actions */}
        <div className='flex items-center gap-1'>
          {unreadCount > 0 && (
            <button
              type='button'
              onClick={markAllRead}
              title='모두 읽음 표시'
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded transition-colors',
                isTerminal
                  ? 'text-primary/60 hover:text-primary hover:bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <CheckCheck className='h-4 w-4' />
            </button>
          )}
          {hasRead && (
            <button
              type='button'
              onClick={clearRead}
              title='읽은 알림 삭제'
              className={cn(
                'flex items-center justify-center h-7 w-7 rounded transition-colors',
                isTerminal
                  ? 'text-primary/60 hover:text-destructive hover:bg-destructive/10'
                  : 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
              )}
            >
              <Trash2 className='h-4 w-4' />
            </button>
          )}
        </div>
      </div>

      {/* Notification list */}
      <div className='max-h-[360px] overflow-y-auto overscroll-contain'>
        {notifications.length === 0 ? (
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-3 px-4 py-10 text-center',
              isTerminal ? 'text-primary/40' : 'text-muted-foreground'
            )}
          >
            <Bell className='h-8 w-8 opacity-30' />
            <p className={cn('text-sm', isTerminal && 'font-mono')}>
              {isTerminal ? '$ 알림 없음' : '알림이 없습니다'}
            </p>
            <p className='text-xs opacity-60'>
              AI 작업 완료 시 여기에 표시됩니다
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              isTerminal={isTerminal}
              onMarkRead={markRead}
              onRemove={removeNotification}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div
          className={cn(
            'flex items-center justify-end px-4 py-2 border-t text-xs',
            isTerminal ? 'border-primary/15 text-primary/40' : 'border-border/30 text-muted-foreground'
          )}
        >
          총 {notifications.length}개 · 읽지 않음 {unreadCount}개
        </div>
      )}
    </div>
  );
}
