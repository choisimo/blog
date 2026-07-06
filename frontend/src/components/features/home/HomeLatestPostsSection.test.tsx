import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { HomeLatestPostsSection } from "./HomeLatestPostsSection";

vi.mock("@/components/common/OptimizedImage", () => ({
  OptimizedImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock("@/utils/content/blog", () => ({
  formatDate: () => "January 1, 2026",
}));

describe("HomeLatestPostsSection", () => {
  it("sanitizes latest post links, tags, and error display", () => {
    const { rerender } = render(
      <MemoryRouter>
        <HomeLatestPostsSection
          state="ready"
          isTerminal={false}
          error={null}
          posts={[
            {
              year: "2026",
              slug: "safe-post",
              title: "Safe\u0000\r\nTitle\u007F",
              category: "Category\u0000",
              date: "2026-01-01",
              description: "Description\r\nText",
              readingTime: "3\r\nmin",
            },
            {
              year: "2026",
              slug: "bad%2Fslug",
              title: "Unsafe Post",
              category: "Bad",
              date: "2026-01-01",
            },
          ] as any}
          tags={[
            { name: "Tag\u0000\r\nOne", count: 4.9 },
            { name: "bad/slash", count: 3 },
          ] as any}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Safe Title")).toBeInTheDocument();
    expect(screen.getByText("Description Text")).toBeInTheDocument();
    expect(screen.getByText("3 min")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Safe Title/i })).toHaveAttribute(
      "href",
      "/blog/2026/safe-post",
    );
    expect(screen.queryByText("Unsafe Post")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /#Tag One/i })).toHaveAttribute(
      "href",
      "/blog?tag=Tag%20One",
    );
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.queryByText("#bad/slash")).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <HomeLatestPostsSection
          state="error"
          isTerminal={false}
          error={"Load\u0000\r\nfailed\u007F"}
          posts={[]}
          tags={[]}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Load failed")).toBeInTheDocument();
  });
});
