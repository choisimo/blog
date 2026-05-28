import { describe, expect, it } from "vitest";

// @ts-expect-error - frontend build imports a node-side script without TS declarations.
import { buildRuntimeConfigFromEnv } from "../../scripts/generate-runtime-config.js";

describe("runtime config generator", () => {
  it("does not advertise chat websocket support from static env flags", () => {
    const runtimeConfig = buildRuntimeConfigFromEnv(
      {
        APP_ENV: "production",
        API_BASE_URL: "https://api.example.com",
        CHAT_WS_ENABLED: "true",
        CHAT_WS_BASE_URL: "wss://ws.example.com",
        FEATURE_AI_ENABLED: "true",
        FEATURE_RAG_ENABLED: "true",
        FEATURE_AI_INLINE: "false",
        FEATURE_COMMENTS_ENABLED: "true",
      },
      { siteBaseUrl: "https://blog.example.com" }
    );

    expect(runtimeConfig.capabilities.supportsChatWebSocket).toBe(false);
    expect(runtimeConfig.chatWsBaseUrl).toBeNull();
  });

  it("suppresses terminal enablement when the gateway url is missing", () => {
    const runtimeConfig = buildRuntimeConfigFromEnv(
      {
        APP_ENV: "production",
        API_BASE_URL: "https://api.example.com",
        FEATURE_AI_ENABLED: "true",
        FEATURE_RAG_ENABLED: "true",
        FEATURE_TERMINAL_ENABLED: "true",
        FEATURE_AI_INLINE: "false",
        FEATURE_COMMENTS_ENABLED: "true",
      },
      { siteBaseUrl: "https://blog.example.com" }
    );

    expect(runtimeConfig.features.terminalEnabled).toBe(false);
    expect(runtimeConfig.terminalGatewayUrl).toBeNull();
    expect(runtimeConfig.capabilities.hasTerminalGatewayUrl).toBe(false);
  });

  it("uses the public API gateway for production artifacts when no explicit API base is set", () => {
    const runtimeConfig = buildRuntimeConfigFromEnv(
      {
        CI: "true",
        APP_ENV: "production",
      },
      { siteBaseUrl: "https://noblog.nodove.com" }
    );

    expect(runtimeConfig.apiBaseUrl).toBe("https://api.nodove.com");
    expect(runtimeConfig.chatBaseUrl).toBe("https://api.nodove.com");
  });
});
