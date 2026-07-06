import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mockLoadMore = vi.hoisted(() => vi.fn());
const mockUseThoughtFeed = vi.hoisted(() => vi.fn());

vi.mock("./hooks/useThoughtFeed", () => ({
  useThoughtFeed: mockUseThoughtFeed,
}));

vi.mock("./ThoughtCard", () => ({
  default: () => <article>Thought card</article>,
}));

import ThoughtFeed from "./ThoughtFeed";

describe("ThoughtFeed", () => {
  it("normalizes metadata props before passing them to the hook", () => {
    const onReady = vi.fn();
    mockUseThoughtFeed.mockReturnValue({
      cards: [],
      loading: false,
      loadingMore: false,
      appendWarming: false,
      exhausted: false,
      status: "idle",
      loadMore: mockLoadMore,
    });

    render(
      <ThoughtFeed
        paragraph="```ts\nconst answer = 42;\n```"
        postTitle="Post\u0000\r\nInjected\u007F"
        cacheKey="sentio\u0000/cache\r\nkey\u007F"
        enabled
        onReady={onReady}
      />,
    );

    expect(screen.getByText("아직 표시할 thought 카드가 없습니다.")).toBeInTheDocument();
    expect(mockUseThoughtFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        paragraph: "```ts\nconst answer = 42;\n```",
        postTitle: "Post Injected",
        cacheKey: "sentio-cache-key",
        enabled: true,
        onReady,
      }),
    );
  });
});
