import { describe, expect, it } from "vitest";

import { formatLiveRoomName } from "@/components/features/chat/widget";

describe("chat widget entrypoint utilities", () => {
  it("normalizes live room names before display and debate prompts", () => {
    expect(formatLiveRoomName(" room:blog:2026:safe\r\nInjected ")).toBe(
      "blog/2026/safe Injected",
    );
  });

  it("falls back for blank live room names", () => {
    expect(formatLiveRoomName(" \n ")).toBe("lobby");
    expect(formatLiveRoomName(null)).toBe("lobby");
  });
});
