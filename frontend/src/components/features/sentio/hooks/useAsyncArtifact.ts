import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncArtifactSource = "feed" | "warming" | "fallback";

export type AsyncArtifactStatus =
  | "idle"
  | "warming"
  | "ready"
  | "fallback-hard"
  | "error";

export const DEFAULT_WARMING_RETRY_DELAYS_MS = [1500, 3000, 5000, 8000] as const;

export function getAsyncArtifactStatus(
  source: AsyncArtifactSource | null,
  options?: { hasError?: boolean },
): AsyncArtifactStatus {
  if (options?.hasError) {
    return "error";
  }
  if (source === "warming") {
    return "warming";
  }
  if (source === "feed") {
    return "ready";
  }
  if (source === "fallback") {
    return "fallback-hard";
  }
  return "idle";
}

export function shouldPersistAsyncArtifactSource(
  source: AsyncArtifactSource | null,
): source is Exclude<AsyncArtifactSource, "warming"> {
  return source === "feed" || source === "fallback";
}

type UseWarmingRetryOptions = {
  enabled: boolean;
  status: AsyncArtifactStatus;
  onRetry: () => void | Promise<void>;
  delays?: readonly number[];
  onExhausted?: () => void;
};

export function useWarmingRetry({
  enabled,
  status,
  onRetry,
  delays = DEFAULT_WARMING_RETRY_DELAYS_MS,
  onExhausted,
}: UseWarmingRetryOptions) {
  const attemptRef = useRef(0);
  const onRetryRef = useRef(onRetry);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    onRetryRef.current = onRetry;
  }, [onRetry]);

  const reset = useCallback(() => {
    attemptRef.current = 0;
    setRetryTick(tick => tick + 1);
  }, []);

  const onExhaustedRef = useRef(onExhausted);

  useEffect(() => {
    onExhaustedRef.current = onExhausted;
  }, [onExhausted]);

  useEffect(() => {
    if (!enabled || status !== "warming") {
      attemptRef.current = 0;
      return;
    }

    if (attemptRef.current >= delays.length) {
      onExhaustedRef.current?.();
      return;
    }

    const delay = delays[attemptRef.current] ?? delays[delays.length - 1] ?? 3000;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      attemptRef.current += 1;
      void Promise.resolve(onRetryRef.current()).finally(() => {
        if (!cancelled) {
          setRetryTick(tick => tick + 1);
        }
      });
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [delays, enabled, retryTick, status]);

  return { reset };
}
