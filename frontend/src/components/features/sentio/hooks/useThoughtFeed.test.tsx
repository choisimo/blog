import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useThoughtFeed } from "./useThoughtFeed";
import { invokeThoughtFeed } from "@/services/chat";

vi.mock("@/services/chat", () => ({
  invokeChatTask: vi.fn(),
  invokeThoughtFeed: vi.fn(),
}));

vi.mock("@/config/defaults", () => ({
  FALLBACK_DATA: {
    CHAIN: {
      QUESTIONS: [],
    },
  },
}));

describe("useThoughtFeed", () => {
  beforeEach(() => {
    vi.mocked(invokeThoughtFeed).mockReset();
  });

  it("normalizes feed card response fields before exposing them", async () => {
    const onReady = vi.fn();
    vi.mocked(invokeThoughtFeed).mockResolvedValue({
      items: [
        {
          id: "card\u0000/1",
          trackKey: "track\u0000|1",
          title: "Title\u0000\r\nInjected\u007F",
          subtitle: "Subtitle\u007F",
          body: "Body\r\nInjected",
          bullets: ["One\u0000", "Two\r\nInjected\u007F", ""],
          tags: ["Tag\r\nInjected\u007F"],
        },
      ],
      exhausted: true,
      nextCursor: {
        seed: "seed\u0000/value",
        page: 2.8,
        seenKeys: ["track\u0000|1"],
      },
    });

    const { result } = renderHook(() =>
      useThoughtFeed({
        paragraph: "paragraph",
        cacheKey: "cache-key",
        enabled: true,
        onReady,
      }),
    );

    await waitFor(() => {
      expect(result.current.cards).toHaveLength(1);
    });

    expect(result.current.cards[0]).toMatchObject({
      id: "card-1",
      trackKey: "track-1",
      title: "Title Injected",
      subtitle: "Subtitle",
      body: "Body Injected",
      bullets: ["One", "Two Injected"],
      tags: ["tag injected"],
    });
    expect(onReady).toHaveBeenCalledWith(
      [expect.objectContaining({ trackKey: "track-1" })],
      "feed",
    );
  });
});
