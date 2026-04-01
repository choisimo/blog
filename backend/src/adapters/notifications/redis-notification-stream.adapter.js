import { assertNotificationStreamPort } from "../../application/ports/notification-stream.port.js";
import { createLogger } from "../../lib/logger.js";

const logger = createLogger("notification-stream");
const INSTANCE_ID = `notifications-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;

function formatSsePayload(eventName, data) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

function getUserChannel(userId) {
  return `user:${userId}:notifications`;
}

/**
 * Redis-backed NotificationStream adapter.
 *
 * The adapter keeps SSE response objects local to the process and uses Redis
 * Pub/Sub only for cross-instance fanout. When Redis is unavailable, delivery
 * falls back to local best-effort writes instead of throwing.
 *
 * @param {{ publish?: (channel: string, message: string) => Promise<unknown>, duplicate?: () => unknown | Promise<unknown> }} redisClient
 */
export function createRedisNotificationStreamAdapter(redisClient) {
  /** @type {Map<string, {res: import("express").Response, userId?: string}>} */
  const subscribers = new Map();
  /** @type {Map<string, Set<string>>} */
  const channelSubscribers = new Map();
  /** @type {Map<string, Promise<void>>} */
  const channelOperations = new Map();
  const subscribedChannels = new Set();

  let subscriberSeq = 0;
  let subscriberClientPromise = null;

  function removeSubscriberRecord(id) {
    const subscriber = subscribers.get(id);
    if (!subscriber) return;

    subscribers.delete(id);

    if (!subscriber.userId) return;

    const channel = getUserChannel(subscriber.userId);
    const ids = channelSubscribers.get(channel);
    if (!ids) return;

    ids.delete(id);
    if (ids.size === 0) {
      channelSubscribers.delete(channel);
      void scheduleChannelUnsubscribe(channel);
    }
  }

  function writePayloadToSubscribers(payload, targetUserId) {
    const dead = [];

    for (const [id, subscriber] of subscribers) {
      if (targetUserId && subscriber.userId !== targetUserId) continue;

      try {
        subscriber.res.write(payload);
        if (typeof subscriber.res.flush === "function") subscriber.res.flush();
      } catch {
        dead.push(id);
      }
    }

    for (const id of dead) {
      removeSubscriberRecord(id);
    }
  }

  function deliverLocal(eventName, data, targetUserId) {
    writePayloadToSubscribers(formatSsePayload(eventName, data), targetUserId);
  }

  async function getSubscriberClient() {
    if (subscriberClientPromise) {
      return subscriberClientPromise;
    }

    subscriberClientPromise = (async () => {
      if (!redisClient || typeof redisClient.duplicate !== "function") {
        throw new Error("Redis notification stream requires duplicate()");
      }

      const client = await redisClient.duplicate();
      client?.on?.("error", (error) => {
        logger.warn({}, "Notification Redis subscriber error", {
          error: error?.message,
        });
      });

      if (typeof client?.connect === "function" && !client.isOpen) {
        await client.connect();
      }

      return client;
    })().catch((error) => {
      subscriberClientPromise = null;
      throw error;
    });

    return subscriberClientPromise;
  }

  async function withChannelOperation(channel, operation) {
    const previous = channelOperations.get(channel) || Promise.resolve();
    const next = previous
      .catch(() => {})
      .then(operation)
      .finally(() => {
        if (channelOperations.get(channel) === next) {
          channelOperations.delete(channel);
        }
      });

    channelOperations.set(channel, next);
    return next;
  }

  async function scheduleChannelSubscribe(channel) {
    return withChannelOperation(channel, async () => {
      const ids = channelSubscribers.get(channel);
      if (!ids || ids.size === 0 || subscribedChannels.has(channel)) {
        return;
      }

      const client = await getSubscriberClient();
      await client.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          if (!parsed || typeof parsed !== "object") return;

          const eventName =
            typeof parsed.eventName === "string" && parsed.eventName.trim()
              ? parsed.eventName
              : null;
          if (!eventName) return;

          const targetUserId =
            typeof parsed.targetUserId === "string" && parsed.targetUserId.trim()
              ? parsed.targetUserId
              : undefined;

          deliverLocal(eventName, parsed.data ?? null, targetUserId);
        } catch (error) {
          logger.warn({ channel }, "Notification Redis payload parse failed", {
            error: error?.message,
          });
        }
      });

      subscribedChannels.add(channel);
    }).catch((error) => {
      logger.warn({ channel }, "Notification Redis subscribe unavailable", {
        error: error?.message,
      });
    });
  }

  async function scheduleChannelUnsubscribe(channel) {
    return withChannelOperation(channel, async () => {
      const ids = channelSubscribers.get(channel);
      if ((ids && ids.size > 0) || !subscribedChannels.has(channel)) {
        return;
      }

      const client = await getSubscriberClient();
      await client.unsubscribe(channel);
      subscribedChannels.delete(channel);
    }).catch((error) => {
      logger.warn({ channel }, "Notification Redis unsubscribe failed", {
        error: error?.message,
      });
    });
  }

  async function publishNotification(eventName, data, targetUserId) {
    if (!redisClient || typeof redisClient.publish !== "function") {
      throw new Error("Redis notification stream requires publish()");
    }

    const channel = getUserChannel(targetUserId);
    const message = JSON.stringify({
      source: INSTANCE_ID,
      eventName,
      data,
      targetUserId,
      ts: new Date().toISOString(),
    });

    await redisClient.publish(channel, message);
  }

  const adapter = {
    addSubscriber(res, userId) {
      const id = `sub_${++subscriberSeq}_${Date.now()}`;
      subscribers.set(id, { res, userId });

      if (userId) {
        const channel = getUserChannel(userId);
        const ids = channelSubscribers.get(channel) || new Set();
        ids.add(id);
        channelSubscribers.set(channel, ids);
        void scheduleChannelSubscribe(channel);
      }

      return id;
    },

    removeSubscriber(id) {
      removeSubscriberRecord(id);
    },

    broadcast(eventName, data, targetUserId) {
      if (!targetUserId) {
        deliverLocal(eventName, data);
        return;
      }

      void publishNotification(eventName, data, targetUserId).catch((error) => {
        logger.warn({ targetUserId }, "Notification Redis publish failed", {
          error: error?.message,
        });
        deliverLocal(eventName, data, targetUserId);
      });
    },

    pingAll() {
      deliverLocal("ping", { ts: Date.now() });
    },

    getSubscriberCount() {
      return subscribers.size;
    },
  };

  assertNotificationStreamPort(adapter);
  return adapter;
}
