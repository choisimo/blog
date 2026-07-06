import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockUseLensDeck = vi.hoisted(() => vi.fn());

vi.mock("./hooks/useLensDeck", () => ({
  useLensDeck: mockUseLensDeck,
}));

vi.mock("./LensCard", () => ({
  default: () => <article>Lens card</article>,
}));

import PrismDeck, { normalizePrismDeckText } from "./PrismDeck";

describe("PrismDeck", () => {
  it("normalizes metadata props before passing them to the hook", () => {
    const onReady = vi.fn();
    mockUseLensDeck.mockReturnValue({
      cards: [],
      activeCard: null,
      currentIndex: 0,
      loading: false,
      loadingMore: false,
      appendWarming: false,
      status: "idle",
      canGoPrev: false,
      canGoNext: false,
      goPrev: vi.fn(),
      goNext: vi.fn(),
    });

    render(
      <PrismDeck
        paragraph="```ts\nconst answer = 42;\n```"
        postTitle="Post\u0000\r\nInjected\u007F"
        cacheKey="sentio\u0000/cache\r\nkey\u007F"
        enabled
        onReady={onReady}
      />,
    );

    expect(screen.getByText("아직 표시할 lens 카드가 없습니다.")).toBeInTheDocument();
    expect(mockUseLensDeck).toHaveBeenCalledWith(
      expect.objectContaining({
        paragraph: "```ts\nconst answer = 42;\n```",
        postTitle: "Post Injected",
        cacheKey: "sentio-cache-key",
        enabled: true,
        onReady,
      }),
    );
  });

  it("strips OSC and CSI ANSI escape sequences from deck metadata text", () => {
    expect(
      normalizePrismDeckText(
        "\u001b]0;Hidden title\u0007Visible \u001b[31mdeck\u001b[0m\u0000",
      ),
    ).toBe("Visible deck");
  });
});
