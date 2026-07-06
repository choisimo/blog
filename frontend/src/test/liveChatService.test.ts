import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  sendLiveChatMessage,
  updateLiveChatConfig,
} from "@/services/chat/live";

const mocks = vi.hoisted(() => ({
  getPrincipalToken: vi.fn(),
}));

vi.mock("@/services/session/userContentAuth", () => ({
  getPrincipalToken: mocks.getPrincipalToken,
}));

vi.mock("@/lib/auth", () => ({
  bearerAuth: (token: string) => ({ Authorization: `Bearer ${token}` }),
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: () => "https://api.example.com/",
}));

describe("live chat service", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPrincipalToken.mockResolvedValue("principal-token");
    fetchMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects blank session IDs before requesting credentials or posting", async () => {
    await expect(
      sendLiveChatMessage({ sessionId: "  \n", text: "hello" }),
    ).rejects.toThrow("Live chat session ID is required");

    expect(mocks.getPrincipalToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects blank message text before requesting credentials or posting", async () => {
    await expect(
      sendLiveChatMessage({ sessionId: "session-1", text: " \t\n " }),
    ).rejects.toThrow("Live chat message text is required");

    expect(mocks.getPrincipalToken).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trims outbound live chat payload fields", async () => {
    await sendLiveChatMessage({
      sessionId: " session-1 ",
      text: " hello ",
      room: " lobby ",
      name: " Alice ",
      senderType: "agent",
      replyToName: " Bob ",
      mentionedAgents: [" Mentor ", "  ", "EXPLORER"],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/v1/chat/live/message");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer principal-token",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      text: "hello",
      room: "lobby",
      name: "Alice",
      senderType: "agent",
      sessionId: "session-1",
      replyToName: "Bob",
      mentionedAgents: ["mentor", "explorer"],
    });
  });

  it("rejects invalid live config keys before sending header values", async () => {
    await expect(
      updateLiveChatConfig({
        configKey: " \n ",
        policy: { temperature: 0.3 },
      }),
    ).rejects.toThrow("Live chat config key is required");

    await expect(
      updateLiveChatConfig({
        configKey: "secret\r\nX-Injected: yes",
        policy: { temperature: 0.3 },
      }),
    ).rejects.toThrow("Live chat config key is required");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("trims live config keys before sending the update header", async () => {
    const policy = {
      silenceProbability: 0.1,
      minDelayMs: 100,
      maxDelayMs: 200,
      maxReplyChars: 500,
      temperature: 0.3,
      historyLimit: 20,
      maxRoundTurns: 3,
      liveResearchEnabled: true,
      redisBridgeEnabled: false,
      redisBridgeFailed: false,
      redisPresenceTtlSec: 60,
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, data: { policy } }),
    });

    await expect(
      updateLiveChatConfig({
        configKey: " live-config-key ",
        policy: { temperature: 0.3 },
      }),
    ).resolves.toEqual(policy);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/v1/chat/live/config");
    expect(init.method).toBe("PUT");
    expect(init.credentials).toBe("include");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Live-Config-Key": "live-config-key",
    });
    expect(JSON.parse(String(init.body))).toEqual({ temperature: 0.3 });
  });
});
