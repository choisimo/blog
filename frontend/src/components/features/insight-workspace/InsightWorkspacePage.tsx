import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Calendar,
  Check,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import ChatWidget from "@/components/molecules/ChatWidget";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { getPosts } from "@/data/content/posts";
import { cn } from "@/lib/utils";
import { curiosityTracker } from "@/services/engagement/curiosity";
import { loadSessionsIndex } from "@/services/chat";
import type { BlogPost } from "@/types/blog";
import { buildInsightGraph, getPostKey } from "./domain";
import type {
  AiMemoEventRecord,
  CuriosityEventLike,
  InsightActionStatus,
  InsightGraph,
  InsightGraphNode,
  InsightNodeType,
  InsightWorkspaceItem,
  InsightWorkspaceItemKind,
} from "./types";

const STACK_STORAGE_KEY = "insight.workspace.stack.v1";
const MAX_STACK_ITEMS = 8;

const TOKENS = {
  shell: "min-h-screen bg-background text-foreground",
  card:
    "border border-border/70 bg-card/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/90",
  focus:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2",
  motion:
    "transition-[transform,opacity,box-shadow,border-color,background-color,color] duration-200 ease-spring motion-reduce:transition-none",
} as const;

const NODE_STYLE: Record<
  InsightNodeType,
  { icon: typeof FileText; className: string; label: string }
> = {
  post: {
    icon: FileText,
    label: "Post",
    className:
      "border-blue-500/60 bg-blue-50 text-blue-700 shadow-blue-500/15 dark:bg-blue-950/50 dark:text-blue-200",
  },
  chat: {
    icon: Bot,
    label: "AI Chat",
    className:
      "border-violet-500/60 bg-violet-50 text-violet-700 shadow-violet-500/15 dark:bg-violet-950/50 dark:text-violet-200",
  },
  memo: {
    icon: NotebookPen,
    label: "Memo",
    className:
      "border-emerald-500/60 bg-emerald-50 text-emerald-700 shadow-emerald-500/15 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
  thought: {
    icon: Sparkles,
    label: "Thought",
    className:
      "border-amber-500/60 bg-amber-50 text-amber-700 shadow-amber-500/15 dark:bg-amber-950/50 dark:text-amber-200",
  },
  tag: {
    icon: Tag,
    label: "Tag",
    className:
      "border-sky-500/60 bg-sky-50 text-sky-700 shadow-sky-500/15 dark:bg-sky-950/50 dark:text-sky-200",
  },
  search: {
    icon: Search,
    label: "Search",
    className:
      "border-zinc-400/60 bg-zinc-50 text-zinc-700 shadow-zinc-500/10 dark:bg-zinc-900 dark:text-zinc-200",
  },
};

type LegacyMemoElement = HTMLElement & {
  shadowRoot: ShadowRoot | null;
};

function readAiMemoEvents(): AiMemoEventRecord[] {
  try {
    const raw = localStorage.getItem("aiMemo.events");
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as AiMemoEventRecord[]) : [];
  } catch {
    return [];
  }
}

function readStackItems(): InsightWorkspaceItem[] {
  try {
    const raw = localStorage.getItem(STACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is InsightWorkspaceItem =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as InsightWorkspaceItem).id === "string" &&
            typeof (item as InsightWorkspaceItem).title === "string" &&
            typeof (item as InsightWorkspaceItem).createdAt === "number",
        ),
    );
  } catch {
    return [];
  }
}

function writeStackItems(items: InsightWorkspaceItem[]) {
  try {
    localStorage.setItem(STACK_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Non-critical browser storage failure.
  }
}

function formatPostDate(post?: BlogPost): string | null {
  if (!post?.date) return null;
  const parsed = new Date(post.date);
  if (Number.isNaN(parsed.getTime())) return post.date;
  return parsed.toLocaleDateString();
}

function getNodeSubtitle(node: InsightGraphNode): string {
  if (node.type === "post") {
    const date = formatPostDate(node.post);
    return [node.post?.category, date].filter(Boolean).join(" · ");
  }
  if (node.postKey) return node.postKey;
  return NODE_STYLE[node.type].label;
}

function getStackKind(node: InsightGraphNode): InsightWorkspaceItemKind {
  if (node.type === "chat") return "chat";
  if (node.type === "thought") return "thought";
  if (node.type === "memo") return "memo";
  return "post";
}

function createStackItem(node: InsightGraphNode): InsightWorkspaceItem {
  return {
    id: `${node.type}:${node.id}`,
    nodeId: node.id,
    kind: getStackKind(node),
    title: node.label,
    subtitle: getNodeSubtitle(node),
    postKey: node.postKey,
    createdAt: Date.now(),
  };
}

function buildChatInitialMessage(post: BlogPost): string {
  return [
    `${post.title} 글을 기준으로 핵심 인사이트를 3가지로 요약해줘.`,
    "",
    `게시물: ${post.year}/${post.slug}`,
  ].join("\n");
}

function statusClasses(status: InsightActionStatus) {
  switch (status.tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
    case "error":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border/70 bg-muted/40 text-muted-foreground";
  }
}

function useInsightGraphData() {
  const [graph, setGraph] = useState<InsightGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const posts = await getPosts();
        const chatSessions = loadSessionsIndex();
        const aiMemoEvents = readAiMemoEvents();
        const curiosityEvents =
          curiosityTracker.getEvents() as CuriosityEventLike[];
        const nextGraph = buildInsightGraph({
          posts,
          chatSessions,
          aiMemoEvents,
          curiosityEvents,
        });
        if (!cancelled) setGraph(nextGraph);
      } catch (err) {
        if (!cancelled) {
          setGraph(null);
          setError(
            err instanceof Error ? err.message : "Failed to load insight graph",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { graph, loading, error };
}

function findPostNodeForItem(
  graph: InsightGraph | null,
  item: InsightWorkspaceItem,
): string | null {
  if (!graph) return null;
  if (item.nodeId && graph.nodes.some((node) => node.id === item.nodeId)) {
    return item.nodeId;
  }
  if (!item.postKey) return null;
  return graph.nodes.find((node) => node.type === "post" && node.postKey === item.postKey)
    ?.id ?? null;
}

export default function InsightWorkspacePage() {
  const navigate = useNavigate();
  const { isTerminal } = useTheme();
  const { graph, loading, error } = useInsightGraphData();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [stackItems, setStackItems] = useState<InsightWorkspaceItem[]>(() =>
    typeof window === "undefined" ? [] : readStackItems(),
  );
  const [status, setStatus] = useState<InsightActionStatus>({
    tone: "idle",
    message: "Post inspector ready.",
  });
  const [chatPost, setChatPost] = useState<BlogPost | null>(null);

  const selectedNode = useMemo(
    () => graph?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [graph, selectedNodeId],
  );

  const graphStats = useMemo(
    () => ({
      nodes: graph?.nodes.length ?? 0,
      posts: graph?.nodes.filter((node) => node.type === "post").length ?? 0,
      connections: graph?.edges.length ?? 0,
    }),
    [graph],
  );

  useEffect(() => {
    writeStackItems(stackItems);
  }, [stackItems]);

  useEffect(() => {
    if (!selectedNodeId && graph?.nodes.length) {
      setSelectedNodeId(graph.nodes.find((node) => node.type === "post")?.id ?? graph.nodes[0].id);
    }
  }, [graph, selectedNodeId]);

  const addNodeToStack = useCallback((node: InsightGraphNode) => {
    const item = createStackItem(node);
    setStackItems((prev) => [
      item,
      ...prev.filter((candidate) => candidate.id !== item.id),
    ].slice(0, MAX_STACK_ITEMS));
    setStatus({
      tone: "success",
      message: `${node.label} added to the insight stack.`,
    });
  }, []);

  const removeStackItem = useCallback((id: string) => {
    setStackItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearStack = useCallback(() => {
    setStackItems([]);
    setStatus({ tone: "idle", message: "Stack tray cleared." });
  }, []);

  const openPost = useCallback(
    (post: BlogPost) => {
      navigate(`/blog/${post.year}/${post.slug}`);
    },
    [navigate],
  );

  const openMemo = useCallback((post: BlogPost) => {
    const postKey = getPostKey(post);
    try {
      window.dispatchEvent(
        new CustomEvent("aiMemo:desktopLayout", {
          detail: { mode: "rail", postId: postKey },
        }),
      );
      const memoEl = document.querySelector("ai-memo-pad") as LegacyMemoElement | null;
      const launcher = memoEl?.shadowRoot?.getElementById("launcher") as HTMLElement | null;
      if (!launcher) {
        setStatus({
          tone: "warning",
          message: "Memo pad is not available on this page yet.",
        });
        return;
      }
      launcher.click();
      setStatus({
        tone: "success",
        message: `Memo opened for ${postKey}.`,
      });
    } catch {
      setStatus({
        tone: "error",
        message: "Could not open memo from the insight workspace.",
      });
    }
  }, []);

  const openChat = useCallback((post: BlogPost) => {
    setChatPost(post);
    setStatus({
      tone: "success",
      message: `AI chat opened with ${post.year}/${post.slug} context.`,
    });
  }, []);

  const selectStackItem = useCallback(
    (item: InsightWorkspaceItem) => {
      const targetNodeId = findPostNodeForItem(graph, item);
      if (targetNodeId) setSelectedNodeId(targetNodeId);
    },
    [graph],
  );

  return (
    <div className={cn(TOKENS.shell, isTerminal && "font-mono")}>
      <header className="border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={() => navigate(-1)}
              aria-label="Back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MapIcon className="h-5 w-5 text-primary" />
                <h1 className="truncate text-lg font-semibold tracking-normal">
                  Insight Graph
                </h1>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                Posts, memos, AI chat, and stack items in one graph workspace.
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <StatPill label="Posts" value={graphStats.posts} />
            <StatPill label="Nodes" value={graphStats.nodes} />
            <StatPill label="Links" value={graphStats.connections} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-[1500px] grid-cols-1 gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className={cn(TOKENS.card, "min-h-[560px] overflow-hidden rounded-lg")}>
          {loading ? (
            <InsightSkeleton />
          ) : error ? (
            <InsightError message={error} />
          ) : graph ? (
            <InsightGraphStage
              graph={graph}
              selectedNodeId={selectedNodeId}
              onSelectNode={(node) => {
                setSelectedNodeId(node.id);
                setStatus({
                  tone: "idle",
                  message: `${node.label} selected.`,
                });
              }}
            />
          ) : (
            <InsightError message="No graph data available." />
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <PostInspector
            node={selectedNode}
            status={status}
            onOpenPost={openPost}
            onOpenMemo={openMemo}
            onOpenChat={openChat}
            onAddToStack={addNodeToStack}
          />
          <StackTray
            items={stackItems}
            selectedNodeId={selectedNodeId}
            onSelect={selectStackItem}
            onRemove={removeStackItem}
            onClear={clearStack}
          />
        </aside>
      </main>

      {chatPost && (
        <ChatWidget
          initialMessage={buildChatInitialMessage(chatPost)}
          currentPost={{
            title: chatPost.title,
            slug: chatPost.slug,
            year: chatPost.year,
            description: chatPost.description || chatPost.excerpt,
            headings: chatPost.tags.slice(0, 6),
          }}
          onClose={() => setChatPost(null)}
        />
      )}
    </div>
  );
}

const StatPill = memo(function StatPill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-border/70 bg-card px-3 py-1.5 tabular-nums">
      <span className="text-foreground">{value}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
});

const InsightSkeleton = memo(function InsightSkeleton() {
  return (
    <div className="flex h-full min-h-[560px] flex-col p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        Building graph
      </div>
      <div className="relative mt-6 aspect-[16/10] min-h-[420px] overflow-hidden rounded-lg border border-border/70 bg-muted/30">
        <div className="absolute left-[48%] top-[45%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted" />
        {[14, 26, 38, 62, 74, 86].map((left, index) => (
          <div
            key={left}
            className="absolute h-12 w-12 rounded-full bg-muted/80"
            style={{
              left: `${left}%`,
              top: `${index % 2 === 0 ? 28 : 68}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
});

const InsightError = memo(function InsightError({ message }: { message: string }) {
  return (
    <div className="grid h-full min-h-[560px] place-items-center p-6 text-center">
      <div>
        <X className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 text-base font-semibold">Insight graph unavailable</h2>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
});

const InsightGraphStage = memo(function InsightGraphStage({
  graph,
  selectedNodeId,
  onSelectNode,
}: {
  graph: InsightGraph;
  selectedNodeId: string | null;
  onSelectNode: (node: InsightGraphNode) => void;
}) {
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes],
  );

  return (
    <div className="flex h-full min-h-[560px] flex-col">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Context graph</h2>
          <p className="text-xs text-muted-foreground">
            Posts, memos, chats, and recent attention signals.
          </p>
        </div>
        <div className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          Updated {new Date(graph.updatedAt).toLocaleTimeString()}
        </div>
      </div>

      <div className="relative m-4 flex-1 overflow-hidden rounded-lg border border-border/70 bg-[radial-gradient(circle_at_center,hsl(var(--muted))_1px,transparent_1px)] [background-size:28px_28px]">
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {graph.edges.map((edge) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) return null;
            const active =
              selectedNodeId === source.id || selectedNodeId === target.id;
            return (
              <line
                key={edge.id}
                x1={source.x}
                y1={source.y}
                x2={target.x}
                y2={target.y}
                className={cn(
                  "stroke-border transition-opacity duration-200 motion-reduce:transition-none",
                  active ? "opacity-90" : "opacity-35",
                )}
                strokeWidth={active ? 0.22 : 0.12}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {graph.nodes.map((node) => (
          <GraphNodeButton
            key={node.id}
            node={node}
            selected={selectedNodeId === node.id}
            onSelect={() => onSelectNode(node)}
          />
        ))}
      </div>
    </div>
  );
});

const GraphNodeButton = memo(function GraphNodeButton({
  node,
  selected,
  onSelect,
}: {
  node: InsightGraphNode;
  selected: boolean;
  onSelect: () => void;
}) {
  const style = NODE_STYLE[node.type];
  const Icon = style.icon;
  const sizeClass =
    node.type === "post"
      ? "h-6 w-6 sm:h-16 sm:w-16"
      : "h-6 w-6 sm:h-11 sm:w-11";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border shadow-md",
        TOKENS.focus,
        TOKENS.motion,
        sizeClass,
        style.className,
        selected
          ? "z-20 scale-110 border-primary shadow-xl ring-4 ring-primary/15"
          : "z-10 hover:z-20 hover:scale-105 active:scale-95",
      )}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      aria-pressed={selected}
      aria-label={`${style.label}: ${node.label}`}
      title={node.label}
    >
      <Icon
        className={
          node.type === "post"
            ? "h-3.5 w-3.5 sm:h-6 sm:w-6"
            : "h-3 w-3 sm:h-4 sm:w-4"
        }
      />
      {node.type === "post" && (
        <span className="absolute top-[calc(100%+6px)] max-w-36 rounded-md bg-background/95 px-2 py-1 text-xs text-foreground opacity-0 shadow-sm ring-1 ring-border transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
          {node.label}
        </span>
      )}
    </button>
  );
});

const PostInspector = memo(function PostInspector({
  node,
  status,
  onOpenPost,
  onOpenMemo,
  onOpenChat,
  onAddToStack,
}: {
  node: InsightGraphNode | null;
  status: InsightActionStatus;
  onOpenPost: (post: BlogPost) => void;
  onOpenMemo: (post: BlogPost) => void;
  onOpenChat: (post: BlogPost) => void;
  onAddToStack: (node: InsightGraphNode) => void;
}) {
  const post = node?.post;
  const nodeStyle = node ? NODE_STYLE[node.type] : NODE_STYLE.post;
  const NodeIcon = nodeStyle.icon;

  return (
    <section className={cn(TOKENS.card, "rounded-lg")}>
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <NodeIcon className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Post Inspector</h2>
        </div>
        {node && (
          <span className="rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
            {NODE_STYLE[node.type].label}
          </span>
        )}
      </div>

      <div className="space-y-4 p-4">
        {node ? (
          <>
            <div>
              <h3 className="line-clamp-2 text-base font-semibold leading-snug">
                {node.label}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {getNodeSubtitle(node)}
              </p>
            </div>

            {post?.excerpt && (
              <p className="line-clamp-4 rounded-md border border-border/70 bg-muted/30 p-3 text-sm leading-6 text-muted-foreground">
                {post.excerpt}
              </p>
            )}

            <div className={cn("rounded-md border px-3 py-2 text-sm", statusClasses(status))} role="status">
              {status.message}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 justify-start"
                onClick={() => post && onOpenPost(post)}
                disabled={!post}
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 justify-start"
                onClick={() => post && onOpenMemo(post)}
                disabled={!post}
              >
                <NotebookPen className="h-4 w-4" />
                Memo
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 justify-start"
                onClick={() => post && onOpenChat(post)}
                disabled={!post}
              >
                <MessageSquare className="h-4 w-4" />
                AI Chat
              </Button>
              <Button
                type="button"
                className="min-h-11 justify-start"
                onClick={() => onAddToStack(node)}
              >
                <Plus className="h-4 w-4" />
                Stack
              </Button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <MapIcon className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-2 text-sm text-muted-foreground">
              No graph node selected.
            </p>
          </div>
        )}
      </div>
    </section>
  );
});

const StackTray = memo(function StackTray({
  items,
  selectedNodeId,
  onSelect,
  onRemove,
  onClear,
}: {
  items: InsightWorkspaceItem[];
  selectedNodeId: string | null;
  onSelect: (item: InsightWorkspaceItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <section className={cn(TOKENS.card, "flex min-h-[260px] flex-1 flex-col rounded-lg")}>
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Stack Tray</h2>
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {items.length}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onClear}
          disabled={!items.length}
          aria-label="Clear stack tray"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {items.length ? (
          <ul className="space-y-2">
            {items.map((item) => {
              const active = item.nodeId === selectedNodeId;
              return (
                <li key={item.id}>
                  <div
                    className={cn(
                      "group grid grid-cols-[1fr_36px] gap-2 rounded-md border p-3",
                      TOKENS.motion,
                      active
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/70 bg-background hover:bg-muted/50",
                    )}
                  >
                    <button
                      type="button"
                      className={cn("min-h-11 min-w-0 text-left", TOKENS.focus)}
                      onClick={() => onSelect(item)}
                    >
                      <div className="flex items-center gap-2">
                        <StackKindDot kind={item.kind} />
                        <span className="truncate text-sm font-medium">
                          {item.title}
                        </span>
                        {active && <Check className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      {item.subtitle && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span className="truncate">{item.subtitle}</span>
                        </div>
                      )}
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "grid h-9 w-9 place-items-center self-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                        TOKENS.focus,
                        TOKENS.motion,
                      )}
                      onClick={() => onRemove(item.id)}
                      aria-label={`Remove ${item.title} from stack`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid h-full min-h-[180px] place-items-center rounded-md border border-dashed border-border/70 p-4 text-center">
            <div>
              <Layers className="mx-auto h-9 w-9 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">
                Stack selected posts, memos, and chats here.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

function StackKindDot({ kind }: { kind: InsightWorkspaceItemKind }) {
  const className =
    kind === "chat"
      ? "bg-violet-500"
      : kind === "memo"
        ? "bg-emerald-500"
        : kind === "thought"
          ? "bg-amber-500"
          : "bg-blue-500";

  return <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", className)} />;
}
