/**
 * Notification Store
 *
 * Global, persistent notification state for background AI agent tasks
 * and other async operations. Survives page navigation.
 *
 * Notifications are stored in localStorage so they persist across refreshes.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export type NotificationType =
  | "ai_task_complete"
  | "ai_task_error"
  | "rag_complete"
  | "chat_task_complete"
  | "agent_complete"
  | "system"
  | "info"
  | "error"
  | "success";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  /** ISO timestamp */
  createdAt: string;
  /** Whether the user has seen/read this notification */
  read: boolean;
  /** Optional payload for deep linking or action */
  payload?: Record<string, unknown>;
  /** Optional session/task id that generated this */
  sourceId?: string;
}

export interface NotificationState {
  notifications: AppNotification[];
  /** Total unread count */
  unreadCount: number;

  // Actions
  addNotification: (
    notification: Pick<AppNotification, "type" | "title" | "message"> &
      Partial<Omit<AppNotification, "type" | "title" | "message">>,
  ) => string;
  upsertNotifications: (notifications: AppNotification[]) => void;
  markRead: (id: string) => void;
  setReadState: (ids: string[], read: boolean) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  clearRead: () => void;
}

// ============================================================================
// Store
// ============================================================================

const MAX_NOTIFICATIONS = 50;
const MAX_NOTIFICATION_TEXT_LENGTH = 500;
const MAX_NOTIFICATION_ID_LENGTH = 160;
const ALLOWED_NOTIFICATION_TYPES = new Set<NotificationType>([
  "ai_task_complete",
  "ai_task_error",
  "rag_complete",
  "chat_task_complete",
  "agent_complete",
  "system",
  "info",
  "error",
  "success",
]);

function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNotificationText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength).trim()}...`
    : normalized;
}

function normalizeNotificationId(value: unknown): string | null {
  const normalized = normalizeNotificationText(value, MAX_NOTIFICATION_ID_LENGTH);
  if (!normalized || /[\r\n]/.test(normalized) || /%(?:0a|0d)/i.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeNotificationType(value: unknown): NotificationType | null {
  return typeof value === "string" && ALLOWED_NOTIFICATION_TYPES.has(value as NotificationType)
    ? (value as NotificationType)
    : null;
}

export function normalizeNotification(
  notification: Partial<AppNotification>,
): AppNotification | null {
  const type = normalizeNotificationType(notification.type);
  const title = normalizeNotificationText(notification.title, MAX_NOTIFICATION_TEXT_LENGTH);
  const message = normalizeNotificationText(notification.message, MAX_NOTIFICATION_TEXT_LENGTH);
  if (!type || !title || !message) return null;

  const id = normalizeNotificationId(notification.id) ?? generateId();
  const createdAt = normalizeNotificationText(notification.createdAt, MAX_NOTIFICATION_ID_LENGTH);
  const timestamp =
    createdAt && !Number.isNaN(Date.parse(createdAt))
      ? new Date(createdAt).toISOString()
      : new Date().toISOString();
  const sourceId = normalizeNotificationId(notification.sourceId) ?? undefined;

  return {
    id,
    type,
    title,
    message,
    createdAt: timestamp,
    read: notification.read === true,
    payload:
      notification.payload && typeof notification.payload === "object"
        ? notification.payload
        : undefined,
    sourceId,
  };
}

function dedupeNotifications(
  existing: AppNotification[],
  incoming: AppNotification[],
): AppNotification[] {
  const byId = new Map<string, AppNotification>();

  for (const notification of [...incoming, ...existing]) {
    const current = byId.get(notification.id);
    if (!current) {
      byId.set(notification.id, notification);
      continue;
    }

    byId.set(notification.id, {
      ...current,
      ...notification,
      read: current.read || notification.read,
    });
  }

  return Array.from(byId.values())
    .sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    )
    .slice(0, MAX_NOTIFICATIONS);
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, _get) => ({
      notifications: [],
      unreadCount: 0,

      addNotification: (notif) => {
        const newNotif = normalizeNotification(notif);
        if (!newNotif) return "";

        set((state) => {
          const next = dedupeNotifications(state.notifications, [newNotif]);
          return {
            notifications: next,
            unreadCount: next.filter((n) => !n.read).length,
          };
        });

        return newNotif.id;
      },

      upsertNotifications: (notifications) => {
        set((state) => {
          const normalizedNotifications = notifications
            .map(normalizeNotification)
            .filter((item): item is AppNotification => item !== null);
          const next = dedupeNotifications(state.notifications, normalizedNotifications);
          return {
            notifications: next,
            unreadCount: next.filter((n) => !n.read).length,
          };
        });
      },

      markRead: (id) => {
        set((state) => {
          const next = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          );
          return {
            notifications: next,
            unreadCount: next.filter((n) => !n.read).length,
          };
        });
      },

      setReadState: (ids, read) => {
        const idSet = new Set(ids);
        set((state) => {
          const next = state.notifications.map((notification) =>
            idSet.has(notification.id)
              ? { ...notification, read }
              : notification,
          );
          return {
            notifications: next,
            unreadCount: next.filter((n) => !n.read).length,
          };
        });
      },

      markAllRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      },

      removeNotification: (id) => {
        set((state) => {
          const next = state.notifications.filter((n) => n.id !== id);
          return {
            notifications: next,
            unreadCount: next.filter((n) => !n.read).length,
          };
        });
      },

      clearAll: () => {
        set({ notifications: [], unreadCount: 0 });
      },

      clearRead: () => {
        set((state) => {
          const next = state.notifications.filter((n) => !n.read);
          return {
            notifications: next,
            unreadCount: next.filter((n) => !n.read).length,
          };
        });
      },
    }),
    {
      name: "app-notifications",
      partialize: (state) => ({
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    },
  ),
);

// ============================================================================
// Helpers (usable outside React)
// ============================================================================

export function addNotification(
  notif: Pick<AppNotification, "type" | "title" | "message"> &
    Partial<Omit<AppNotification, "type" | "title" | "message">>,
): string {
  return useNotificationStore.getState().addNotification(notif);
}

export function upsertNotifications(notifications: AppNotification[]): void {
  useNotificationStore.getState().upsertNotifications(notifications);
}

export function getUnreadCount(): number {
  return useNotificationStore.getState().unreadCount;
}
