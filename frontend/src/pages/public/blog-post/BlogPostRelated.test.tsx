import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BlogPostRelated } from "./BlogPostRelated";

vi.mock("@/data/content/posts", () => ({
  prefetchPost: vi.fn(),
}));

describe("BlogPostRelated", () => {
  it("filters unsafe related post links and sanitizes display labels", () => {
    render(
      <MemoryRouter>
        <BlogPostRelated
          relatedPosts={[
            {
              year: "2026",
              slug: "safe-post",
              title: "Safe\u0000\r\nTitle\u007F",
              excerpt: "Excerpt\r\nText",
              categoryLabel: "Category\u0000Label",
              readingTimeLabel: "3\r\nmin",
            },
            {
              year: "2026",
              slug: "bad%2Fslug",
              title: "Unsafe Post",
              excerpt: "Unsafe",
              categoryLabel: "Unsafe",
              readingTimeLabel: "1 min",
            },
          ] as any}
          preservedSearch=""
          isTerminal={false}
          relatedPostsLabel="Related\u0000 Posts"
          relatedPostsDescLabel="More\r\nreading"
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Related Posts")).toBeInTheDocument();
    expect(screen.getByText("More reading")).toBeInTheDocument();
    expect(screen.getByText("Safe Title")).toBeInTheDocument();
    expect(screen.getByText("Excerpt Text")).toBeInTheDocument();
    expect(screen.getByText("Category Label")).toBeInTheDocument();
    expect(screen.queryByText("Unsafe Post")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Safe Title/i })).toHaveAttribute(
      "href",
      "/blog/2026/safe-post",
    );
  });
});
