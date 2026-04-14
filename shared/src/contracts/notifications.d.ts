import type { ZodTypeAny } from 'zod';

export type NotificationType =
  | 'ai_task_complete'
  | 'ai_task_error'
  | 'rag_complete'
  | 'chat_task_complete'
  | 'agent_complete'
  | 'system'
  | 'info'
  | 'error'
  | 'success';

export type NotificationInboxItem = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  sourceId?: string | null;
  createdAt: string;
  readAt?: string | null;
};

export type NotificationOutboxWrite = {
  event?: string;
  type?: NotificationType;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  userId?: string;
  sourceId?: string;
  jobId?: string;
};

export const notificationTypeSchema: ZodTypeAny;
export const notificationInboxItemSchema: ZodTypeAny;
export const notificationOutboxWriteSchema: ZodTypeAny;
export const notificationUnreadResponseSchema: ZodTypeAny;
export const notificationHistoryResponseSchema: ZodTypeAny;
export const notificationReadResponseSchema: ZodTypeAny;
