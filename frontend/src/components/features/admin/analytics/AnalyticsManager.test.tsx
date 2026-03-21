import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAllPostStats } from "./AnalyticsManager";

const { mockAdminFetchRaw, mockGetValidAccessToken } = vi.hoisted(() => ({
  mockAdminFetchRaw: vi.fn(),
  mockGetValidAccessToken: vi.fn(),
}));

vi.mock("@/services/admin/apiClient", () => ({
  adminFetchRaw: mockAdminFetchRaw,
}));

vi.mock("@/stores/session/useAuthStore", () => ({
  useAuthStore: {
    getState: () => ({
      getValidAccessToken: mockGetValidAccessToken,
    }),
  },
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: () => "https://admin.example.com",
}));

describe("getAllPostStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls adminFetchRaw only after resolving an auth token", async () => {
    mockGetValidAccessToken.mockResolvedValue("test-token");
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

    // `adminFetchRaw()` injects `Authorization: Bearer <token>` internally via
    // `bearerAuth(token)` in `apiClient.ts`; this test verifies `getAllPostStats()`
    // resolves a token before delegating to that auth-injecting wrapper.
    expect(mockGetValidAccessToken).toHaveBeenCalledOnce();
    expect(mockAdminFetchRaw).toHaveBeenCalledOnce();
    expect(mockGetValidAccessToken.mock.invocationCallOrder[0]).toBeLessThan(
      mockAdminFetchRaw.mock.invocationCallOrder[0],
    );
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

  it("returns an empty array without requesting when token is missing", async () => {
    mockGetValidAccessToken.mockResolvedValue(null);

    const result = await getAllPostStats("views_7d");

    expect(mockGetValidAccessToken).toHaveBeenCalledOnce();
    expect(mockAdminFetchRaw).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
