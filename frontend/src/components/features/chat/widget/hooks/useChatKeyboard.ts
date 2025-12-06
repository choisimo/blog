import { useCallback, useEffect, useState } from "react";

export function useKeyboardHeight(isMobile: boolean) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!isMobile || typeof window === "undefined") return;

    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // When keyboard is up, visualViewport.height decreases
      const heightDiff = window.innerHeight - vv.height;
      setKeyboardHeight(heightDiff > 100 ? heightDiff : 0);
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, [isMobile]);

  return keyboardHeight;
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
