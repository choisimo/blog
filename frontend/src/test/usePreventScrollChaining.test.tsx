import { render } from "@testing-library/react";
import type { RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { usePreventScrollChaining } from "@/components/features/chat/widget/hooks/usePreventScrollChaining";

function Harness({
  rootRef,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  usePreventScrollChaining(rootRef);
  return null;
}

function defineScrollMetrics(
  element: HTMLElement,
  metrics: {
    scrollHeight?: number;
    clientHeight?: number;
    scrollWidth?: number;
    clientWidth?: number;
  },
) {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(element, key, {
      configurable: true,
      value,
    });
  }
}

describe("usePreventScrollChaining", () => {
  it("prevents wheel chaining when no inner element can scroll", () => {
    const root = document.createElement("div");
    const child = document.createElement("div");
    root.appendChild(child);
    document.body.appendChild(root);
    const rootRef = { current: root };
    const preventDefault = vi.fn();

    defineScrollMetrics(root, {
      scrollHeight: 100,
      clientHeight: 100,
      scrollWidth: 100,
      clientWidth: 100,
    });
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      overflowY: "auto",
      overflowX: "visible",
    } as CSSStyleDeclaration);

    render(<Harness rootRef={rootRef} />);

    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: 10,
    });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });
    child.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);

    document.body.removeChild(root);
    vi.restoreAllMocks();
  });

  it("treats non-finite wheel deltas as no-scroll input", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    const rootRef = { current: root };
    const preventDefault = vi.fn();

    defineScrollMetrics(root, {
      scrollHeight: 300,
      clientHeight: 100,
      scrollWidth: 100,
      clientWidth: 100,
    });
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      overflowY: "auto",
      overflowX: "visible",
    } as CSSStyleDeclaration);

    render(<Harness rootRef={rootRef} />);

    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, "deltaY", { value: Number.NaN });
    Object.defineProperty(event, "preventDefault", { value: preventDefault });
    root.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);

    document.body.removeChild(root);
    vi.restoreAllMocks();
  });
});
