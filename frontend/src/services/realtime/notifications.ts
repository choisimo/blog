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

const MAX_NOTIFICATION_LIMIT = 100;
const MAX_NOTIFICATION_TEXT_LENGTH = 500;
const MAX_AUTHORIZATION_HEADER_LENGTH = 4096;
const NOTIFICATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function decodeNotificationSelector(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return decodeURIComponent(trimmed).trim();
  } catch {
    return trimmed;
  }
}

function normalizeNotificationId(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = decodeNotificationSelector(value);
  if (!normalized || !NOTIFICATION_ID_PATTERN.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeNotificationText(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_NOTIFICATION_TEXT_LENGTH || /[\r\n]/.test(normalized)) {
    return null;
  }

  return normalized;
}

function normalizeNotificationTimestamp(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!normalized || /[\r\n]/.test(normalized)) return null;

  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? normalized : null;
}

export function normalizeNotificationPayload(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function normalizeNotificationLimit(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.min(MAX_NOTIFICATION_LIMIT, Math.max(1, Math.floor(value)));
}

function normalizeAuthHeaders(headers: AuthHeaders): (AuthHeaders & { Authorization: string }) | null {
  const authorization = (headers as { Authorization?: unknown }).Authorization;
  if (typeof authorization !== 'string') return null;

  const normalizedAuthorization = authorization.trim();
  if (
    !normalizedAuthorization ||
    normalizedAuthorization.length > MAX_AUTHORIZATION_HEADER_LENGTH ||
    /[\r\n]/.test(normalizedAuthorization)
  ) {
    return null;
  }

  return {
    ...headers,
    Authorization: normalizedAuthorization,
  } as AuthHeaders & { Authorization: string };
}

function toAppNotification(notification: RemoteNotification): AppNotification | null {
  const id = normalizeNotificationId(notification.id);
  const title = normalizeNotificationText(notification.title);
  const message = normalizeNotificationText(notification.message);
  const createdAt = normalizeNotificationTimestamp(notification.createdAt);
  const sourceId = notification.sourceId ? normalizeNotificationId(notification.sourceId) : null;
  if (!id || !title || !message || !createdAt) {
    return null;
  }
  const payload = normalizeNotificationPayload(notification.payload);

  return {
    id,
    type: notification.type,
    title,
    message,
    ...(payload ? { payload } : {}),
    sourceId: sourceId ?? undefined,
    createdAt,
    read: Boolean(notification.readAt),
  };
}

export async function fetchUnreadNotifications(limit = 50): Promise<AppNotification[]> {
  const baseUrl = getApiBaseUrl();
  const headers = normalizeAuthHeaders(await getAuthHeadersAsync());
  if (!headers) {
    return [];
  }
  const safeLimit = normalizeNotificationLimit(limit);
  const response = await fetch(
    `${baseUrl}/api/v1/notifications/unread?limit=${encodeURIComponent(String(safeLimit))}`,
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

  return parsed.data.data.items
    .map(toAppNotification)
      .filter(
        (notification: AppNotification | null): notification is AppNotification =>
          Boolean(notification),
      );
}

export async function fetchNotificationHistory(limit = 50): Promise<AppNotification[]> {
  const baseUrl = getApiBaseUrl();
  const headers = normalizeAuthHeaders(await getAuthHeadersAsync());
  if (!headers) {
    return [];
  }
  const safeLimit = normalizeNotificationLimit(limit);
  const response = await fetch(
    `${baseUrl}/api/v1/notifications/history?limit=${encodeURIComponent(String(safeLimit))}`,
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

  return parsed.data.data.items
    .map(toAppNotification)
      .filter(
        (notification: AppNotification | null): notification is AppNotification =>
          Boolean(notification),
      );
}

export async function syncUnreadNotifications(limit = 50): Promise<void> {
  const unread = await fetchUnreadNotifications(limit);
  if (unread.length > 0) {
    upsertNotifications(unread);
  }
}

export async function markNotificationReadRemote(id: string): Promise<boolean> {
  const notificationId = normalizeNotificationId(id);
  if (!notificationId) {
    return false;
  }

  const baseUrl = getApiBaseUrl();
  const headers = normalizeAuthHeaders({
    ...(await getAuthHeadersAsync()),
    'Content-Type': 'application/json',
  } as AuthHeaders);
  if (!headers) {
    return false;
  }
  headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, {
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
