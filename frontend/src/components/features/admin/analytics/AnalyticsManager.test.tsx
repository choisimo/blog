import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AllPostsSection,
  EditorPicksSection,
  getAllPostStats,
  StatsRefreshSection,
} from "./AnalyticsManager";

const { mockAdminApiFetch, mockAdminFetchRaw } = vi.hoisted(() => ({
  mockAdminApiFetch: vi.fn(),
  mockAdminFetchRaw: vi.fn(),
}));

vi.mock("@/services/admin/apiClient", () => ({
  adminApiFetch: mockAdminApiFetch,
  adminFetchRaw: mockAdminFetchRaw,
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: () => "https://admin.example.com",
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
