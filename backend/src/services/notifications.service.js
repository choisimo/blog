import { createLogger } from "../lib/logger.js";
import { getNotificationsRepository } from "../repositories/notifications.repository.js";

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
      const outbox = await repository.appendOutbox(envelope);
      const inbox = envelope.targetUserId
        ? await repository.materializeInbox(outbox, envelope.targetUserId)
        : null;
      const alreadyBroadcasted = Boolean(outbox.broadcastedAt);

      if (!alreadyBroadcasted) {
        notificationStream.broadcast(
          envelope.eventName,
          {
            notificationId: inbox?.id ?? outbox.id,
            outboxId: outbox.id,
            type: envelope.type,
            title: envelope.title,
            message: envelope.message,
            payload: envelope.payload ?? null,
            sourceId: envelope.sourceId ?? null,
            createdAt: inbox?.createdAt ?? outbox.createdAt,
            readAt: inbox?.readAt ?? null,
          },
          envelope.targetUserId || undefined,
        );

        await repository.markOutboxBroadcasted(outbox.id);
      }

      return {
        outbox,
        inbox,
        delivered: alreadyBroadcasted ? 0 : notificationStream.getSubscriberCount(),
        deduped: alreadyBroadcasted,
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
