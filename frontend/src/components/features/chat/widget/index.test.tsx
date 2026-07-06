import { describe, expect, it } from "vitest";

import { formatLiveRoomName } from "./index";

describe("formatLiveRoomName", () => {
  it("strips ANSI and control characters from live room names", () => {
    expect(formatLiveRoomName("room:\u001b[31mdev\u001b[0m\u0000")).toBe("dev");
  });

  it("falls back to the lobby room label for empty or non-string values", () => {
    expect(formatLiveRoomName("")).toBe("lobby");
    expect(formatLiveRoomName(null)).toBe("lobby");
  });

  it("formats nested room ids as slash-separated labels", () => {
    expect(formatLiveRoomName("room:team:frontend")).toBe("team/frontend");
  });
});
