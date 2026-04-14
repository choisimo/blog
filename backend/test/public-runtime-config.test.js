import test from "node:test";
import assert from "node:assert/strict";

import { buildPublicRuntimeConfig } from "../../shared/src/contracts/public-runtime-config.js";

process.env.APP_ENV = process.env.APP_ENV || "test";
process.env.SITE_BASE_URL = process.env.SITE_BASE_URL || "https://blog.example.com";
process.env.API_BASE_URL = process.env.API_BASE_URL || "https://api.example.com/";
process.env.CHAT_WS_ENABLED = process.env.CHAT_WS_ENABLED || "true";
process.env.TERMINAL_GATEWAY_URL =
  process.env.TERMINAL_GATEWAY_URL || "wss://terminal.example.com/";
process.env.AI_DEFAULT_MODEL = process.env.AI_DEFAULT_MODEL || "gpt-4.1";
process.env.AI_VISION_MODEL = process.env.AI_VISION_MODEL || "gpt-4o";
process.env.FEATURE_AI_ENABLED = process.env.FEATURE_AI_ENABLED || "true";
process.env.FEATURE_RAG_ENABLED = process.env.FEATURE_RAG_ENABLED || "true";
process.env.FEATURE_TERMINAL_ENABLED =
  process.env.FEATURE_TERMINAL_ENABLED || "true";
process.env.FEATURE_AI_INLINE = process.env.FEATURE_AI_INLINE || "false";
process.env.FEATURE_COMMENTS_ENABLED =
  process.env.FEATURE_COMMENTS_ENABLED || "true";

const { publicRuntimeConfig } = await import("../src/config/index.js");

test("publicRuntimeConfig uses the shared contract shape", () => {
  assert.deepEqual(
    publicRuntimeConfig(),
    buildPublicRuntimeConfig({
      env: "test",
      siteBaseUrl: "https://blog.example.com",
      apiBaseUrl: "https://api.example.com/",
      chatBaseUrl: "https://api.example.com/",
      supportsChatWebSocket: false,
      terminalGatewayUrl: "wss://terminal.example.com/",
      ai: {
        modelSelectionEnabled: false,
        defaultModel: "gpt-4.1",
        visionModel: "gpt-4o",
      },
      features: {
        aiEnabled: true,
        ragEnabled: true,
        terminalEnabled: true,
        aiInline: false,
        commentsEnabled: true,
      },
    }),
  );
});

test("shared public runtime config suppresses terminal capability without a gateway url", () => {
  const result = buildPublicRuntimeConfig({
    env: "test",
    siteBaseUrl: "https://blog.example.com",
    apiBaseUrl: "https://api.example.com/",
    chatBaseUrl: "https://api.example.com/",
    supportsChatWebSocket: false,
    terminalGatewayUrl: "",
    ai: {
      modelSelectionEnabled: false,
      defaultModel: "gpt-4.1",
      visionModel: "gpt-4o",
    },
    features: {
      aiEnabled: true,
      ragEnabled: true,
      terminalEnabled: true,
      aiInline: false,
      commentsEnabled: true,
    },
  });

  assert.equal(result.features.terminalEnabled, false);
  assert.equal(result.terminalGatewayUrl, null);
  assert.equal(result.capabilities.hasTerminalGatewayUrl, false);
});
