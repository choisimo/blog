import {
  notificationHistoryResponseSchema,
  notificationReadResponseSchema,
  notificationUnreadResponseSchema,
} from '@blog/shared/contracts/notifications';
import type { AppNotification } from '@/stores/realtime/useNotificationStore';
import { upsertNotifications } from '@/stores/realtime/useNotificationStore';
import { getAuthHeadersAsync } from '@/stores/session/useAuthStore';
import { getApiBaseUrl } from '@/utils/network/apiBase';

type AuthHeaders = Awaited<ReturnType<typeof getAuthHeadersAsync>>;

type RemoteNotification = {
  id: string;
  type: AppNotification['type'];
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  sourceId?: string | null;
  createdAt: string;
  readAt?: string | null;
};

function toAppNotification(notification: RemoteNotification): AppNotification {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    payload: notification.payload,
    sourceId: notification.sourceId ?? undefined,
    createdAt: notification.createdAt,
    read: Boolean(notification.readAt),
  };
}

export async function fetchUnreadNotifications(limit = 50): Promise<AppNotification[]> {
  const baseUrl = getApiBaseUrl();
  const headers = (await getAuthHeadersAsync()) as AuthHeaders & {
    Authorization?: string;
  };
  if (!headers.Authorization) {
    return [];
  }
  const response = await fetch(
    `${baseUrl}/api/v1/notifications/unread?limit=${encodeURIComponent(String(limit))}`,
    { headers }
  );

  if (!response.ok) {
    return [];
  }

  const parsed = notificationUnreadResponseSchema.safeParse(
    await response.json().catch(() => null)
  );

  if (!parsed.success) {
    return [];
  }

  return parsed.data.data.items.map(toAppNotification);
}

export async function fetchNotificationHistory(limit = 50): Promise<AppNotification[]> {
  const baseUrl = getApiBaseUrl();
  const headers = (await getAuthHeadersAsync()) as AuthHeaders & {
    Authorization?: string;
  };
  if (!headers.Authorization) {
    return [];
  }
  const response = await fetch(
    `${baseUrl}/api/v1/notifications/history?limit=${encodeURIComponent(String(limit))}`,
    { headers }
  );

  if (!response.ok) {
    return [];
  }

  const parsed = notificationHistoryResponseSchema.safeParse(
    await response.json().catch(() => null)
  );

  if (!parsed.success) {
    return [];
  }

  return parsed.data.data.items.map(toAppNotification);
}

export async function syncUnreadNotifications(limit = 50): Promise<void> {
  const unread = await fetchUnreadNotifications(limit);
  if (unread.length > 0) {
    upsertNotifications(unread);
  }
}

export async function markNotificationReadRemote(id: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const headers = {
    ...(await getAuthHeadersAsync()),
    'Content-Type': 'application/json',
  } as AuthHeaders & { Authorization?: string };
  if (!headers.Authorization) {
    return false;
  }
  const response = await fetch(`${baseUrl}/api/v1/notifications/${id}/read`, {
    method: 'PATCH',
    headers,
  });

  if (!response.ok) {
    return false;
  }

  const parsed = notificationReadResponseSchema.safeParse(
    await response.json().catch(() => null)
  );

  return parsed.success;
}
