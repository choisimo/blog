import { useCallback, useEffect, useRef, useState } from "react";

type KeyboardViewportState = {
  keyboardHeight: number;
  keyboardVisible: boolean;
  viewportHeight: string;
  viewportTop: number;
};

export function useKeyboardHeight(isMobile: boolean) {
  const [state, setState] = useState<KeyboardViewportState>({
    keyboardHeight: 0,
    keyboardVisible: false,
    viewportHeight: "100dvh",
    viewportTop: 0,
  });
  const baselineHeightRef = useRef<number>(0);

  useEffect(() => {
    if (!isMobile || typeof window === "undefined") {
      setState({
        keyboardHeight: 0,
        keyboardVisible: false,
        viewportHeight: "100dvh",
        viewportTop: 0,
      });
      return;
    }

    const vv = window.visualViewport;
    baselineHeightRef.current = Math.round(vv?.height || window.innerHeight);
    let rafHandle: number | null = null;

    const measure = () => {
      const visualHeight = vv?.height || window.innerHeight;
      const top = vv?.offsetTop || 0;

      // Adapt baseline when viewport changed naturally (rotation/address bar) without keyboard.
      const tentativeKeyboard = Math.max(
        0,
        Math.round(baselineHeightRef.current - visualHeight - top),
      );
      if (
        tentativeKeyboard < 48 &&
        visualHeight > baselineHeightRef.current - 32
      ) {
        baselineHeightRef.current = Math.round(visualHeight);
      }

      const rawKeyboardHeight = Math.max(
        0,
        Math.round(baselineHeightRef.current - visualHeight - top),
      );
      const keyboardHeight = rawKeyboardHeight > 90 ? rawKeyboardHeight : 0;
      const nextState: KeyboardViewportState = {
        keyboardHeight,
        keyboardVisible: keyboardHeight > 0,
        viewportHeight: `${Math.max(320, Math.round(visualHeight))}px`,
        viewportTop: Math.max(0, Math.round(top)),
      };
      setState((prev) => {
        if (
          prev.keyboardHeight === nextState.keyboardHeight &&
          prev.keyboardVisible === nextState.keyboardVisible &&
          prev.viewportHeight === nextState.viewportHeight &&
          prev.viewportTop === nextState.viewportTop
        ) {
          return prev;
        }
        return nextState;
      });
    };

    const scheduleMeasure = () => {
      if (rafHandle !== null) return;
      rafHandle = requestAnimationFrame(() => {
        rafHandle = null;
        measure();
      });
    };

    scheduleMeasure();

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);
    vv?.addEventListener("resize", scheduleMeasure);
    vv?.addEventListener("scroll", scheduleMeasure);

    return () => {
      if (rafHandle !== null) {
        cancelAnimationFrame(rafHandle);
        rafHandle = null;
      }
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
      vv?.removeEventListener("resize", scheduleMeasure);
      vv?.removeEventListener("scroll", scheduleMeasure);
    };
  }, [isMobile]);

  return state;
}

type UseInputKeyDownProps = {
  canSend: boolean;
  send: () => void;
};

export function useInputKeyDown({ canSend, send }: UseInputKeyDownProps) {
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (canSend) void send();
      }
    },
    [canSend, send],
  );

  return onKeyDown;
}
