import { z } from "zod";
import {
  apiSuccessEnvelopeSchema,
  apiPaginatedSuccessEnvelopeSchema,
} from "./common.js";

export const notificationTypeSchema = z.enum([
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

export const notificationInboxItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: notificationTypeSchema,
  title: z.string(),
  message: z.string(),
  payload: z.record(z.unknown()).optional(),
  sourceId: z.string().nullable().optional(),
  createdAt: z.string(),
  readAt: z.string().nullable().optional(),
});

export const notificationOutboxWriteSchema = z.object({
  event: z.string().default("notification"),
  type: notificationTypeSchema.default("info"),
  title: z.string().min(1),
  message: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  userId: z.string().optional(),
  sourceId: z.string().optional(),
  jobId: z.string().optional(),
});

export const notificationUnreadResponseSchema = apiSuccessEnvelopeSchema(
  z.object({
    items: z.array(notificationInboxItemSchema),
    unreadCount: z.number().int().nonnegative(),
  }),
);

export const notificationHistoryResponseSchema = apiPaginatedSuccessEnvelopeSchema(
  z.object({
    items: z.array(notificationInboxItemSchema),
  }),
);

export const notificationReadResponseSchema = apiSuccessEnvelopeSchema(
  z.object({
    id: z.string(),
    readAt: z.string(),
  }),
);
