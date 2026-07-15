import { afterEach, describe, expect, it, vi } from "vitest";

import { AI_TASK_TIMEOUT_MS, sketch } from "./ai";

vi.mock("@/services/session/userContentAuth", () => ({
  getPrincipalToken: vi.fn().mockResolvedValue("anonymous-token"),
  refreshPrincipalTokenAfterAuthFailure: vi.fn(),
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: () => "https://api.nodove.com",
}));

vi.mock("@/services/chat", () => ({
  invokeChatTask: vi.fn(),
}));

describe("AI task timeout budget", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps direct production inference within the 120 second UI budget", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: { mood: "confident", bullets: ["production response"] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    await expect(sketch({ paragraph: "Production inference" })).resolves.toEqual({
      mood: "confident",
      bullets: ["production response"],
    });
    expect(AI_TASK_TIMEOUT_MS).toBe(120_000);
    expect(timeout).toHaveBeenCalledWith(120_000);
  });
});
