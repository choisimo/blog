import { createD1SessionTokenStore } from "../../adapters/session/d1-session-token-store.adapter.js";
import { createLiveSessionAuthService } from "../services/live-session-auth.service.js";
import { createInMemoryNotificationStreamAdapter } from "../../adapters/notifications/in-memory-notification-stream.adapter.js";

let container = null;

export function getApplicationContainer() {
  if (container) return container;

  const sessionTokenStore = createD1SessionTokenStore();
  const liveSessionAuthService = createLiveSessionAuthService({
    sessionTokenStore,
  });
  const notificationStream = createInMemoryNotificationStreamAdapter();

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
