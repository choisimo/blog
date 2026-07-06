import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { BlogPostHeader } from "./BlogPostHeader";

const mockNavigate = vi.fn();
const mockTrackTagClick = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/components/features/navigation/Breadcrumb", () => ({
  Breadcrumb: ({ items }: { items: Array<{ label: string; href?: string }> }) => (
    <nav>
      {items.map((item) => (
        <span key={item.label} data-href={item.href}>
          {item.label}
        </span>
      ))}
    </nav>
  ),
}));

vi.mock("@/components/features/blog/SafeDescriptionMarkdown", () => ({
  SafeDescriptionMarkdown: ({ text }: { text: string }) => <p>{text}</p>,
}));

vi.mock("@/services/engagement/curiosity", () => ({
  curiosityTracker: {
    trackTagClick: mockTrackTagClick,
  },
}));

vi.mock("@/utils/content/blog", () => ({
  formatDate: () => "January 1, 2026",
}));

function renderHeader() {
  return render(
    <MemoryRouter>
      <BlogPostHeader
        post={{
          year: "2026",
          slug: "safe-post",
          category: "Engineering\u0000\r\nCategory",
          tags: ["Tag\u0000\r\nOne", "bad/slash"],
        } as any}
        postView={{
          title: "Post\u0000\r\nTitle\u007F",
          description: "Description",
          date: "2026-01-01",
          categoryLabel: "Category\u0000\r\nLabel",
          readingTimeLabel: "3\r\nmin",
          author: "Author\u0000Name",
          tagLabels: ["Tag\u0000Label", "Bad Slash"],
        } as any}
        year={"2026\u0000"}
        slug="safe-post"
        language="en"
        setLanguage={vi.fn()}
        availableLanguages={["en"]}
        resolveLanguageName={() => "English"}
        translationStatus="idle"
        aiTranslation={null}
        hasNativeTranslation={false}
        translationError={{ message: "Failed\u0000\r\nBadly", retryable: false }}
        onRetryTranslation={vi.fn()}
        isTerminal
        preservedSearch=""
        onShare={vi.fn()}
        backToBlogLabel="Back"
        shareLabel="Share"
        readingLanguageLabel="Language"
        translatingLabel="Translating"
        aiTranslatedLabel="AI translated"
        translationFailedLabel="Failed"
        showingOriginalLabel="Showing original"
        retryLabel="Retry"
      />
    </MemoryRouter>,
  );
}

describe("BlogPostHeader", () => {
  it("sanitizes header metadata and tag navigation", () => {
    renderHeader();

    expect(screen.getAllByText("Post Title").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Category Label").length).toBeGreaterThan(0);
    expect(screen.getByText("time: 3 min")).toBeInTheDocument();
    expect(screen.getByText("author: Author Name")).toBeInTheDocument();
    expect(screen.getByText("Failed Badly")).toBeInTheDocument();
    expect(screen.getByText("[Tag Label]")).toBeInTheDocument();
    expect(screen.queryByText("[Bad Slash]")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("[Tag Label]"));

    expect(mockTrackTagClick).toHaveBeenCalledWith("Tag One", "2026/safe-post");
    expect(mockNavigate).toHaveBeenCalledWith("/blog?tag=Tag%20One");
  });
});
