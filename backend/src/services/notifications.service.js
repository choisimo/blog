import { createLogger } from "../lib/logger.js";
import { getNotificationsRepository } from "../repositories/notifications.repository.js";
import { getDomainOutboxRepository } from "../repositories/domain-outbox.repository.js";
import { NOTIFICATION_BROADCAST_STREAM } from "./backend-outbox.service.js";
import { transaction } from "../lib/d1.js";

const logger = createLogger("notifications-service");

function normalizeEnvelope(input = {}) {
  return {
    eventName: input.eventName || "notification",
    type: input.type || "info",
    title: input.title || "알림",
    message: input.message || "",
    payload: input.payload ?? null,
    targetUserId: input.targetUserId || null,
    sourceId: input.sourceId || null,
    dedupeKey: input.dedupeKey || null,
  };
}

export function createNotificationsService({
  notificationStream,
  repository = getNotificationsRepository(),
  broadcastOutbox = getDomainOutboxRepository(),
}) {
  return {
    async getStorageMode() {
      return repository.getStorageMode();
    },

    async listUnread(userId, options = {}) {
      return repository.listUnread(userId, options);
    },

    async listHistory(userId, options = {}) {
      return repository.listHistory(userId, options);
    },

    async markRead(userId, notificationId) {
      return repository.markRead(userId, notificationId);
    },

    async deliver(input = {}) {
      const envelope = normalizeEnvelope(input);
      const { outbox, inbox, broadcastEvent } = await transaction(async () => {
        const appended = await repository.appendOutbox(envelope);
        const materialized = envelope.targetUserId
          ? await repository.materializeInbox(appended, envelope.targetUserId)
          : null;
        const queued = appended.broadcastedAt
          ? null
          : await broadcastOutbox.append({
              stream: NOTIFICATION_BROADCAST_STREAM,
              aggregateId: appended.id,
              eventType: "notification.broadcast",
              payload: {
                outboxId: appended.id,
                eventName: envelope.eventName,
                targetUserId: envelope.targetUserId || null,
                data: {
                  notificationId: materialized?.id ?? appended.id,
                  outboxId: appended.id,
                  type: envelope.type,
                  title: envelope.title,
                  message: envelope.message,
                  payload: envelope.payload ?? null,
                  sourceId: envelope.sourceId ?? null,
                  createdAt: materialized?.createdAt ?? appended.createdAt,
                  readAt: materialized?.readAt ?? null,
                },
              },
              idempotencyKey: `notification.broadcast:${appended.id}`,
            },
          );
        return { outbox: appended, inbox: materialized, broadcastEvent: queued };
      });
      const alreadyBroadcasted = Boolean(outbox.broadcastedAt);

      return {
        outbox,
        inbox,
        broadcastOutbox: broadcastEvent,
        delivered: 0,
        deduped: alreadyBroadcasted,
        broadcastQueued: Boolean(broadcastEvent),
      };
    },

    broadcastBestEffort(input = {}) {
      void this.deliver(input).catch((error) => {
        logger.error({}, "Durable notification broadcast failed", {
          error: error?.message,
          eventName: input?.eventName,
          targetUserId: input?.targetUserId,
        });
      });
    },
  };
}

export default createNotificationsService;
