import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TerminalOptions } from "@/services/realtime/terminal";
import {
  normalizeTerminalDimension,
  normalizeTerminalErrorText,
  useRealTerminal,
} from "./useRealTerminal";

const terminalState = vi.hoisted(() => ({
  terminalEnabled: true,
  hasGatewayUrl: true,
  hasToken: true,
  healthOk: true,
  latestOptions: null as TerminalOptions | null,
  connection: {
    close: vi.fn(),
    send: vi.fn(),
    resize: vi.fn(),
    isConnected: vi.fn(() => true),
  },
}));

vi.mock("@/stores/runtime/useFeatureFlagsStore", () => ({
  useFeatureEnabled: () => terminalState.terminalEnabled,
}));

vi.mock("@/services/realtime/terminal", () => ({
  hasTerminalGatewayUrl: () => terminalState.hasGatewayUrl,
  hasAuthToken: () => terminalState.hasToken,
  checkTerminalHealth: vi.fn(async () => terminalState.healthOk),
  connectTerminal: vi.fn((options: TerminalOptions) => {
    terminalState.latestOptions = options;
    return terminalState.connection;
  }),
}));

describe("useRealTerminal sanitizers", () => {
  it("strips ANSI and control characters from terminal error text", () => {
    expect(
      normalizeTerminalErrorText("\u001b[31mGateway\nfailed\u001b[0m\u0000"),
    ).toBe("Gateway failed");
  });

  it("clamps terminal dimensions to the supported range", () => {
    expect(normalizeTerminalDimension(Number.NaN, 80)).toBe(80);
    expect(normalizeTerminalDimension(-10, 80)).toBe(1);
    expect(normalizeTerminalDimension(1000, 80)).toBe(500);
    expect(normalizeTerminalDimension(120.9, 80)).toBe(120);
  });
});

describe("useRealTerminal", () => {
  afterEach(() => {
    terminalState.terminalEnabled = true;
    terminalState.hasGatewayUrl = true;
    terminalState.hasToken = true;
    terminalState.healthOk = true;
    terminalState.latestOptions = null;
    terminalState.connection.close.mockClear();
    terminalState.connection.send.mockClear();
    terminalState.connection.resize.mockClear();
    terminalState.connection.isConnected.mockReturnValue(true);
  });

  it("normalizes connect dimensions before opening the terminal", async () => {
    const { result } = renderHook(() =>
      useRealTerminal({ cols: 1000, rows: -5 }),
    );

    await waitFor(() => expect(result.current.isAvailable).toBe(true));

    act(() => {
      result.current.connect();
    });

    expect(terminalState.latestOptions).toMatchObject({
      cols: 500,
      rows: 1,
    });
  });

  it("sanitizes close reasons before exposing them as errors", async () => {
    const { result } = renderHook(() => useRealTerminal());

    await waitFor(() => expect(result.current.isAvailable).toBe(true));

    act(() => {
      result.current.connect();
      terminalState.latestOptions?.onClose?.(
        4001,
        "\u001b[31mBad\nreason\u001b[0m\u0000",
      );
    });

    expect(result.current.error).toBe("연결 종료: Bad reason");
  });

  it("normalizes resize dimensions before forwarding them", async () => {
    const { result } = renderHook(() => useRealTerminal());

    await waitFor(() => expect(result.current.isAvailable).toBe(true));

    act(() => {
      result.current.connect();
      result.current.resize(0, 999);
    });

    expect(terminalState.connection.resize).toHaveBeenCalledWith(1, 500);
  });
});
