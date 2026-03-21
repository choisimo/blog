import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockBearerAuth,
  mockGetApiBaseUrl,
  mockGetValidAccessToken,
} = vi.hoisted(() => ({
  mockBearerAuth: vi.fn((token: string) => ({ Authorization: `Bearer ${token}` })),
  mockGetApiBaseUrl: vi.fn(() => "https://admin.example.com"),
  mockGetValidAccessToken: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  bearerAuth: mockBearerAuth,
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: mockGetApiBaseUrl,
}));

vi.mock("@/stores/session/useAuthStore", () => ({
  useAuthStore: () => ({
    getValidAccessToken: mockGetValidAccessToken,
  }),
}));

import {
  connectLogStream,
  type LogEntry,
} from "./LogViewer";

const mockFetch = vi.fn();

function createReader(
  frames: string[],
): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return {
    read: vi.fn(async () => {
      if (index >= frames.length) {
        return { done: true, value: undefined };
      }

      const chunk = encoder.encode(frames[index]);
      index += 1;
      return { done: false, value: chunk };
    }),
  } as unknown as ReadableStreamDefaultReader<Uint8Array>;
}

function createResponse(frames: string[]) {
  const getReader = vi.fn(() => createReader(frames));

  return {
    ok: true,
    status: 200,
    body: { getReader },
  } as unknown as Response;
}

function createLogState(initialLogs: LogEntry[] = []) {
  let logs = [...initialLogs];

  const setLogs = vi.fn((
    update: LogEntry[] | ((prev: LogEntry[]) => LogEntry[]),
  ) => {
    logs = typeof update === "function" ? update(logs) : update;
  });

  return {
    getLogs: () => logs,
    setLogs,
  };
}

function buildLogEntry(id: number, message = `log-${id}`): LogEntry {
  return {
    timestamp: `2026-03-19T00:00:${String(id).padStart(2, "0")}.000Z`,
    level: "info",
    service: "api",
    message,
  };
}

function sseFrame(payload: unknown) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

describe("LogViewer stream controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.stubGlobal("fetch", mockFetch);
    mockGetApiBaseUrl.mockReturnValue("https://admin.example.com");
    mockBearerAuth.mockImplementation((token: string) => ({
      Authorization: `Bearer ${token}`,
    }));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("sends the bearer token in the stream request", async () => {
    mockGetValidAccessToken.mockResolvedValue("test-token");
    mockFetch.mockResolvedValue(createResponse([]));

    const state = createLogState();
    const setConnected = vi.fn();

    await connectLogStream({
      abortRef: { current: null },
      getValidAccessToken: mockGetValidAccessToken,
      pausedRef: { current: false },
      reconnect: vi.fn(),
      setConnected,
      setLogs: state.setLogs,
    });

    expect(mockBearerAuth).toHaveBeenCalledWith("test-token");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://admin.example.com/api/v1/admin/logs/stream",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Content-Type": "text/event-stream",
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("retries on non-ok responses without entering the stream parser", async () => {
    vi.useFakeTimers();
    mockGetValidAccessToken.mockResolvedValue("retry-token");

    const firstGetReader = vi.fn();
    const secondGetReader = vi.fn();
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        body: { getReader: firstGetReader },
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        body: { getReader: secondGetReader },
      } as Response);

    const state = createLogState();
    const setConnected = vi.fn();
    const abortRef = { current: null as AbortController | null };

    async function connect() {
      await connectLogStream({
        abortRef,
        getValidAccessToken: mockGetValidAccessToken,
        pausedRef: { current: false },
        reconnect: () => {
          setTimeout(() => {
            void connect();
          }, 3000);
        },
        setConnected,
        setLogs: state.setLogs,
      });
    }

    await connect();

    expect(firstGetReader).not.toHaveBeenCalled();
    expect(state.getLogs()).toEqual([]);
    expect(setConnected).toHaveBeenCalledWith(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(secondGetReader).not.toHaveBeenCalled();
  });

  it("keeps paused streams from appending, resumes on refresh, and caps logs at 1000", async () => {
    mockGetValidAccessToken.mockResolvedValue("stream-token");
    mockFetch
      .mockResolvedValueOnce(
        createResponse([
          sseFrame({ type: "connected" }),
          sseFrame(buildLogEntry(1001, "paused-log")),
        ]),
      )
      .mockResolvedValueOnce(
        createResponse([sseFrame(buildLogEntry(1002, "resumed-log"))]),
      );

    const initialLogs = Array.from({ length: 1000 }, (_, index) =>
      buildLogEntry(index, `existing-${index}`),
    );
    const state = createLogState(initialLogs);
    const pausedRef = { current: true };
    const setConnected = vi.fn();
    const abortRef = { current: null as AbortController | null };
    const reconnect = vi.fn();

    await connectLogStream({
      abortRef,
      getValidAccessToken: mockGetValidAccessToken,
      pausedRef,
      reconnect,
      setConnected,
      setLogs: state.setLogs,
    });

    expect(state.getLogs()).toHaveLength(1000);
    expect(state.getLogs().some((entry) => entry.message === "paused-log")).toBe(
      false,
    );

    pausedRef.current = false;

    await connectLogStream({
      abortRef,
      getValidAccessToken: mockGetValidAccessToken,
      pausedRef,
      reconnect,
      setConnected,
      setLogs: state.setLogs,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(state.getLogs()).toHaveLength(1000);
    expect(state.getLogs()[0]?.message).toBe("resumed-log");
    expect(state.getLogs().some((entry) => entry.message === "paused-log")).toBe(
      false,
    );
  });
});
