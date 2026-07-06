import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BlogPostContent } from "./BlogPostContent";

const markdownRendererMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/features/blog/MarkdownRenderer", () => ({
  default: (props: {
    content: string;
    inlineEnabled: boolean;
    postTitle: string;
    postPath: string;
  }) => {
    markdownRendererMock(props);
    return <div data-testid="markdown-renderer">{props.postTitle}</div>;
  },
}));

describe("BlogPostContent", () => {
  it("preserves markdown content while sanitizing metadata passed to MarkdownRenderer", async () => {
    render(
      <BlogPostContent
        content={"# Heading\u0000\n\nBody"}
        inlineEnabled
        postTitle={"Post\u0000\r\nTitle\u007F"}
        postPath={"2026/post\u0000/../safe slug"}
        isTerminal={false}
      />,
    );

    expect(await screen.findByTestId("markdown-renderer")).toHaveTextContent(
      "Post Title",
    );
    await waitFor(() => {
      expect(markdownRendererMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "# Heading\u0000\n\nBody",
          inlineEnabled: true,
          postTitle: "Post Title",
          postPath: "2026/post/safe%20slug",
        }),
      );
    });
  });
});
