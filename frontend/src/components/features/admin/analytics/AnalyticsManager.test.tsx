import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllPostStats } from "./AnalyticsManager";

const { mockAdminFetchRaw } = vi.hoisted(() => ({
  mockAdminFetchRaw: vi.fn(),
}));

vi.mock("@/services/admin/apiClient", () => ({
  adminFetchRaw: mockAdminFetchRaw,
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: () => "https://admin.example.com",
}));

describe("getAllPostStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates admin post stats requests to the shared admin client", async () => {
    mockAdminFetchRaw.mockResolvedValue(
      new Response(
        JSON.stringify({
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
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const result = await getAllPostStats("total_views");

    expect(mockAdminFetchRaw).toHaveBeenCalledOnce();
    expect(mockAdminFetchRaw).toHaveBeenCalledWith(
      "https://admin.example.com/api/v1/admin/analytics/posts?orderBy=total_views",
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
    mockAdminFetchRaw.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getAllPostStats("views_7d");

    expect(mockAdminFetchRaw).toHaveBeenCalledWith(
      "https://admin.example.com/api/v1/admin/analytics/posts?orderBy=views_7d",
    );
    expect(result).toEqual([]);
  });
});
