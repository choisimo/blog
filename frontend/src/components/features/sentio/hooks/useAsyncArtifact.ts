import { useCallback, useEffect, useRef } from "react";

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
};

export function useWarmingRetry({
  enabled,
  status,
  onRetry,
  delays = DEFAULT_WARMING_RETRY_DELAYS_MS,
}: UseWarmingRetryOptions) {
  const attemptRef = useRef(0);
  const onRetryRef = useRef(onRetry);

  useEffect(() => {
    onRetryRef.current = onRetry;
  }, [onRetry]);

  const reset = useCallback(() => {
    attemptRef.current = 0;
  }, []);

  useEffect(() => {
    if (!enabled || status !== "warming") {
      attemptRef.current = 0;
      return;
    }

    const lastDelay = delays[delays.length - 1] ?? 3000;
    const delay =
      delays[Math.min(attemptRef.current, Math.max(delays.length - 1, 0))] ??
      lastDelay;

    const timer = window.setTimeout(() => {
      attemptRef.current += 1;
      void onRetryRef.current();
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [delays, enabled, status]);

  return { reset };
}
