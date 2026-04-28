import type { BlogPost } from "@/types/blog";
import type {
  AiMemoEventRecord,
  BuildInsightGraphInput,
  InsightGraph,
  InsightGraphEdge,
  InsightGraphNode,
  InsightNodeType,
  InsightPostKey,
} from "./types";

const GRAPH_CENTER = { x: 50, y: 50 };
const POST_RING_RADIUS = 39;
const CHILD_RING_RADIUS = 10;

export function getPostKey(post: Pick<BlogPost, "year" | "slug">): InsightPostKey {
  return `${post.year}/${post.slug}`;
}

export function postKeyFromPath(value: unknown): InsightPostKey | null {
  if (typeof value !== "string") return null;
  const parts = value.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const slug = parts[parts.length - 1];
  const year = parts.find((part) => /^\d{4}$/.test(part));
  if (!year || !slug) return null;
  return `${year}/${decodeURIComponent(slug)}`;
}

export function postKeyFromArticleUrl(value: unknown): InsightPostKey | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return postKeyFromPath(new URL(value, "https://local.invalid").pathname);
  } catch {
    return postKeyFromPath(value);
  }
}

function stableIdPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
}

function normalizePostId(postKey: InsightPostKey): string {
  return `post:${postKey}`;
}

function isInsightNodeType(value: unknown): value is InsightNodeType {
  return (
    value === "post" ||
    value === "chat" ||
    value === "memo" ||
    value === "thought" ||
    value === "tag" ||
    value === "search"
  );
}

function coerceTimestamp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function coerceLabel(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getEventPostKey(event: AiMemoEventRecord): InsightPostKey | null {
  const year = event.page?.post?.year;
  const slug = event.page?.post?.slug;
  if (typeof year !== "string" && typeof year !== "number") return null;
  if (typeof slug !== "string" || !slug.trim()) return null;
  return `${String(year)}/${slug}`;
}

function positionOnRing(index: number, total: number, radius: number, center = GRAPH_CENTER) {
  const safeTotal = Math.max(total, 1);
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / safeTotal;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function childPosition(post: InsightGraphNode, childIndex: number, childTotal: number) {
  return positionOnRing(childIndex, childTotal, CHILD_RING_RADIUS, {
    x: post.x,
    y: post.y,
  });
}

function addEdge(
  edges: InsightGraphEdge[],
  source: string,
  target: string,
  type: InsightGraphEdge["type"],
  weight = 1,
) {
  if (source === target) return;
  const ordered = source < target ? [source, target] : [target, source];
  const id = `${type}:${ordered[0]}:${ordered[1]}`;
  if (edges.some((edge) => edge.id === id)) return;
  edges.push({ id, source, target, type, weight });
}

function groupChildrenByPost(nodes: InsightGraphNode[]) {
  const grouped = new Map<InsightPostKey, InsightGraphNode[]>();
  for (const node of nodes) {
    if (!node.postKey || node.type === "post") continue;
    const group = grouped.get(node.postKey) ?? [];
    group.push(node);
    grouped.set(node.postKey, group);
  }
  return grouped;
}

export function buildInsightGraph({
  posts,
  chatSessions,
  aiMemoEvents,
  curiosityEvents,
  maxPosts = 30,
}: BuildInsightGraphInput): InsightGraph {
  const recentPosts = posts.slice(0, maxPosts);
  const postByKey = new Map<InsightPostKey, BlogPost>();
  const nodes: InsightGraphNode[] = [];
  const edges: InsightGraphEdge[] = [];

  recentPosts.forEach((post, index) => {
    const postKey = getPostKey(post);
    postByKey.set(postKey, post);
    const position = positionOnRing(index, recentPosts.length, POST_RING_RADIUS);
    nodes.push({
      id: normalizePostId(postKey),
      type: "post",
      label: post.title,
      postKey,
      post,
      weight: 3,
      ...position,
    });
  });

  const postNodes = new Map(nodes.map((node) => [node.postKey, node]));

  chatSessions.slice(0, 24).forEach((chat) => {
    const postKey = postKeyFromArticleUrl(chat.articleUrl);
    if (!postKey || !postByKey.has(postKey)) return;
    const postNode = postNodes.get(postKey);
    if (!postNode) return;

    const node: InsightGraphNode = {
      id: `chat:${chat.id}`,
      type: "chat",
      label: chat.title || chat.articleTitle || "AI Chat",
      postKey,
      chat,
      ts: chat.updatedAt ? Date.parse(chat.updatedAt) : undefined,
      weight: 2,
      x: postNode.x,
      y: postNode.y,
      detail: chat.summary,
    };
    nodes.push(node);
    addEdge(edges, postNode.id, node.id, "chat", 1.4);
  });

  aiMemoEvents.slice(-80).forEach((event, index) => {
    const postKey = getEventPostKey(event);
    if (!postKey || !postByKey.has(postKey)) return;
    const rawType = typeof event.type === "string" ? event.type : "memo";
    const type: InsightNodeType =
      rawType === "thought"
        ? "thought"
        : rawType === "ask_block"
          ? "chat"
          : "memo";
    if (!isInsightNodeType(type)) return;

    const postNode = postNodes.get(postKey);
    if (!postNode) return;
    const label = coerceLabel(
      event.label,
      type === "thought" ? "Thought" : type === "chat" ? "AI prompt" : "Memo",
    );
    const ts = coerceTimestamp(event.t) ?? Date.now() - index;
    const node: InsightGraphNode = {
      id: `${type}:${postKey}:${ts}:${stableIdPart(label)}`,
      type,
      label,
      postKey,
      ts,
      weight: type === "thought" ? 1.6 : 1.4,
      x: postNode.x,
      y: postNode.y,
      detail: typeof event.content === "string" ? event.content : undefined,
    };
    nodes.push(node);
    addEdge(edges, postNode.id, node.id, type === "thought" ? "thought" : "memo", 1);
  });

  curiosityEvents.slice(-120).forEach((event) => {
    const eventType = typeof event.type === "string" ? event.type : "";
    const postKey = postKeyFromPath(event.context?.postId);

    if (eventType === "tag_click" && typeof event.context?.tag === "string" && postKey) {
      const postNode = postNodes.get(postKey);
      if (!postNode) return;
      const tag = event.context.tag;
      const nodeId = `tag:${stableIdPart(tag)}`;
      let node = nodes.find((candidate) => candidate.id === nodeId);
      if (!node) {
        node = {
          id: nodeId,
          type: "tag",
          label: `#${tag}`,
          postKey,
          ts: coerceTimestamp(event.ts),
          weight: 1,
          x: postNode.x,
          y: postNode.y,
        };
        nodes.push(node);
      }
      addEdge(edges, postNode.id, node.id, "activity", 0.8);
      return;
    }

    if (eventType === "search" && typeof event.context?.queryHash === "string") {
      const nodeId = `search:${stableIdPart(event.context.queryHash)}`;
      if (nodes.some((node) => node.id === nodeId)) return;
      const position = positionOnRing(nodes.length, Math.max(nodes.length + 1, 12), 42);
      nodes.push({
        id: nodeId,
        type: "search",
        label:
          typeof event.context.queryText === "string"
            ? event.context.queryText
            : "Search",
        ts: coerceTimestamp(event.ts),
        weight: 1,
        ...position,
      });
    }
  });

  for (let i = 0; i < recentPosts.length; i += 1) {
    for (let j = i + 1; j < recentPosts.length; j += 1) {
      const left = recentPosts[i];
      const right = recentPosts[j];
      const leftId = normalizePostId(getPostKey(left));
      const rightId = normalizePostId(getPostKey(right));
      if (left.category && left.category === right.category) {
        addEdge(edges, leftId, rightId, "category", 0.4);
      }
      if (left.tags.some((tag) => right.tags.includes(tag))) {
        addEdge(edges, leftId, rightId, "tag", 0.6);
      }
    }
  }

  const childrenByPost = groupChildrenByPost(nodes);
  for (const [postKey, children] of childrenByPost) {
    const postNode = postNodes.get(postKey);
    if (!postNode) continue;
    children.forEach((child, index) => {
      const position = childPosition(postNode, index, children.length);
      child.x = position.x;
      child.y = position.y;
    });
  }

  return {
    nodes,
    edges,
    updatedAt: Date.now(),
  };
}
