import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, afterEach } from "vitest";

import {
  isFabEnabled,
  normalizeFabBoolean,
  normalizeFabEventDetail,
  normalizeFabText,
  useFabAnalytics,
} from "./useFabState";

describe("useFabState sanitizers", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("strips ANSI and control characters from FAB text values", () => {
    expect(normalizeFabText("\u001b[31mOpen\nMemo\u001b[0m\u0000")).toBe(
      "Open Memo",
    );
  });

  it("normalizes boolean storage values without treating strings as truthy", () => {
    expect(normalizeFabBoolean('"false"')).toBe(false);
    expect(normalizeFabBoolean("\u001b[32m1\u001b[0m\u0000")).toBe(true);
    expect(normalizeFabBoolean("enabled")).toBeNull();
  });

  it("uses sanitized localStorage feature flag overrides", () => {
    localStorage.setItem("aiMemo.fab.enabled", JSON.stringify("false"));
    expect(isFabEnabled()).toBe(false);

    localStorage.setItem(
      "aiMemo.fab.enabled",
      JSON.stringify("\u001b[32mtrue\u001b[0m\u0000"),
    );
    expect(isFabEnabled()).toBe(true);
  });

  it("sanitizes analytics detail keys and string values", () => {
    expect(
      normalizeFabEventDetail({
        "\u001b[33mpostTitle\u001b[0m": "\u001b[31mHello\u001b[0m\u0000",
        type: "override",
        ts: 1,
        count: Number.POSITIVE_INFINITY,
      }),
    ).toEqual({
      postTitle: "Hello",
      count: null,
    });
  });
});

describe("useFabAnalytics", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("dispatches sanitized analytics event payloads", () => {
    const events: CustomEvent[] = [];
    const onEvent = (event: Event) => events.push(event as CustomEvent);

    window.addEventListener("fab:event", onEvent);

    try {
      const { result } = renderHook(() => useFabAnalytics());

      act(() => {
        result.current.send("\u001b[31mcustom:event\u001b[0m\u0000", {
          title: "\u001b[32mMemo title\u001b[0m\u0000",
          type: "unsafe-override",
        });
      });
    } finally {
      window.removeEventListener("fab:event", onEvent);
    }

    expect(events).toHaveLength(1);
    expect(events[0].detail).toMatchObject({
      title: "Memo title",
      type: "custom:event",
    });
    expect(events[0].detail.ts).toEqual(expect.any(Number));
  });
});
