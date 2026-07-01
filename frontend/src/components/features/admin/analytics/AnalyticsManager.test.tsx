import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AllPostsSection,
  EditorPicksSection,
  getAllPostStats,
  RealtimeVisitorsSection,
  StatsRefreshSection,
  TrendingPostsSection,
} from "./AnalyticsManager";

const {
  mockAdminApiFetch,
  mockAdminFetchRaw,
  mockGetRealtimeVisitorsSnapshot,
} = vi.hoisted(() => ({
  mockAdminApiFetch: vi.fn(),
  mockAdminFetchRaw: vi.fn(),
  mockGetRealtimeVisitorsSnapshot: vi.fn(),
}));

vi.mock("@/services/admin/apiClient", () => ({
  adminApiFetch: mockAdminApiFetch,
  adminFetchRaw: mockAdminFetchRaw,
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: () => "https://admin.example.com",
}));

vi.mock("@/services/content/analytics", () => ({
  getRealtimeVisitorsSnapshot: mockGetRealtimeVisitorsSnapshot,
}));

describe("getAllPostStats", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("delegates admin post stats requests to the shared admin API client", async () => {
    mockAdminApiFetch.mockResolvedValue({
      ok: true,
      data: {
        stats: [
          {
            post_slug: "hello-world",
            year: "2026",
            total_views: 42,
            views_7d: 7,
            views_30d: 21,
            last_viewed_at: "2026-03-19T00:00:00.000Z",
          },
        ],
      },
    });

    const result = await getAllPostStats("total_views");

    expect(mockAdminApiFetch).toHaveBeenCalledOnce();
    expect(mockAdminApiFetch).toHaveBeenCalledWith(
      "/posts?orderBy=total_views",
      { pathPrefix: "/api/v1/admin/analytics" },
    );
    expect(result).toEqual([
      {
        post_slug: "hello-world",
        year: "2026",
        total_views: 42,
        views_7d: 7,
        views_30d: 21,
        last_viewed_at: "2026-03-19T00:00:00.000Z",
      },
    ]);
  });

  it("returns an empty array when the shared admin client response is not ok", async () => {
    mockAdminApiFetch.mockResolvedValue({
      ok: false,
      error: "Unauthorized",
    });

    const result = await getAllPostStats("views_7d");

    expect(mockAdminApiFetch).toHaveBeenCalledWith(
      "/posts?orderBy=views_7d",
      { pathPrefix: "/api/v1/admin/analytics" },
    );
    expect(result).toEqual([]);
  });

  it("shows a load error instead of an empty all-posts table when post stats fail", async () => {
    mockAdminApiFetch.mockResolvedValue({
      ok: false,
      error: "Stats database unavailable",
    });

    render(<AllPostsSection />);

    await waitFor(() => {
      expect(
        screen.getByText(/Unable to load post stats/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/Stats database unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Retry post stats/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No post stats recorded yet/i),
    ).not.toBeInTheDocument();
  });

  it("shows a load error instead of an empty editor-picks list when editor picks fail", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: { message: "Editor picks unavailable" },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;

    render(<EditorPicksSection />);

    await waitFor(() => {
      expect(
        screen.getByText(/Unable to load editor picks/i),
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/Editor picks unavailable/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Retry editor picks/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No editor picks configured/i),
    ).not.toBeInTheDocument();
  });

  it("shows trending degraded messages without also showing the empty state", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          degraded: true,
          error: { message: "Trending analytics unavailable" },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;

    render(<TrendingPostsSection />);

    await waitFor(() => {
      expect(
        screen.getByText(/Trending analytics unavailable/i),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/No trending data for this period/i),
    ).not.toBeInTheDocument();
  });

  it("shows realtime visitor degraded messages without reporting zero visitors", async () => {
    mockGetRealtimeVisitorsSnapshot.mockResolvedValue({
      data: { activeVisitors: 0, timestamp: null },
      degraded: true,
      errorMessage: "Realtime KV unavailable",
    });

    render(<RealtimeVisitorsSection />);

    await waitFor(() => {
      expect(screen.getByText(/Realtime KV unavailable/i)).toBeInTheDocument();
    });

    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.getByText(/visitor count unavailable/i)).toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Last updated:/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Best-effort signal backed by heartbeat writes/i),
    ).not.toBeInTheDocument();
  });

  it("shows the backend message when removing an editor pick fails", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          data: {
            picks: [
              {
                post_slug: "hello-world",
                year: "2026",
                title: "Hello World",
                cover_image: null,
                category: "Engineering",
                rank: 1,
                score: 99,
                reason: "Featured",
                is_active: 1,
                expires_at: null,
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }) as typeof fetch;
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Editor pick removal denied" },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(<EditorPicksSection />);

    await waitFor(() => {
      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Remove/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Editor pick removal denied/i),
      ).toBeInTheDocument();
    });

    expect(mockAdminFetchRaw).toHaveBeenCalledWith(
      "https://admin.example.com/api/v1/analytics/admin/editor-picks/2026/hello-world",
      { method: "DELETE" },
    );
    expect(
      screen.queryByText(/^Failed to remove pick\.$/i),
    ).not.toBeInTheDocument();
  });

  it("shows the backend message when adding an editor pick fails", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(JSON.stringify({ data: { picks: [] } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Rank already assigned" },
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(<EditorPicksSection />);

    await waitFor(() => {
      expect(
        screen.getByText(/No editor picks configured/i),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Add Pick/i }));
    fireEvent.change(screen.getByPlaceholderText("post-slug"), {
      target: { value: "hello-world" },
    });
    fireEvent.change(screen.getByPlaceholderText("2025"), {
      target: { value: "2026" },
    });
    fireEvent.change(screen.getByPlaceholderText("1"), {
      target: { value: "1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/Rank already assigned/i)).toBeInTheDocument();
    });

    expect(mockAdminFetchRaw).toHaveBeenCalledWith(
      "https://admin.example.com/api/v1/analytics/admin/editor-picks",
      {
        method: "POST",
        body: JSON.stringify({
          post_slug: "hello-world",
          year: "2026",
          rank: 1,
        }),
      },
    );
    expect(
      screen.queryByText(/^Failed to add pick\.$/i),
    ).not.toBeInTheDocument();
  });

  it("shows the backend message when stats refresh fails", async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: "Aggregation queue unavailable" },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(<StatsRefreshSection />);

    fireEvent.click(screen.getByRole("button", { name: /Run Refresh/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Aggregation queue unavailable/i),
      ).toBeInTheDocument();
    });

    expect(mockAdminFetchRaw).toHaveBeenCalledWith(
      "https://admin.example.com/api/v1/analytics/refresh-stats",
      { method: "POST" },
    );
    expect(screen.queryByText(/^Refresh failed\.$/i)).not.toBeInTheDocument();
  });
});
