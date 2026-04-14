import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/utils/network/apiBase";

export type CommentItem = {
  id?: string;
  postId: string;
  author: string;
  content: string;
  website?: string | null;
  parentId?: string | null;
  createdAt?: string | null;
};

type ArchivedPayload = { comments: CommentItem[] };

export type CommentListResponse = {
  comments?: CommentItem[];
  data?: {
    comments?: CommentItem[];
    id?: string;
  };
  id?: string;
};

type CommentStreamAppend = {
  type: "append";
  items: CommentItem[];
};

type CommentCursor = {
  since?: string;
  sinceId?: string;
};

const COMMENT_STREAM_RETRY_BASE_MS = 1_000;
const COMMENT_STREAM_RETRY_MAX_MS = 10_000;

type ArchivedModule = ArchivedPayload | { default: ArchivedPayload };

const archivedModules = import.meta.glob<ArchivedModule>(
  "../../../data/comments/**/*.json",
);

function getCommentsBaseUrl(): string {
  return getApiBaseUrl().replace(/\/$/, "");
}

function getCommentTimestamp(item: CommentItem): number {
  return item.createdAt ? Date.parse(item.createdAt) || 0 : 0;
}

function compareCommentItems(left: CommentItem, right: CommentItem): number {
  const timestampDiff = getCommentTimestamp(left) - getCommentTimestamp(right);
  if (timestampDiff !== 0) return timestampDiff;
  return String(left.id || "").localeCompare(String(right.id || ""));
}

export function getCommentKey(item: CommentItem): string {
  return String(
    item.id ||
      `${item.createdAt || ""}|${item.author || ""}|${(item.content || "").slice(0, 24)}`,
  );
}

export function sortComments(items: CommentItem[]): CommentItem[] {
  return [...items].sort(compareCommentItems);
}

export function mergeCommentItems(
  current: CommentItem[] | null | undefined,
  incoming: CommentItem[],
): CommentItem[] {
  const merged = [...(current || [])];
  const seen = new Set(merged.map(getCommentKey));

  for (const item of incoming) {
    const key = getCommentKey(item);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return sortComments(merged);
}

export function extractCommentList(data: CommentListResponse): CommentItem[] {
  const items = Array.isArray(data?.comments)
    ? data.comments
    : Array.isArray(data?.data?.comments)
      ? data.data.comments
      : [];

  return sortComments(items);
}

export function parseCommentStreamMessage(
  raw: string,
): CommentStreamAppend | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as CommentStreamAppend).type === "append" &&
      Array.isArray((parsed as CommentStreamAppend).items)
    ) {
      return parsed as CommentStreamAppend;
    }
  } catch {
    return null;
  }

  return null;
}

async function getArchivedComments(
  postId: string,
): Promise<ArchivedPayload | null> {
  const key = Object.keys(archivedModules).find((entry) =>
    entry.endsWith(`/${postId}.json`),
  );
  if (!key) return null;

  const mod = await archivedModules[key]();
  const data = "default" in mod ? mod.default : mod;
  if (!data || !Array.isArray((data as ArchivedPayload).comments)) {
    return null;
  }

  return {
    comments: sortComments((data as ArchivedPayload).comments),
  };
}

function resolveCommentCursor(
  items: CommentItem[] | null | undefined,
  fallbackSince?: string,
): CommentCursor {
  const sorted = sortComments(items || []);
  const lastItem = sorted[sorted.length - 1];

  if (lastItem?.createdAt) {
    return {
      since: lastItem.createdAt,
      sinceId: lastItem.id,
    };
  }

  if (fallbackSince) {
    return { since: fallbackSince };
  }

  return {};
}

export function advanceCommentCursor(
  current: CommentCursor,
  incoming: CommentItem[],
  fallbackSince?: string,
): CommentCursor {
  const sorted = sortComments(incoming);
  const lastItem = sorted[sorted.length - 1];

  if (lastItem?.createdAt) {
    return {
      since: lastItem.createdAt,
      sinceId: lastItem.id,
    };
  }

  if (current.since || current.sinceId) {
    return current;
  }

  return resolveCommentCursor([], fallbackSince);
}

export function getCommentStreamRetryDelay(attempt: number): number {
  if (!Number.isFinite(attempt) || attempt <= 1) {
    return COMMENT_STREAM_RETRY_BASE_MS;
  }

  return Math.min(
    COMMENT_STREAM_RETRY_BASE_MS * 2 ** (attempt - 1),
    COMMENT_STREAM_RETRY_MAX_MS,
  );
}

export function buildCommentsStreamUrl(
  postId: string,
  cursor: CommentCursor = {},
): string {
  const params = new URLSearchParams({ postId });
  if (cursor.since) params.set("since", cursor.since);
  if (cursor.sinceId) params.set("sinceId", cursor.sinceId);
  return `${getCommentsBaseUrl()}/api/v1/comments/stream?${params.toString()}`;
}

function buildCommentsListUrl(postId: string): string {
  const params = new URLSearchParams({ postId });
  return `${getCommentsBaseUrl()}/api/v1/comments?${params.toString()}`;
}

function openCommentStream(
  postId: string,
  cursor: CommentCursor,
  onAppend: (items: CommentItem[]) => void,
  onDisconnect: () => void,
  onOpen?: () => void,
): EventSource {
  const stream = new EventSource(buildCommentsStreamUrl(postId, cursor), {
    withCredentials: true,
  });

  stream.onopen = () => {
    onOpen?.();
  };

  stream.onmessage = (event) => {
    const append = parseCommentStreamMessage(event.data);
    if (append) {
      onAppend(append.items);
    }
  };

  stream.onerror = () => {
    stream.close();
    onDisconnect();
  };

  return stream;
}

export function useCommentsFeed(postId: string) {
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasArchived, setHasArchived] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempts = 0;
    let latestComments: CommentItem[] | null = null;
    let currentCursor: CommentCursor = {};
    let requestedAt = new Date().toISOString();

    setComments(null);
    setHasArchived(false);
    setError(null);
    setLoading(true);

    function clearReconnectTimer() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    }

    function closeStream() {
      if (stream) {
        stream.close();
        stream = null;
      }
    }

    function connectStream(cursor: CommentCursor) {
      if (cancelled) return;

      closeStream();
      currentCursor = cursor;

      stream = openCommentStream(
        postId,
        cursor,
        (items) => {
          clearReconnectTimer();
          reconnectAttempts = 0;
          setComments((prev) => {
            const merged = mergeCommentItems(prev, items);
            latestComments = merged;
            currentCursor = advanceCommentCursor(
              currentCursor,
              items,
              requestedAt,
            );
            return merged;
          });
        },
        () => {
          if (cancelled) return;

          closeStream();
          clearReconnectTimer();
          reconnectAttempts += 1;
          reconnectTimer = setTimeout(() => {
            connectStream(resolveCommentCursor(latestComments, requestedAt));
          }, getCommentStreamRetryDelay(reconnectAttempts));
        },
        () => {
          clearReconnectTimer();
          reconnectAttempts = 0;
        },
      );
    }

    async function load() {
      requestedAt = new Date().toISOString();

      try {
        const archived = await getArchivedComments(postId);

        if (archived) {
          if (!cancelled) {
            setComments(archived.comments);
            setHasArchived(true);
          }
          latestComments = archived.comments;
          currentCursor = resolveCommentCursor(archived.comments, requestedAt);
          connectStream(currentCursor);
          return;
        }

        const response = await fetch(buildCommentsListUrl(postId));
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as CommentListResponse;
        const list = extractCommentList(data);

        if (!cancelled) {
          setComments(list);
        }
        latestComments = list;
        currentCursor = resolveCommentCursor(list, requestedAt);
        connectStream(currentCursor);
      } catch (cause) {
        const message =
          cause instanceof Error ? cause.message : "Failed to load comments";
        if (!cancelled) {
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      clearReconnectTimer();
      closeStream();
    };
  }, [postId]);

  return {
    comments,
    setComments,
    loading,
    error,
    hasArchived,
  };
}
