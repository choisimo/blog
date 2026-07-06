import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLensDeck } from "./useLensDeck";
import { invokeLensFeed } from "@/services/chat";

vi.mock("@/services/chat", () => ({
  invokeChatTask: vi.fn(),
  invokeLensFeed: vi.fn(),
}));

vi.mock("@/config/defaults", () => ({
  FALLBACK_DATA: {
    PRISM: {
      FACETS: [],
    },
  },
}));

describe("useLensDeck", () => {
  beforeEach(() => {
    vi.mocked(invokeLensFeed).mockReset();
  });

  it("normalizes lens feed card response fields before exposing them", async () => {
    const onReady = vi.fn();
    vi.mocked(invokeLensFeed).mockResolvedValue({
      items: [
        {
          id: "card\u0000/1",
          personaId: "mentor\u0000",
          angleKey: "angle\u0000|1",
          title: "Title\u0000\r\nInjected\u007F",
          summary: "Summary\u007F",
          bullets: ["One\u0000", "Two\r\nInjected\u007F", ""],
          detail: "Detail\r\nInjected",
          tags: ["Tag\r\nInjected\u007F"],
        },
      ],
      exhausted: true,
      nextCursor: {
        seed: "seed\u0000/value",
        page: 3.4,
        seenKeys: ["angle\u0000|1"],
      },
    });

    const { result } = renderHook(() =>
      useLensDeck({
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
      personaId: "mentor",
      angleKey: "angle-1",
      title: "Title Injected",
      summary: "Summary",
      bullets: ["One", "Two Injected"],
      detail: "Detail Injected",
      tags: ["tag injected"],
    });
    expect(onReady).toHaveBeenCalledWith(
      [expect.objectContaining({ angleKey: "angle-1" })],
      "feed",
    );
  });
});
