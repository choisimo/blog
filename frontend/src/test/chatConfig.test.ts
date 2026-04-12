import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildChatWebSocketUrl } from "@/services/chat/config";

describe("chat websocket capability gating", () => {
  const originalAppConfig = (window as Window & {
    APP_CONFIG?: unknown;
    __APP_CONFIG?: unknown;
  }).APP_CONFIG;

  beforeEach(() => {
    localStorage.clear();
    (window as Window & {
      APP_CONFIG?: Record<string, unknown>;
      __APP_CONFIG?: Record<string, unknown>;
    }).APP_CONFIG = {
      chatBaseUrl: "https://api.nodove.com",
      capabilities: {
        supportsChatWebSocket: false,
      },
    };
    delete (window as Window & { __APP_CONFIG?: unknown }).__APP_CONFIG;
  });

  afterEach(() => {
    localStorage.clear();
    (window as Window & { APP_CONFIG?: unknown }).APP_CONFIG = originalAppConfig;
    delete (window as Window & { __APP_CONFIG?: unknown }).__APP_CONFIG;
  });

  it("refuses local websocket overrides when runtime capability is disabled", () => {
    localStorage.setItem(
      "aiMemo.chatWsBaseUrl",
      JSON.stringify("wss://override.example.com"),
    );

    expect(() => buildChatWebSocketUrl("session-1")).toThrow(
      "Chat WebSocket capability is disabled",
    );
  });
});
