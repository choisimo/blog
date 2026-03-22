import { createD1SessionTokenStore } from "../../adapters/session/d1-session-token-store.adapter.js";
import { createLiveSessionAuthService } from "../services/live-session-auth.service.js";
import { createInMemoryNotificationStreamAdapter } from "../../adapters/notifications/in-memory-notification-stream.adapter.js";
import { createRedisNotificationStreamAdapter } from "../../adapters/notifications/redis-notification-stream.adapter.js";
import { getRedisClient } from "../../lib/redis-client.js";

let container = null;

function createNotificationStream() {
  const inMemoryAdapter = createInMemoryNotificationStreamAdapter();

  if (!process.env.REDIS_URL) {
    return inMemoryAdapter;
  }

  try {
    return createRedisNotificationStreamAdapter({
      async publish(channel, message) {
        const client = await getRedisClient();
        return client.publish(channel, message);
      },
      async duplicate() {
        const client = await getRedisClient();
        return client.duplicate();
      },
    });
  } catch {
    return inMemoryAdapter;
  }
}

export function getApplicationContainer() {
  if (container) return container;

  const sessionTokenStore = createD1SessionTokenStore();
  const liveSessionAuthService = createLiveSessionAuthService({
    sessionTokenStore,
  });
  const notificationStream = createNotificationStream();

  container = {
    ports: {
      sessionTokenStore,
      notificationStream,
    },
    services: {
      liveSessionAuthService,
    },
  };

  return container;
}
