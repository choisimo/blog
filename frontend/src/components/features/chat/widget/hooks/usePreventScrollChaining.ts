import { useEffect } from "react";
import type { RefObject } from "react";

function isScrollable(node: HTMLElement): boolean {
  let style: CSSStyleDeclaration;
  try {
    style = window.getComputedStyle(node);
  } catch {
    return false;
  }
  const overflowY = style.overflowY;
  const overflowX = style.overflowX;
  const canScrollY =
    (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
    node.scrollHeight > node.clientHeight + 1;
  const canScrollX =
    (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") &&
    node.scrollWidth > node.clientWidth + 1;

  return canScrollY || canScrollX;
}

function findScrollableAncestor(
  target: EventTarget | null,
  root: HTMLElement,
): HTMLElement | null {
  let node = target instanceof HTMLElement ? target : null;

  while (node && node !== root) {
    if (isScrollable(node)) {
      return node;
    }
    node = node.parentElement;
  }

  return isScrollable(root) ? root : null;
}

function safeScrollDelta(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function canScrollInDirection(element: HTMLElement, deltaX: number, deltaY: number): boolean {
  const safeDeltaX = safeScrollDelta(deltaX);
  const safeDeltaY = safeScrollDelta(deltaY);

  if (safeDeltaY !== 0) {
    if (safeDeltaY < 0) {
      return element.scrollTop > 0;
    }
    return element.scrollTop + element.clientHeight < element.scrollHeight - 1;
  }

  if (safeDeltaX !== 0) {
    if (safeDeltaX < 0) {
      return element.scrollLeft > 0;
    }
    return element.scrollLeft + element.clientWidth < element.scrollWidth - 1;
  }

  return false;
}

export function usePreventScrollChaining(
  rootRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.defaultPrevented || event.ctrlKey) return;
      if (!(event.target instanceof Node) || !root.contains(event.target)) return;

      const scrollable = findScrollableAncestor(event.target, root);
      event.stopPropagation();

      if (!scrollable) {
        event.preventDefault();
        return;
      }

      if (!canScrollInDirection(scrollable, event.deltaX, event.deltaY)) {
        event.preventDefault();
      }
    };

    root.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => {
      root.removeEventListener("wheel", handleWheel, true);
    };
  }, [rootRef]);
}
