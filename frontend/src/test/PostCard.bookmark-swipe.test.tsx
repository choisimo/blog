import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { PostCard } from "@/components/features/blog";
import { useIsBookmarked } from "@/hooks/content/useBookmarks";
import { useSwipe } from "@/hooks/gesture/useSwipe";

vi.mock("@/hooks/content/useBookmarks", () => ({
  useIsBookmarked: vi.fn(),
}));

vi.mock("@/hooks/gesture/useSwipe", () => ({
  useSwipe: vi.fn(),
}));

vi.mock("@/hooks/gesture/useTilt", () => ({
  useTilt: () => ({ current: null }),
}));

vi.mock("@/hooks/i18n/useLanguage", () => ({
  default: () => ({ language: "en" }),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock("@/data/content/posts", () => ({
  prefetchPost: vi.fn(),
}));

vi.mock("@/components/common/OptimizedImage", () => ({
  OptimizedImage: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} />
  ),
}));

const mockedUseSwipe = vi.mocked(useSwipe);
const mockedUseIsBookmarked = vi.mocked(useIsBookmarked);

const post = {
  id: "post-1",
  slug: "bookmark-overlap",
  year: "2026",
  title: "Bookmark overlap",
  description: "Bookmark swipe overlap regression",
  excerpt: "Bookmark swipe overlap regression",
  date: "2026-03-29",
  category: "Development",
  tags: ["ui"],
  content: "content",
  readingTime: "5 min read",
  readTime: 5,
  author: "tester",
  published: true,
  coverImage: "/images/2026/bookmark-overlap/cover.png",
};

function renderCard() {
  return render(
    <MemoryRouter>
      <PostCard post={post} variant="list" />
    </MemoryRouter>,
  );
}

describe("PostCard bookmark swipe state", () => {
  beforeEach(() => {
    mockedUseIsBookmarked.mockReturnValue({
      bookmarked: false,
      toggleBookmark: vi.fn(),
    });

    mockedUseSwipe.mockReturnValue({
      ref: { current: null },
      deltaX: 0,
      deltaY: 0,
      swiping: null,
    });
  });

  it("shows the bookmark action when no swipe hint is active", () => {
    renderCard();

    expect(screen.getByLabelText("Add bookmark")).toBeInTheDocument();
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });

  it("hides the bookmark action while the swipe hint is visible", () => {
    mockedUseSwipe.mockReturnValue({
      ref: { current: null },
      deltaX: 40,
      deltaY: 0,
      swiping: "right",
    });

    renderCard();

    expect(screen.queryByLabelText("Add bookmark")).not.toBeInTheDocument();
    expect(screen.getByText("Save")).toBeInTheDocument();
  });
});
