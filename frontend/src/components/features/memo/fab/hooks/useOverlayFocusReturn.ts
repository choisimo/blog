import { useCallback, useEffect, useRef, useState } from 'react';

type TriggerKey = 'chat' | 'shell' | 'shell-path' | 'shell-output';

/** The FAB remounts its triggers after modal presence clears, so it owns restoration. */
export function useOverlayFocusReturn({
  active,
  blocked,
}: {
  active: boolean;
  blocked: boolean;
}) {
  const triggers = useRef(new Map<TriggerKey, HTMLElement>());
  const origin = useRef<{
    element: HTMLElement | null;
    key?: TriggerKey;
    path: string;
  } | null>(null);
  const [requested, setRequested] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const registerTrigger = useCallback(
    (key: TriggerKey, element: HTMLElement | null) => {
      if (element) triggers.current.set(key, element);
      else triggers.current.delete(key);
    },
    []
  );

  const rememberFocus = useCallback((key?: TriggerKey) => {
    // Shell -> real terminal -> chat remains one overlay session.
    if (origin.current) return;
    const element =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;
    const matchedKey =
      key ??
      [...triggers.current].find(([, trigger]) => trigger === element)?.[0];
    origin.current = {
      element,
      key: matchedKey,
      path: window.location.pathname,
    };
  }, []);

  const requestFocusReturn = useCallback(() => {
    // Some routes remove GlobalAssistants and the FAB together with its dialog.
    if (!mounted.current) {
      origin.current = null;
      document.getElementById('main-content')?.focus({ preventScroll: true });
      return;
    }
    setRequested(true);
  }, []);

  useEffect(() => {
    if (!requested || active || blocked) return;
    const frame = requestAnimationFrame(() => {
      const saved = origin.current;
      if (saved) {
        const sameRoute = saved.path === window.location.pathname;
        const target = sameRoute
          ? saved.key
            ? triggers.current.get(saved.key)
            : saved.element?.isConnected
              ? saved.element
              : null
          : null;
        (target ?? document.getElementById('main-content'))?.focus({
          preventScroll: true,
        });
      }
      origin.current = null;
      setRequested(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [active, blocked, requested]);

  return { registerTrigger, rememberFocus, requestFocusReturn };
}
