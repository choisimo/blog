import type { BlogPost } from "@/types/blog";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { searchWeb } from "@/services/discovery/webSearch";
import SearchBar, {
  normalizeSearchBarErrorMessage,
  normalizeSearchQuery,
} from "./SearchBar";

const isTerminalMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isTerminal: isTerminalMock() }),
}));

vi.mock("@/services/discovery/webSearch", () => ({
  searchWeb: vi.fn(),
}));

const searchWebMock = vi.mocked(searchWeb);

function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    title: "React patterns",
    description: "Frontend architecture",
    content: "React testing content",
    tags: ["React"],
    category: "Frontend",
    slug: "react-patterns",
    year: "2026",
    ...overrides,
  } as BlogPost;
}

describe("SearchBar", () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    isTerminalMock.mockReturnValue(false);
    searchWebMock.mockResolvedValue({
      results: [],
      answer: "web answer",
      query: "",
      responseTime: 0,
    });
  });

  it("sanitizes search labels, title, placeholder, query display, and clear label", () => {
    const onSearchResults = vi.fn();
    const { container } = render(
      <SearchBar
        posts={[post()]}
        onSearchResults={onSearchResults}
        label={"\u001b[35mSite search\u0000"}
        title={"\u001b[34mSearch box\u0007"}
        inputLabel={"\u001b[31mSearch input\u0000"}
        clearLabel={"\u001b[32mClear input\u0000"}
        placeholder={"\u001b[33mFind posts\u0000"}
        enableWebSearch={false}
      />
    );

    expect(screen.getByRole("search", { name: "Site search" })).toHaveAttribute(
      "title",
      "Search box"
    );
    const input = screen.getByRole("textbox", { name: "Search input" });
    expect(input).toHaveAttribute("placeholder", "Find posts");

    fireEvent.change(input, { target: { value: "\u001b[31mReact\u0000" } });

    expect(screen.getByText("'React' 검색 결과")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear input" })).toBeInTheDocument();
    expect(onSearchResults).toHaveBeenLastCalledWith([expect.objectContaining({ title: "React patterns" })]);
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("\u0000");
  });

  it("shows web search prompt and searches with a sanitized query", async () => {
    vi.useFakeTimers();
    const onWebSearchResults = vi.fn();
    render(
      <SearchBar
        posts={[post()]}
        onSearchResults={vi.fn()}
        onWebSearchResults={onWebSearchResults}
        webSearchLabel={"\u001b[31mSearch web\u0000"}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Search blog posts" }), {
      target: { value: "\u001b[31mNo match\u0000" },
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    fireEvent.click(screen.getByRole("button", { name: "Search web" }));

    await waitFor(() => {
      expect(searchWebMock).toHaveBeenCalledWith("No match", { maxResults: 5 });
    });
    await waitFor(() => {
      expect(onWebSearchResults).toHaveBeenCalledWith([], "web answer");
    });
  });

  it("sanitizes terminal input labels, placeholder, clear button, and grep preview", () => {
    isTerminalMock.mockReturnValue(true);
    const { container } = render(
      <SearchBar
        posts={[post()]}
        onSearchResults={vi.fn()}
        inputLabel={"\u001b[31mTerminal search\u0000"}
        clearLabel={"\u001b[32mClear terminal\u0000"}
        terminalPlaceholder={"\u001b[33m--pattern safe\u0000"}
        enableWebSearch={false}
      />
    );

    const input = screen.getByRole("textbox", { name: "Terminal search" });
    expect(input).toHaveAttribute("placeholder", "--pattern safe");

    fireEvent.change(input, { target: { value: "\u001b[31mReact\u0000" } });

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear terminal" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("\u0000");
  });

  it("sanitizes error messages", () => {
    expect(normalizeSearchBarErrorMessage("\u001b[31mNetwork down\u0000")).toBe(
      "Network down"
    );
    expect(normalizeSearchBarErrorMessage("\u0000")).toBe("Web search failed");
  });

  it("strips OSC and CSI ANSI escape sequences from query text", () => {
    expect(
      normalizeSearchQuery("\u001b]0;Hidden title\u0007Visible \u001b[31mquery\u001b[0m\u0000")
    ).toBe("Visible query");
  });
});
