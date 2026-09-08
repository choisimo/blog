import { act, renderHook, waitFor } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  normalizeShellCommanderText,
  normalizeShellCommandInput,
  useShellCommander,
} from "./useShellCommander";

describe("useShellCommander sanitizers", () => {
  it("strips ANSI and control characters from shell output while preserving new lines", () => {
    expect(
      normalizeShellCommanderText("\u001b[31mfirst\u001b[0m\r\nsecond\u0000"),
    ).toBe("first\nsecond");
  });

  it("normalizes shell command input into a single safe command line", () => {
    expect(
      normalizeShellCommandInput("\u001b[32mfind\u001b[0m\tkafka\u0007"),
    ).toBe("find kafka");
  });

  it("returns safe fallbacks for empty sanitized output and rejects non-string command input", () => {
    expect(normalizeShellCommanderText("\u001b[33m\u0000", "fallback")).toBe(
      "fallback",
    );
    expect(normalizeShellCommandInput(null)).toBe("");
  });
});

describe("useShellCommander suggestion dismissal", () => {
  function setup() {
    const onShellClose = vi.fn();
    const hook = renderHook(() =>
      useShellCommander({
        vfs: {
          displayPath: "~",
          currentPath: "/",
          years: [],
          ls: () => "",
          cd: () => "",
          pwd: () => "/",
          cat: () => "",
          find: () => "",
          tree: () => "",
          navigate: () => undefined,
        },
        posts: [],
        onChatOpen: () => undefined,
        onChatOpenWithMessage: () => undefined,
        onMemoToggle: () => undefined,
        onStackClick: () => undefined,
        onShellClose,
        send: () => undefined,
      }),
    );
    const press = (key: string) => {
      const preventDefault = vi.fn();
      act(() =>
        hook.result.current.handleShellKeyDownWithSuggestions({
          key,
          preventDefault,
        } as unknown as KeyboardEvent<HTMLInputElement>),
      );
      return preventDefault;
    };
    return { ...hook, press, onShellClose };
  }

  it("keeps unchanged input dismissed across parent rerenders and reopens after an edit", async () => {
    const { result, rerender, press, onShellClose } = setup();
    act(() => result.current.setShellInput("c"));
    await waitFor(() => expect(result.current.suggestions).toContain("chat"));
    press("Escape");
    rerender();
    expect(result.current.suggestions).toEqual([]);
    expect(onShellClose).not.toHaveBeenCalled();
    press("Escape");
    expect(onShellClose).toHaveBeenCalledTimes(1);
    act(() => result.current.setShellInput("ch"));
    await waitFor(() => expect(result.current.suggestions).toEqual(["chat"]));
  });

  it("completes with Tab and keeps the chosen suggestion closed until input changes", async () => {
    const { result, rerender, press, onShellClose } = setup();
    act(() => result.current.setShellInput("ch"));
    await waitFor(() => expect(result.current.suggestions).toEqual(["chat"]));
    expect(press("Tab")).toHaveBeenCalledOnce();
    rerender();
    expect(result.current.shellInput).toBe("chat");
    expect(result.current.suggestions).toEqual([]);
    expect(onShellClose).not.toHaveBeenCalled();
    act(() => result.current.setShellInput("c"));
    await waitFor(() => expect(result.current.suggestions).toContain("chat"));
  });
});
