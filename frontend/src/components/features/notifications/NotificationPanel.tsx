import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useState } from "react";
import {
  useNotificationStore,
  type AppNotification,
} from "@/stores/realtime/useNotificationStore";
import { markNotificationReadRemote } from "@/services/realtime/notifications";
import { useIsMobile } from "@/hooks/ui/use-mobile";
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
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";

type NotificationPanelProps = {
  label?: string;
  title?: string;
  markReadLabel?: string;
  removeLabel?: string;
  markAllReadLabel?: string;
  clearReadLabel?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

const NOTIFICATION_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const NOTIFICATION_ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const NOTIFICATION_WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_PANEL_LABEL = "Notifications";
const DEFAULT_MARK_READ_LABEL = "읽음 표시";
const DEFAULT_REMOVE_LABEL = "알림 삭제";
const DEFAULT_MARK_ALL_READ_LABEL = "모두 읽음 표시";
const DEFAULT_CLEAR_READ_LABEL = "읽은 알림 삭제";
const DEFAULT_EMPTY_TITLE = "알림이 없습니다";
const DEFAULT_EMPTY_TERMINAL_TITLE = "$ 알림 없음";
const DEFAULT_EMPTY_DESCRIPTION = "AI 작업 완료 시 여기에 표시됩니다";

export function normalizeNotificationText(value: unknown, fallback = ""): string {
  if (typeof value !== "string" && typeof value !== "number") return fallback;

  const normalized = String(value)
    .replace(NOTIFICATION_ANSI_ESCAPE_PATTERN, " ")
    .replace(NOTIFICATION_CONTROL_PATTERN, " ")
    .replace(NOTIFICATION_WHITESPACE_PATTERN, " ")
    .trim();

  return normalized || fallback;
}

function normalizeOptionalNotificationText(value: unknown): string | undefined {
  return normalizeNotificationText(value) || undefined;
}

// ============================================================================
// Icon helper
// ============================================================================

function NotificationIcon({
  type,
  className,
}: {
  type: AppNotification["type"];
  className?: string;
}) {
  const cls = cn("h-4 w-4 shrink-0", className);
  switch (type) {
    case "ai_task_complete":
    case "agent_complete":
      return <BotMessageSquare aria-hidden="true" className={cn(cls, "text-emerald-500")} />;
    case "ai_task_error":
    case "error":
      return <AlertCircle aria-hidden="true" className={cn(cls, "text-destructive")} />;
    case "rag_complete":
    case "chat_task_complete":
      return <Zap aria-hidden="true" className={cn(cls, "text-blue-500")} />;
    case "success":
      return <CheckCircle2 aria-hidden="true" className={cn(cls, "text-emerald-500")} />;
    case "info":
      return <Info aria-hidden="true" className={cn(cls, "text-muted-foreground")} />;
    default:
      return <Info aria-hidden="true" className={cn(cls, "text-muted-foreground")} />;
  }
}

// ============================================================================
// Single notification row
// ============================================================================

function NotificationRow({
  notification,
  isTerminal,
  isMobile,
  onMarkRead,
  onRemove,
  markReadLabel,
  removeLabel,
}: {
  notification: AppNotification;
  isTerminal: boolean;
  isMobile: boolean;
  onMarkRead: (id: string) => void;
  onRemove: (id: string) => void;
  markReadLabel: string;
  removeLabel: string;
}) {
  let relativeTime = "";
  try {
    relativeTime = formatDistanceToNow(new Date(notification.createdAt), {
      addSuffix: true,
      locale: ko,
    });
  } catch {
    relativeTime = "";
  }
  const safeTitle = normalizeNotificationText(notification.title, "알림");
  const safeMessage = normalizeOptionalNotificationText(notification.message);

  return (
    <div
      aria-label={safeTitle}
      className={cn(
        "group flex items-start gap-3 px-4 py-3 border-b transition-colors cursor-default",
        isTerminal
          ? "border-primary/10 hover:bg-primary/5"
          : "border-border/40 hover:bg-muted/40",
        !notification.read && !isTerminal && "bg-primary/[0.03]",
        !notification.read && isTerminal && "bg-primary/[0.04]",
      )}
    >
      {/* Unread dot */}
      <div className="mt-1 shrink-0 flex items-center justify-center w-5 h-5">
        {!notification.read ? (
          <span
            aria-hidden="true"
            className={cn(
              "w-2 h-2 rounded-full",
              isTerminal ? "bg-primary" : "bg-primary",
            )}
          />
        ) : (
          <span aria-hidden="true" className="w-2 h-2 rounded-full bg-transparent" />
        )}
      </div>

      {/* Type icon */}
      <NotificationIcon type={notification.type} className="mt-0.5" />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p
          className={cn(
            "text-sm font-medium leading-tight truncate",
            notification.read && "text-muted-foreground font-normal",
            isTerminal && !notification.read && "font-mono text-primary",
          )}
        >
          {safeTitle}
        </p>
        {safeMessage && (
          <p
            className={cn(
              "text-xs text-muted-foreground leading-relaxed line-clamp-2",
              isTerminal && "font-mono text-primary/60",
            )}
          >
            {safeMessage}
          </p>
        )}
        {relativeTime && (
          <p
            className={cn(
              "text-[10px] text-muted-foreground/60 mt-0.5",
              isTerminal && "font-mono",
            )}
          >
            {relativeTime}
          </p>
        )}
      </div>

      <div
        className={cn(
          "flex items-center gap-0.5 transition-opacity shrink-0",
          isMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        {!notification.read && (
          <button
            type="button"
            onClick={() => onMarkRead(notification.id)}
            aria-label={markReadLabel}
            className={cn(
              "flex items-center justify-center h-6 w-6 rounded transition-colors",
              isTerminal
                ? "text-primary/50 hover:text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onRemove(notification.id)}
          aria-label={removeLabel}
          className={cn(
            "flex items-center justify-center h-6 w-6 rounded transition-colors",
            isTerminal
              ? "text-primary/50 hover:text-destructive hover:bg-destructive/10"
            : "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          )}
        >
          <X aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// NotificationPanel
// ============================================================================

export function NotificationPanel({
  label = DEFAULT_PANEL_LABEL,
  title,
  markReadLabel = DEFAULT_MARK_READ_LABEL,
  removeLabel = DEFAULT_REMOVE_LABEL,
  markAllReadLabel = DEFAULT_MARK_ALL_READ_LABEL,
  clearReadLabel = DEFAULT_CLEAR_READ_LABEL,
  emptyTitle,
  emptyDescription = DEFAULT_EMPTY_DESCRIPTION,
}: NotificationPanelProps = {}) {
  const { isTerminal } = useTheme();
  const isMobile = useIsMobile();
  const {
    notifications,
    unreadCount,
    markRead,
    setReadState,
    markAllRead,
    removeNotification,
    clearRead,
  } = useNotificationStore();
  const [syncError, setSyncError] = useState<string | null>(null);

  const hasRead = notifications.some((n) => n.read);
  const safeLabel = normalizeNotificationText(label, DEFAULT_PANEL_LABEL);
  const safeTitle = normalizeOptionalNotificationText(title);
  const safeMarkReadLabel = normalizeNotificationText(markReadLabel, DEFAULT_MARK_READ_LABEL);
  const safeRemoveLabel = normalizeNotificationText(removeLabel, DEFAULT_REMOVE_LABEL);
  const safeMarkAllReadLabel = normalizeNotificationText(
    markAllReadLabel,
    DEFAULT_MARK_ALL_READ_LABEL,
  );
  const safeClearReadLabel = normalizeNotificationText(
    clearReadLabel,
    DEFAULT_CLEAR_READ_LABEL,
  );
  const safeEmptyTitle = normalizeNotificationText(
    emptyTitle,
    isTerminal ? DEFAULT_EMPTY_TERMINAL_TITLE : DEFAULT_EMPTY_TITLE,
  );
  const safeEmptyDescription = normalizeNotificationText(
    emptyDescription,
    DEFAULT_EMPTY_DESCRIPTION,
  );

  const handleMarkRead = async (id: string) => {
    setSyncError(null);
    markRead(id);
    const ok = await markNotificationReadRemote(id).catch(() => false);
    if (!ok) {
      setReadState([id], false);
      setSyncError("알림 상태를 서버와 동기화하지 못했습니다.");
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    setSyncError(null);
    markAllRead();
    const results = await Promise.all(
      unreadIds.map((id) => markNotificationReadRemote(id).catch(() => false)),
    );
    const failedIds = unreadIds.filter((_, index) => !results[index]);
    if (failedIds.length > 0) {
      setReadState(failedIds, false);
      setSyncError("일부 알림을 읽음 처리하지 못했습니다.");
    }
  };

  return (
    <section
      aria-label={safeLabel}
      title={safeTitle}
      className={cn("flex flex-col", isTerminal && "font-mono")}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b",
          isTerminal
            ? "border-primary/20 bg-[hsl(var(--terminal-titlebar))]"
            : "border-border/40",
        )}
      >
        <div className="flex items-center gap-2">
          <Bell
            aria-hidden="true"
            className={cn(
              "h-4 w-4",
              isTerminal ? "text-primary" : "text-foreground",
            )}
          />
          <span
            className={cn(
              "text-sm font-semibold",
              isTerminal && "text-primary terminal-glow",
            )}
          >
            {isTerminal ? ">_ 알림" : "알림"}
          </span>
          {unreadCount > 0 && (
            <span
              className={cn(
                "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold",
                isTerminal
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {unreadCount}
            </span>
          )}
        </div>

        {/* Bulk actions */}
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => {
                void handleMarkAllRead();
              }}
              aria-label={safeMarkAllReadLabel}
              title={safeMarkAllReadLabel}
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded transition-colors",
                isTerminal
                  ? "text-primary/60 hover:text-primary hover:bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <CheckCheck aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
          {hasRead && (
            <button
              type="button"
              onClick={clearRead}
              aria-label={safeClearReadLabel}
              title={safeClearReadLabel}
              className={cn(
                "flex items-center justify-center h-7 w-7 rounded transition-colors",
                isTerminal
                  ? "text-primary/60 hover:text-destructive hover:bg-destructive/10"
                : "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
              )}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notification list */}
      <div className="max-h-[360px] overflow-y-auto overscroll-contain">
        {syncError && (
          <div
            className={cn(
              "px-4 py-2 text-xs border-b",
              isTerminal
                ? "border-destructive/40 text-destructive"
                : "border-destructive/20 bg-destructive/5 text-destructive",
            )}
          >
            {syncError}
          </div>
        )}
        {notifications.length === 0 ? (
          <div
            className={cn(
              "flex flex-col items-center justify-center gap-3 px-4 py-10 text-center",
              isTerminal ? "text-primary/40" : "text-muted-foreground",
            )}
          >
            <Bell aria-hidden="true" className="h-8 w-8 opacity-30" />
            <p className={cn("text-sm", isTerminal && "font-mono")}>
              {safeEmptyTitle}
            </p>
            <p className="text-xs opacity-60">
              {safeEmptyDescription}
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              isTerminal={isTerminal}
              isMobile={isMobile}
              markReadLabel={safeMarkReadLabel}
              removeLabel={safeRemoveLabel}
              onMarkRead={(id) => {
                void handleMarkRead(id);
              }}
              onRemove={removeNotification}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div
          className={cn(
            "flex items-center justify-end px-4 py-2 border-t text-xs",
            isTerminal
              ? "border-primary/15 text-primary/40"
              : "border-border/30 text-muted-foreground",
          )}
        >
          총 {notifications.length}개 · 읽지 않음 {unreadCount}개
        </div>
      )}
    </section>
  );
}
