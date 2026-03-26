import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, test, expect, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  // Two-level proxy: str.section.key → "" (string primitive, renderable by React)
  const makeLeafProxy = () =>
    new Proxy({} as Record<string, string>, {
      get(_t, _k) {
        return "";
      },
    });
  const makeUIStrings = () =>
    new Proxy({} as Record<string, Record<string, string>>, {
      get(_t, _k) {
        return makeLeafProxy();
      },
    });

  return {
    currentLanguage: "ko",
    hasTranslationSession: false,
    setLanguage: vi.fn(),
    toast: vi.fn(),
    uiStrings: makeUIStrings(),
  };
});

vi.mock("@/data/content/posts", () => ({
  getPostBySlug: vi.fn(),
  getPostsPage: vi.fn(),
  prefetchPost: vi.fn(),
  getPostsBySeries: vi.fn(),
}));
vi.mock("@/services/content/postService", () => ({ getPost: vi.fn() }));
vi.mock("@/services/content/translate", () => {
  class MockTranslationApiError extends Error {
    code: string;
    status: number;
    retryable: boolean;

    constructor(
      message: string,
      options: { code?: string; status: number; retryable?: boolean },
    ) {
      super(message);
      this.name = "TranslationApiError";
      this.code = options.code ?? "UNKNOWN";
      this.status = options.status;
      this.retryable = options.retryable ?? false;
    }
  }

  return {
    translatePost: vi.fn(),
    getCachedTranslation: vi.fn(),
    TranslationApiError: MockTranslationApiError,
  };
});
vi.mock("@/services/discovery/rag", () => ({ findRelatedPosts: vi.fn() }));
vi.mock("@/hooks/seo/useSEO", () => ({ useSEO: vi.fn() }));
vi.mock("@/components/common/ReadingProgress", () => ({
  ReadingProgress: () => null,
}));
vi.mock("@/components/common/ScrollToTop", () => ({ ScrollToTop: () => null }));
vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: { children?: React.ReactNode }) => (
    <button>{children}</button>
  ),
}));
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));
vi.mock("@/components/features/blog", () => ({
  CommentSection: () => <div data-testid="comment-section" />,
  TableOfContents: () => <div data-testid="table-of-contents" />,
  TocDrawer: () => <div data-testid="toc-drawer" />,
  SeriesNavigation: () => <div data-testid="series-navigation" />,
}));
vi.mock("@/components/features/sentio/QuizPanel", () => ({
  QuizPanel: () => <div data-testid="quiz-panel" />,
}));
vi.mock("@/components/features/navigation/Breadcrumb", () => ({
  Breadcrumb: () => <nav data-testid="breadcrumb" />,
}));
vi.mock("@/components/features/blog/MarkdownRenderer", () => ({
  default: ({ content }: { content?: string }) => <div>{content}</div>,
}));
vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: hoisted.toast }),
}));
vi.mock("@/hooks/i18n/useLanguage", () => ({
  default: () => ({
    language: hoisted.currentLanguage,
    setLanguage: hoisted.setLanguage,
  }),
}));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    language: hoisted.currentLanguage,
    setLanguage: hoisted.setLanguage,
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
vi.mock("@/utils/i18n/uiStrings", () => ({
  useUIStrings: () => hoisted.uiStrings,
}));
vi.mock("@/stores/session/useAuthStore", () => ({
  useAuthStore: (
    selector?: (state: {
      accessToken: string | null;
      refreshToken: string | null;
    }) => unknown,
  ) => {
    const state = hoisted.hasTranslationSession
      ? { accessToken: "token", refreshToken: null }
      : { accessToken: null, refreshToken: null };
    return selector ? selector(state) : state;
  },
}));
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ isTerminal: false }),
}));
vi.mock("@/lib/utils", () => ({
  cn: (...parts: Array<string | false | null | undefined>) =>
    parts.filter(Boolean).join(" "),
}));
vi.mock("@/services/content/analytics", () => ({
  recordView: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/engagement/curiosity", () => ({
  curiosityTracker: new Proxy(
    {},
    {
      get: () => vi.fn(),
    },
  ),
}));
vi.mock("@/utils/content/blog", () => ({
  formatDate: vi.fn(() => "2024-01-01"),
  formatReadingTimeLabel: vi.fn(() => "1 min read"),
  resolveLocalizedPost: vi.fn(
    (post: {
      title: string;
      description: string;
      excerpt: string;
      content: string;
    }) => ({
      title: post.title,
      description: post.description,
      excerpt: post.excerpt,
      content: post.content,
    }),
  ),
}));
vi.mock("@/utils/seo/seo", () => ({
  generateSEOData: vi.fn(() => ({})),
  generateStructuredData: vi.fn(() => ({})),
}));

import BlogPost from "../../BlogPost";
import * as postsData from "@/data/content/posts";
import * as postService from "@/services/content/postService";
import * as translateService from "@/services/content/translate";
import * as ragService from "@/services/discovery/rag";
import * as seoUtils from "@/utils/seo/seo";

const basePost = {
  id: "test-post",
  title: "Test Post",
  description: "Test description",
  excerpt: "Test description",
  content: "# Hello",
  date: "2024-01-01",
  author: "Admin",
  tags: ["test"],
  category: "General",
  readingTime: "1 min read",
  slug: "test-post",
  year: "2024",
  published: true,
  language: "ko",
  defaultLanguage: "ko",
  availableLanguages: ["ko"],
  translations: {},
};

const emptyPostsPage = {
  items: [],
  page: 1,
  pageSize: 12,
  total: 0,
  totalPages: 1,
  hasMore: false,
};

const mockedPostService = vi.mocked(
  postService as unknown as {
    getPost: ReturnType<typeof vi.fn>;
  },
);

function renderBlogPost() {
  return render(
    <MemoryRouter initialEntries={["/posts/2024/test-post"]}>
      <Routes>
        <Route path="/posts/:year/:slug" element={<BlogPost />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  hoisted.currentLanguage = "ko";
  hoisted.hasTranslationSession = false;
  hoisted.setLanguage.mockReset();
  hoisted.toast.mockReset();
  vi.mocked(postsData.getPostBySlug).mockReset();
  vi.mocked(postsData.getPostsPage).mockReset();
  vi.mocked(postsData.prefetchPost).mockReset();
  vi.mocked(postsData.getPostsBySeries).mockReset();
  vi.mocked(translateService.translatePost).mockReset();
  vi.mocked(translateService.getCachedTranslation).mockReset();
  vi.mocked(ragService.findRelatedPosts).mockReset();
  vi.mocked(seoUtils.generateSEOData).mockReset();
  vi.mocked(seoUtils.generateStructuredData).mockReset();
  mockedPostService.getPost.mockReset();

  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
      headers: new Headers(),
      text: async () => "",
      json: async () => ({}),
    }),
  );

  vi.mocked(postsData.getPostBySlug).mockResolvedValue(basePost);
  vi.mocked(postsData.getPostsPage).mockResolvedValue(emptyPostsPage);
  vi.mocked(postsData.prefetchPost).mockResolvedValue(undefined);
  vi.mocked(postsData.getPostsBySeries).mockResolvedValue([]);
  vi.mocked(translateService.translatePost).mockResolvedValue({
    title: "Translated Test Post",
    description: "Translated description",
    content: "# Hello",
    cached: false,
  });
  vi.mocked(translateService.getCachedTranslation).mockResolvedValue({
    translation: null,
    pending: false,
    job: null,
  });
  vi.mocked(ragService.findRelatedPosts).mockResolvedValue([]);
  vi.mocked(seoUtils.generateSEOData).mockReturnValue({});
  vi.mocked(seoUtils.generateStructuredData).mockReturnValue({});
  mockedPostService.getPost.mockResolvedValue(basePost);
});

afterEach(() => {
  vi.useRealTimers();
});

test("renders post content when loaded successfully", async () => {
  vi.mocked(postsData.getPostBySlug).mockResolvedValue(basePost);
  mockedPostService.getPost.mockResolvedValue({
    title: "Test Post",
    content: "# Hello",
    year: "2024",
    slug: "test-post",
  });

  renderBlogPost();

  expect(await screen.findByText("Test Post")).toBeInTheDocument();
});

test("renders original content when translation fails", async () => {
  hoisted.currentLanguage = "en";
  vi.mocked(postsData.getPostBySlug).mockResolvedValue(basePost);
  vi.mocked(translateService.getCachedTranslation).mockRejectedValue(
    new Error("translation failed"),
  );
  mockedPostService.getPost.mockResolvedValue(basePost);

  renderBlogPost();

  await waitFor(() => {
    expect(translateService.getCachedTranslation).toHaveBeenCalledWith(
      "2024",
      "test-post",
      "en",
    );
  });
  expect(await screen.findByText("Test Post")).toBeInTheDocument();
  expect(document.body.textContent).toContain("Test Post");
});

test("uses cached translation from the public translation route", async () => {
  hoisted.currentLanguage = "en";
  vi.mocked(translateService.getCachedTranslation).mockResolvedValue({
    translation: {
      title: "Cached Test Post",
      description: "Cached description",
      content: "# Cached",
      cached: true,
    },
    pending: false,
    job: null,
  });

  renderBlogPost();

  expect(await screen.findByText("Cached Test Post")).toBeInTheDocument();
  expect(translateService.getCachedTranslation).toHaveBeenCalledWith(
    "2024",
    "test-post",
    "en",
  );
  expect(translateService.translatePost).not.toHaveBeenCalled();
  await waitFor(() => {
    expect(seoUtils.generateSEOData).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Cached Test Post",
        description: "Cached description",
      }),
      "post",
    );
  });
});

test("requests public translation even without a session", async () => {
  hoisted.currentLanguage = "en";

  renderBlogPost();

  await waitFor(() => {
    expect(translateService.getCachedTranslation).toHaveBeenCalledWith(
      "2024",
      "test-post",
      "en",
    );
  });
  expect(translateService.translatePost).not.toHaveBeenCalled();
  expect(await screen.findByText("Test Post")).toBeInTheDocument();
});

test("keeps the original content when public translation is still pending", async () => {
  hoisted.currentLanguage = "en";
  vi.mocked(translateService.getCachedTranslation).mockResolvedValue({
    translation: null,
    pending: true,
    job: {
      id: "job-1",
      status: "running",
      statusUrl: "/status",
      cacheUrl: "/cache",
      generateUrl: "/generate",
    },
  });

  renderBlogPost();

  await waitFor(() => {
    expect(translateService.getCachedTranslation).toHaveBeenCalledWith(
      "2024",
      "test-post",
      "en",
    );
  });
  expect(await screen.findByText("Test Post")).toBeInTheDocument();
  expect(document.body.textContent).toContain("Test description");
});

test("polls the public translation route until the translation is ready", async () => {
  vi.useFakeTimers();
  hoisted.currentLanguage = "en";
  vi.mocked(translateService.getCachedTranslation)
    .mockResolvedValueOnce({
      translation: null,
      pending: true,
      job: null,
      retryAfterSeconds: 1,
      warming: true,
      stale: false,
    })
    .mockResolvedValueOnce({
      translation: {
        title: "Polled Translation",
        description: "Polled description",
        content: "# Polled",
        cached: true,
      },
      pending: false,
      job: null,
      warming: false,
      stale: false,
    });

  renderBlogPost();

  await act(async () => {
    await Promise.resolve();
  });
  expect(translateService.getCachedTranslation).toHaveBeenCalledTimes(1);

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });

  await act(async () => {
    await Promise.resolve();
  });
  expect(translateService.getCachedTranslation).toHaveBeenCalledTimes(2);
  expect(screen.getByText("Polled Translation")).toBeInTheDocument();

  vi.useRealTimers();
});

test("renders without related posts when none found", async () => {
  vi.mocked(postsData.getPostBySlug).mockResolvedValue(basePost);
  vi.mocked(ragService.findRelatedPosts).mockResolvedValue([]);
  mockedPostService.getPost.mockResolvedValue(basePost);

  renderBlogPost();

  await waitFor(() => {
    expect(ragService.findRelatedPosts).toHaveBeenCalled();
  });
  expect(await screen.findByText("Test Post")).toBeInTheDocument();
});

test("handles missing post gracefully", async () => {
  vi.mocked(postsData.getPostBySlug).mockResolvedValue(null);
  mockedPostService.getPost.mockResolvedValue(null);

  renderBlogPost();

  await waitFor(() => {
    expect(postsData.getPostBySlug).toHaveBeenCalled();
  });
  expect(document.body).toBeInTheDocument();
});
