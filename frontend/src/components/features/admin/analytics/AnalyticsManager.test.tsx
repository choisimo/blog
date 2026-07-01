import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AllPostsSection, getAllPostStats } from "./AnalyticsManager";

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
  beforeEach(() => {
    vi.clearAllMocks();
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
});
