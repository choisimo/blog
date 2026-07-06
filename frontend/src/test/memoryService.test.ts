import { afterEach, describe, expect, it, vi } from "vitest";

const {
  mockGetPrincipalHeaders,
  mockGetPrincipalUserId,
} = vi.hoisted(() => ({
  mockGetPrincipalHeaders: vi.fn(),
  mockGetPrincipalUserId: vi.fn(),
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: vi.fn(() => "https://api.example.com"),
}));

vi.mock("@/services/session/userContentAuth", () => ({
  getPrincipalHeaders: mockGetPrincipalHeaders,
  getPrincipalUserId: mockGetPrincipalUserId,
  getSessionAuthToken: vi.fn(() => null),
}));

import {
  createMemory,
  deleteMemory,
  getMemories,
  searchMemories,
} from "@/services/personal/memory";

describe("memory service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    mockGetPrincipalHeaders.mockReset();
    mockGetPrincipalUserId.mockReset();
  });

  it("fails closed when create memory success data is missing an id", async () => {
    mockGetPrincipalUserId.mockResolvedValue("principal-1");
    mockGetPrincipalHeaders.mockResolvedValue(
      new Headers({
        Authorization: "Bearer principal-token",
        "Content-Type": "application/json",
      }),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            content: "Remember this",
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    await expect(
      createMemory({
        content: "Remember this",
        memoryType: "fact",
      }),
    ).rejects.toThrow("Memory response missing id");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/memories/principal-1",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );
  });

  it("normalizes memory create payloads and encoded principal paths", async () => {
    mockGetPrincipalUserId.mockResolvedValue("principal/1");
    mockGetPrincipalHeaders.mockResolvedValue(
      new Headers({
        Authorization: "Bearer principal-token",
        "Content-Type": "application/json",
      }),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true, data: { id: "memory-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      createMemory({
        content: " Remember\r\nthis ",
        memoryType: "fact",
        category: " Profile ",
        sourceType: "manual",
        sourceId: " source-1 ",
        importanceScore: 99,
      }),
    ).resolves.toEqual({ id: "memory-1" });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.example.com/api/v1/memories/principal%2F1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          content: "Remember\nthis",
          memoryType: "fact",
          category: "Profile",
          sourceType: "manual",
          sourceId: "source-1",
          importanceScore: 1,
        }),
      }),
    );
  });

  it("rejects invalid memory create payloads before network", async () => {
    mockGetPrincipalUserId.mockResolvedValue("principal-1");
    mockGetPrincipalHeaders.mockResolvedValue(new Headers());
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await expect(
      createMemory({
        content: " ",
        memoryType: "fact",
      }),
    ).rejects.toThrow("Invalid memory content");
    await expect(
      createMemory({
        content: "Remember this",
        memoryType: "unknown",
      }),
    ).rejects.toThrow("Invalid memory type");
    await expect(
      createMemory({
        content: "Remember this",
        memoryType: "fact",
        category: "Profile\r\nInjected",
      }),
    ).rejects.toThrow("Invalid memory category");

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("normalizes memory list, delete, and search request parameters", async () => {
    mockGetPrincipalUserId.mockResolvedValue("principal/1");
    mockGetPrincipalHeaders.mockResolvedValue(
      new Headers({
        Authorization: "Bearer principal-token",
        "Content-Type": "application/json",
      }),
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, data: { memories: [], total: 0 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, data: { results: [] } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    await expect(
      getMemories({
        type: "fact",
        category: " Profile ",
        limit: 500,
        offset: -10,
      }),
    ).resolves.toEqual({ memories: [], total: 0 });
    await expect(deleteMemory("memory/1")).resolves.toBeUndefined();
    await expect(
      searchMemories(" Find\r\nthis ", {
        n_results: 500,
        memoryType: "context",
        category: " Project ",
      }),
    ).resolves.toEqual([]);

    expect(fetchSpy.mock.calls[0][0]).toBe(
      "https://api.example.com/api/v1/memories/principal%2F1?type=fact&category=Profile&limit=100&offset=0",
    );
    expect(fetchSpy.mock.calls[1][0]).toBe(
      "https://api.example.com/api/v1/memories/principal%2F1/memory%2F1",
    );
    expect(JSON.parse(String(fetchSpy.mock.calls[2][1]?.body))).toEqual({
      userId: "principal/1",
      query: "Find\nthis",
      n_results: 100,
      memoryType: "context",
      category: "Project",
    });
  });
});
