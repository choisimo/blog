import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fingerprintjs/fingerprintjs", () => ({
  default: {
    load: vi.fn(async () => ({
      get: vi.fn(async () => ({ visitorId: "fpjs-visitor" })),
    })),
  },
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: vi.fn(() => "https://api.example.com"),
}));

vi.mock("@/utils/fingerprint", () => ({
  getAudioFingerprint: vi.fn(async () => "audio-hash"),
  getCanvasFingerprint: vi.fn(async () => "canvas-hash"),
  getWebGLFingerprint: vi.fn(async () => "webgl-hash"),
  sha256: vi.fn(async () => "advanced-visitor-id"),
}));

import {
  createSession,
  recoverSession,
  validateSession,
} from "@/services/session/fingerprint";

describe("fingerprint session", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("returns a valid created session even when session persistence fails", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key === "nodove_session_token") {
        throw new Error("storage unavailable");
      }
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            sessionToken: "session-token",
            fingerprintId: "fingerprint-id",
            expiresAt: "2026-07-04T00:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(createSession()).resolves.toMatchObject({
      sessionToken: "session-token",
      fingerprintId: "fingerprint-id",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/user/session",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
  });

  it("creates a session with a safe user agent fallback when navigator is unavailable", async () => {
    vi.stubGlobal("navigator", undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            sessionToken: "session-token",
            fingerprintId: "fingerprint-id",
            expiresAt: "2026-07-04T00:00:00.000Z",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(createSession()).resolves.toMatchObject({
      sessionToken: "session-token",
      fingerprintId: "fingerprint-id",
    });

    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(requestInit.body))).toMatchObject({
      userAgent: "unknown",
    });
  });

  it("does not validate an empty session token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(validateSession("   ")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not recover an empty session token", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await expect(recoverSession("   ")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
