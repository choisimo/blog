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
    notification: Omit<AppNotification, "type" | "title" | "message"> &
      Pick<AppNotification, "type" | "title" | "message"> &
      Partial<Pick<AppNotification, "id" | "createdAt" | "read">>,
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

function generateId(): string {
  return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
        const id = notif.id ?? generateId();
        const newNotif: AppNotification = {
          ...notif,
          id,
          createdAt: notif.createdAt ?? new Date().toISOString(),
          read: notif.read ?? false,
        };

        set((state) => {
          const next = dedupeNotifications(state.notifications, [newNotif]);
          return {
            notifications: next,
            unreadCount: next.filter((n) => !n.read).length,
          };
        });

        return id;
      },

      upsertNotifications: (notifications) => {
        set((state) => {
          const next = dedupeNotifications(state.notifications, notifications);
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
  notif: Omit<AppNotification, "type" | "title" | "message"> &
    Pick<AppNotification, "type" | "title" | "message"> &
    Partial<Pick<AppNotification, "id" | "createdAt" | "read">>,
): string {
  return useNotificationStore.getState().addNotification(notif);
}

export function upsertNotifications(notifications: AppNotification[]): void {
  useNotificationStore.getState().upsertNotifications(notifications);
}

export function getUnreadCount(): number {
  return useNotificationStore.getState().unreadCount;
}
