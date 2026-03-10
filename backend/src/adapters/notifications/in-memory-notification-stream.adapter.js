import { assertNotificationStreamPort } from "../../application/ports/notification-stream.port.js";

function formatSsePayload(eventName, data) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * In-memory NotificationStream adapter.
 */
export function createInMemoryNotificationStreamAdapter() {
  /** @type {Map<string, {res: import("express").Response, userId?: string}>} */
  const subscribers = new Map();
  let subscriberSeq = 0;

  const adapter = {
    addSubscriber(res, userId) {
      const id = `sub_${++subscriberSeq}_${Date.now()}`;
      subscribers.set(id, { res, userId });
      return id;
    },

    removeSubscriber(id) {
      subscribers.delete(id);
    },

    broadcast(eventName, data, targetUserId) {
      const payload = formatSsePayload(eventName, data);
      const dead = [];

      for (const [id, sub] of subscribers) {
        if (targetUserId && sub.userId !== targetUserId) continue;
        try {
          sub.res.write(payload);
          if (typeof sub.res.flush === "function") sub.res.flush();
        } catch {
          dead.push(id);
        }
      }

      for (const id of dead) {
        subscribers.delete(id);
      }
    },

    pingAll() {
      const payload = formatSsePayload("ping", { ts: Date.now() });
      const dead = [];

      for (const [id, sub] of subscribers) {
        try {
          sub.res.write(payload);
          if (typeof sub.res.flush === "function") sub.res.flush();
        } catch {
          dead.push(id);
        }
      }

      for (const id of dead) {
        subscribers.delete(id);
      }
    },

    getSubscriberCount() {
      return subscribers.size;
    },
  };

  assertNotificationStreamPort(adapter);
  return adapter;
}
