import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAdminFetchRaw,
  mockGetApiBaseUrl,
  mockGetValidAccessToken,
} = vi.hoisted(() => ({
  mockAdminFetchRaw: vi.fn(),
  mockGetApiBaseUrl: vi.fn(() => "https://admin.example.com"),
  mockGetValidAccessToken: vi.fn(),
}));

vi.mock("@/utils/network/apiBase", () => ({
  getApiBaseUrl: mockGetApiBaseUrl,
}));

vi.mock("@/stores/session/useAuthStore", () => ({
  useAuthStore: () => ({
    getValidAccessToken: mockGetValidAccessToken,
  }),
}));

vi.mock("@/services/admin/apiClient", () => ({
  adminFetchRaw: mockAdminFetchRaw,
}));

import {
  connectLogStream,
  LogViewer,
  parseLogStream,
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
    mockGetApiBaseUrl.mockReturnValue("https://admin.example.com");
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("labels icon-only log toolbar controls and updates pause state", async () => {
    mockGetValidAccessToken.mockResolvedValue("stream-token");
    mockAdminFetchRaw.mockResolvedValue(createResponse([]));

    render(<LogViewer />);

    await waitFor(() => {
      expect(mockAdminFetchRaw).toHaveBeenCalled();
    });

    const pauseButton = screen.getByRole("button", {
      name: "Pause log stream",
    });
    expect(pauseButton).toHaveAttribute("title", "Pause log stream");
    expect(
      screen.getByRole("button", { name: "Clear logs" }),
    ).toHaveAttribute("title", "Clear logs");
    expect(
      screen.getByRole("button", { name: "Reconnect log stream" }),
    ).toHaveAttribute("title", "Reconnect log stream");

    fireEvent.click(pauseButton);

    expect(
      screen.getByRole("button", { name: "Resume log stream" }),
    ).toHaveAttribute("title", "Resume log stream");
  });

  it("uses the shared admin stream fetcher after resolving a token", async () => {
    mockGetValidAccessToken.mockResolvedValue("test-token");
    mockFetch.mockResolvedValue(createResponse([]));

    const state = createLogState();
    const setConnected = vi.fn();
    const setConnectionError = vi.fn();

    await connectLogStream({
      abortRef: { current: null },
      fetchStream: mockFetch,
      getValidAccessToken: mockGetValidAccessToken,
      pausedRef: { current: false },
      reconnect: vi.fn(),
      setConnected,
      setConnectionError,
      setLogs: state.setLogs,
    });

    expect(mockGetValidAccessToken).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      "https://admin.example.com/api/v1/admin/logs/stream",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Content-Type": "text/event-stream",
        }),
      }),
    );
    expect(setConnectionError).toHaveBeenCalledWith(null);
  });

  it("normalizes failed stream connection errors before exposing them", async () => {
    mockGetValidAccessToken.mockResolvedValue("test-token");
    mockFetch.mockRejectedValue(
      new Error("\u001b]0;ignored title\u0007Fetch\u001b[31m failed\u001b[0m"),
    );

    const state = createLogState();
    const setConnected = vi.fn();
    const setConnectionError = vi.fn();
    const reconnect = vi.fn();

    await connectLogStream({
      abortRef: { current: null },
      fetchStream: mockFetch,
      getValidAccessToken: mockGetValidAccessToken,
      pausedRef: { current: false },
      reconnect,
      setConnected,
      setConnectionError,
      setLogs: state.setLogs,
    });

    expect(setConnected).toHaveBeenCalledWith(false);
    expect(setConnectionError).toHaveBeenCalledWith("Fetch failed");
    expect(reconnect).toHaveBeenCalled();
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
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        body: { getReader: secondGetReader },
      } as unknown as Response);

    const state = createLogState();
    const setConnected = vi.fn();
    const setConnectionError = vi.fn();
    const abortRef = { current: null as AbortController | null };

    async function connect() {
      await connectLogStream({
        abortRef,
        fetchStream: mockFetch,
        getValidAccessToken: mockGetValidAccessToken,
        pausedRef: { current: false },
        reconnect: () => {
          setTimeout(() => {
            void connect();
          }, 3000);
        },
        setConnected,
        setConnectionError,
        setLogs: state.setLogs,
      });
    }

    await connect();

    expect(firstGetReader).not.toHaveBeenCalled();
    expect(state.getLogs()).toEqual([]);
    expect(setConnected).toHaveBeenCalledWith(false);
    expect(setConnectionError).toHaveBeenCalledWith(
      "Log stream request failed with HTTP 401",
    );
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
      fetchStream: mockFetch,
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
      fetchStream: mockFetch,
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

  it("normalizes stream log entries before appending them to state", async () => {
    const state = createLogState();

    await parseLogStream(
      createReader([
        sseFrame({
          timestamp: "2026-03-19T00:00:01.000Z",
          level: "info",
          service: " \u001b]2;ignored title\u0007api\u0000worker\r\nInjected\u001b[0m ",
          message: " \u001b]0;ignored title\u0007Started\u001b[31m\u0000\r\nnow\u001b[0m ",
        }),
        sseFrame({
          timestamp: "2026-03-19T00:00:02.000Z",
          level: "verbose",
          service: "api",
          message: "invalid level",
        }),
      ]),
      {
        pausedRef: { current: false },
        setLogs: state.setLogs,
      },
    );

    expect(state.getLogs()).toEqual([
      {
        timestamp: "2026-03-19T00:00:01.000Z",
        level: "info",
        service: "api worker Injected",
        message: "Started now",
      },
    ]);
  });
});
