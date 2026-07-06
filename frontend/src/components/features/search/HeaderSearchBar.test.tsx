import type { BlogPost } from "@/types/blog";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePostsIndex } from "@/hooks/content/usePostsIndex";
import {
  addSearchQuery,
  getRecentQueries,
  removeSearchQuery,
} from "@/services/session/searchHistory";
import HeaderSearchBar, { normalizeSearchText } from "./HeaderSearchBar";

const navigateMock = vi.hoisted(() => vi.fn());
const locationMock = vi.hoisted(() =>
  vi.fn(() => ({ pathname: "/blog", search: "", state: null }))
);
const isTerminalMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => locationMock(),
}));

vi.mock("@/hooks/content/usePostsIndex", () => ({
  usePostsIndex: vi.fn(),
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isTerminal: isTerminalMock() }),
}));

vi.mock("@/services/session/searchHistory", () => ({
  getRecentQueries: vi.fn(() => []),
  addSearchQuery: vi.fn(),
  removeSearchQuery: vi.fn(),
}));

vi.mock("@/components/molecules/MiniTerminal", () => ({
  MiniTerminal: () => <div>Mini terminal</div>,
}));

const usePostsIndexMock = vi.mocked(usePostsIndex);
const getRecentQueriesMock = vi.mocked(getRecentQueries);

function post(overrides: Partial<BlogPost> = {}): BlogPost {
  return {
    title: "React Patterns",
    description: "Frontend architecture",
    tags: ["React"],
    category: "Frontend",
    readingTime: "3 min read",
    year: "2026",
    slug: "react-patterns",
    ...overrides,
  } as BlogPost;
}

describe("HeaderSearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTerminalMock.mockReturnValue(false);
    locationMock.mockReturnValue({ pathname: "/blog", search: "", state: null });
    getRecentQueriesMock.mockReturnValue([]);
    usePostsIndexMock.mockReturnValue({
      posts: [
        post({
          title: "\u001b[31mReact Patterns\u0000",
          category: "\u001b[32mFrontend\u0007",
          readingTime: "\u001b[33m3 min read\u0000",
        }),
      ],
    } as ReturnType<typeof usePostsIndex>);
  });

  it("sanitizes inline search labels, placeholders, result text, and navigation", () => {
    const { container } = render(
      <HeaderSearchBar
        presentation="inline"
        label={"\u001b[35mHeader search\u0000"}
        title={"\u001b[34mSearch title\u0007"}
        inputLabel={"\u001b[31mSearch input\u0000"}
        placeholder={"\u001b[32mFind posts\u0000"}
        clearLabel={"\u001b[33mClear input\u0000"}
        resultLabel={"\u001b[36mOpen post\u0000"}
      />
    );

    expect(screen.getByRole("search", { name: "Header search" })).toHaveAttribute(
      "title",
      "Search title"
    );
    const input = screen.getByRole("textbox", { name: "Search input" });
    expect(input).toHaveAttribute("placeholder", "Find posts");

    fireEvent.change(input, { target: { value: "\u001b[31mReact\u0000" } });

    expect(screen.getByRole("button", { name: "Open post: React Patterns" })).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("3 min read")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear input" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open post: React Patterns" }));

    expect(addSearchQuery).toHaveBeenCalledWith("React");
    expect(navigateMock).toHaveBeenCalledWith("/blog/2026/react-patterns");
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("\u0000");
  });

  it("sanitizes recent history labels and removes sanitized history entries", () => {
    getRecentQueriesMock.mockReturnValue(["\u001b[31mReact\u0000", "React", "\u0000"]);
    render(
      <HeaderSearchBar
        presentation="inline"
        inputLabel="Search input"
        recentSearchesLabel={"\u001b[32mRecent\u0000"}
        recentSearchLabel={"\u001b[33mUse recent\u0000"}
        removeHistoryLabel={"\u001b[34mForget\u0000"}
      />
    );

    const input = screen.getByRole("textbox", { name: "Search input" });
    fireEvent.focus(input);

    expect(screen.getByText("Recent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Forget: React" }));
    expect(removeSearchQuery).toHaveBeenCalledWith("React");

    fireEvent.click(screen.getByRole("button", { name: "Use recent: React" }));
    expect(input).toHaveValue("React");
  });

  it("sanitizes terminal input labels, placeholder, terminal path, and clear label", () => {
    class ResizeObserverMock {
      observe = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    isTerminalMock.mockReturnValue(true);
    locationMock.mockReturnValue({ pathname: "/blog/\u001b[31mpost\u0000", search: "", state: null });

    const { container } = render(
      <HeaderSearchBar
        presentation="inline"
        inputLabel={"\u001b[31mTerminal search\u0000"}
        terminalPlaceholder={"\u001b[32m/path search\u0000"}
        clearLabel={"\u001b[33mClear terminal\u0000"}
        openTerminalLabel={"\u001b[34mOpen shell\u0000"}
      />
    );

    expect(screen.getByRole("button", { name: "Open shell" })).toBeInTheDocument();
    const input = screen.getByRole("textbox", { name: "Terminal search" });
    expect(input).toHaveAttribute("placeholder", "/path search");

    fireEvent.change(input, { target: { value: "React" } });

    expect(screen.getByRole("button", { name: "Clear terminal" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("\u001b");
    expect(container.textContent).not.toContain("\u0000");
  });

  it("strips OSC and CSI ANSI escape sequences from shared search text", () => {
    expect(
      normalizeSearchText("\u001b]0;Hidden title\u0007Visible \u001b[31mquery\u001b[0m\u0000"),
    ).toBe("Visible query");
  });
});
