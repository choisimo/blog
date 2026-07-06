import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ArticleQuickActions } from "./ArticleQuickActions";

vi.mock("@/components/features/blog", () => ({
  TocDrawer: ({ postTitle }: { postTitle?: string }) => (
    <div data-testid="toc-drawer">{postTitle}</div>
  ),
}));

describe("ArticleQuickActions", () => {
  it("does not render for polluted post ids", () => {
    const { container } = render(
      <ArticleQuickActions
        postId={"2026/post\u0000"}
        isTerminal={false}
        tocContent="# Heading"
        tocPostTitle="Title"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("sanitizes TOC post titles before passing them to the drawer", () => {
    render(
      <ArticleQuickActions
        postId="2026/post"
        isTerminal={false}
        tocContent="# Heading"
        tocPostTitle={"Post\u0000\r\nTitle\u007F"}
      />,
    );

    expect(screen.getByTestId("toc-drawer")).toHaveTextContent("Post Title");
  });
});
