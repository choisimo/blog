import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  Command,
  Crosshair,
  ExternalLink,
  FileText,
  GitBranch,
  Grid2X2,
  Layers,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Maximize2,
  MessageSquare,
  Minus,
  MousePointer2,
  Network,
  NotebookPen,
  PanelRight,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
  X,
} from 'lucide-react';

import ChatWidget from '@/components/molecules/ChatWidget';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { getPosts } from '@/data/content/posts';
import { cn } from '@/lib/utils';
import { curiosityTracker } from '@/services/engagement/curiosity';
import { loadSessionsIndex } from '@/services/chat';
import type { BlogPost } from '@/types/blog';
import { buildInsightGraph, getPostKey } from './domain';
import type {
  AiMemoEventRecord,
  CuriosityEventLike,
  InsightActionStatus,
  InsightGraph,
  InsightGraphEdge,
  InsightGraphNode,
  InsightNodeType,
  InsightWorkspaceItem,
  InsightWorkspaceItemKind,
} from './types';

const STACK_STORAGE_KEY = 'insight.workspace.stack.v1';
const PINNED_STACK_STORAGE_KEY = 'insight.workspace.stack.pinned.v1';
const MAX_STACK_ITEMS = 8;

const TOKENS = {
  shell:
    'min-h-[calc(100vh-4rem)] bg-[#f7f9fc] text-slate-950 dark:bg-background dark:text-foreground',
  panel:
    'border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_16px_40px_rgba(15,23,42,0.06)] dark:border-border/70 dark:bg-card',
  elevated:
    'border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.07)] dark:border-border/70 dark:bg-card',
  focus:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/45 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-background',
  motion:
    'transition-[transform,opacity,box-shadow,border-color,background-color,color] duration-200 ease-spring motion-reduce:transition-none',
  iconButton:
    'grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 active:scale-95 disabled:pointer-events-none disabled:opacity-45 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-accent',
  chip: 'inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium',
} as const;

const NODE_STYLE: Record<
  InsightNodeType,
  {
    icon: typeof FileText;
    label: string;
    className: string;
    selectedClassName: string;
    pillClassName: string;
    dotClassName: string;
  }
> = {
  post: {
    icon: FileText,
    label: 'Post',
    className:
      'border-blue-200 bg-white text-slate-900 shadow-blue-500/10 dark:border-blue-900/70 dark:bg-blue-950/30 dark:text-blue-50',
    selectedClassName:
      'border-blue-500 bg-blue-50/95 shadow-blue-500/20 ring-blue-500/20 dark:bg-blue-950/60',
    pillClassName:
      'bg-blue-50 text-blue-600 ring-1 ring-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-900',
    dotClassName: 'bg-blue-500',
  },
  chat: {
    icon: Bot,
    label: 'AI Chat',
    className:
      'border-violet-200 bg-white text-slate-900 shadow-violet-500/10 dark:border-violet-900/70 dark:bg-violet-950/30 dark:text-violet-50',
    selectedClassName:
      'border-violet-500 bg-violet-50/95 shadow-violet-500/20 ring-violet-500/20 dark:bg-violet-950/60',
    pillClassName:
      'bg-violet-50 text-violet-600 ring-1 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-900',
    dotClassName: 'bg-violet-500',
  },
  memo: {
    icon: NotebookPen,
    label: 'Memo',
    className:
      'border-emerald-200 bg-white text-slate-900 shadow-emerald-500/10 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-50',
    selectedClassName:
      'border-emerald-500 bg-emerald-50/95 shadow-emerald-500/20 ring-emerald-500/20 dark:bg-emerald-950/60',
    pillClassName:
      'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:ring-emerald-900',
    dotClassName: 'bg-emerald-500',
  },
  thought: {
    icon: Sparkles,
    label: 'Thought',
    className:
      'border-amber-200 bg-white text-slate-900 shadow-amber-500/10 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-50',
    selectedClassName:
      'border-amber-500 bg-amber-50/95 shadow-amber-500/20 ring-amber-500/20 dark:bg-amber-950/60',
    pillClassName:
      'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-900',
    dotClassName: 'bg-amber-500',
  },
  tag: {
    icon: Tag,
    label: 'Tag',
    className:
      'border-sky-200 bg-white text-slate-900 shadow-sky-500/10 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-50',
    selectedClassName:
      'border-sky-500 bg-sky-50/95 shadow-sky-500/20 ring-sky-500/20 dark:bg-sky-950/60',
    pillClassName:
      'bg-sky-50 text-sky-600 ring-1 ring-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:ring-sky-900',
    dotClassName: 'bg-sky-500',
  },
  search: {
    icon: Search,
    label: 'Search',
    className:
      'border-slate-200 bg-white text-slate-900 shadow-slate-500/10 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-50',
    selectedClassName:
      'border-slate-500 bg-slate-50/95 shadow-slate-500/20 ring-slate-500/20 dark:bg-slate-900',
    pillClassName:
      'bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700',
    dotClassName: 'bg-slate-500',
  },
};

const EDGE_STYLE: Record<
  InsightGraphEdge['type'],
  {
    label: string;
    className: string;
    activeClassName: string;
    legendClassName: string;
    dash?: string;
  }
> = {
  category: {
    label: '주제 (Reference)',
    className: 'stroke-blue-400',
    activeClassName: 'stroke-blue-500',
    legendClassName: 'bg-blue-500',
  },
  tag: {
    label: '관련 (Related)',
    className: 'stroke-emerald-400',
    activeClassName: 'stroke-emerald-500',
    legendClassName: 'bg-emerald-500',
    dash: '4 5',
  },
  activity: {
    label: '유사 (Similar)',
    className: 'stroke-orange-400',
    activeClassName: 'stroke-orange-500',
    legendClassName: 'bg-orange-500',
    dash: '2 5',
  },
  chat: {
    label: '연결 (Linked)',
    className: 'stroke-violet-400',
    activeClassName: 'stroke-violet-500',
    legendClassName: 'bg-violet-500',
    dash: '5 4',
  },
  memo: {
    label: '방문 노트',
    className: 'stroke-slate-400',
    activeClassName: 'stroke-slate-600',
    legendClassName: 'bg-slate-500',
    dash: '6 4',
  },
  thought: {
    label: '방문 흐름',
    className: 'stroke-amber-400',
    activeClassName: 'stroke-amber-500',
    legendClassName: 'bg-amber-500',
    dash: '1 5',
  },
};

const ALL_NODE_TYPES: InsightNodeType[] = [
  'post',
  'memo',
  'chat',
  'thought',
  'tag',
  'search',
];

const GRAPH_FILTERS: Array<{
  id: string;
  label: string;
  icon: typeof FileText;
  types: InsightNodeType[];
}> = [
  { id: 'post', label: 'Post', icon: FileText, types: ['post'] },
  { id: 'memo', label: 'Memo', icon: NotebookPen, types: ['memo', 'thought'] },
  { id: 'chat', label: 'AI Chat', icon: Bot, types: ['chat'] },
  { id: 'link', label: 'Link', icon: Link2, types: ['tag', 'search'] },
];

type InspectorTab = 'preview' | 'info' | 'links' | 'notes' | 'activity';

const INSPECTOR_TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'preview', label: 'Preview' },
  { id: 'info', label: 'Info' },
  { id: 'links', label: 'Links' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
];

type LegacyMemoElement = HTMLElement & {
  shadowRoot: ShadowRoot | null;
};

type InsightConnection = {
  edge: InsightGraphEdge;
  node: InsightGraphNode;
  direction: 'incoming' | 'outgoing';
};

type InsightActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  tone: InsightNodeType | InsightGraphEdge['type'];
  ts?: number;
};

function readAiMemoEvents(): AiMemoEventRecord[] {
  try {
    const raw = localStorage.getItem('aiMemo.events');
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
    return parsed.filter((item): item is InsightWorkspaceItem =>
      Boolean(
        item &&
          typeof item === 'object' &&
          typeof (item as InsightWorkspaceItem).id === 'string' &&
          typeof (item as InsightWorkspaceItem).title === 'string' &&
          typeof (item as InsightWorkspaceItem).createdAt === 'number'
      )
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

function readPinnedStackIds(): Set<string> {
  try {
    const raw = localStorage.getItem(PINNED_STACK_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

function writePinnedStackIds(ids: Set<string>) {
  try {
    localStorage.setItem(PINNED_STACK_STORAGE_KEY, JSON.stringify([...ids]));
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
  if (node.type === 'post') {
    const date = formatPostDate(node.post);
    return [node.post?.category, date].filter(Boolean).join(' · ');
  }
  if (node.postKey) return node.postKey;
  return NODE_STYLE[node.type].label;
}

function formatNodeTimestamp(ts?: number): string {
  if (!ts) return 'No timestamp';
  const parsed = new Date(ts);
  if (Number.isNaN(parsed.getTime())) return 'No timestamp';
  return parsed.toLocaleString();
}

function getEdgeLabel(type: InsightGraphEdge['type']): string {
  return EDGE_STYLE[type]?.label ?? type;
}

function getNodeConnections(
  graph: InsightGraph | null,
  node: InsightGraphNode | null
): InsightConnection[] {
  if (!graph || !node) return [];
  const nodeById = new Map(
    graph.nodes.map(candidate => [candidate.id, candidate])
  );
  const connections: InsightConnection[] = [];

  graph.edges.forEach(edge => {
    if (edge.source === node.id) {
      const target = nodeById.get(edge.target);
      if (target) {
        connections.push({ edge, node: target, direction: 'outgoing' });
      }
      return;
    }
    if (edge.target === node.id) {
      const source = nodeById.get(edge.source);
      if (source) {
        connections.push({ edge, node: source, direction: 'incoming' });
      }
    }
  });

  return connections.sort(
    (left, right) => right.edge.weight - left.edge.weight
  );
}

function getNodeMemoNodes(
  graph: InsightGraph | null,
  node: InsightGraphNode | null
): InsightGraphNode[] {
  if (!graph || !node?.postKey) return [];
  return graph.nodes
    .filter(
      candidate =>
        candidate.postKey === node.postKey &&
        (candidate.type === 'memo' || candidate.type === 'thought')
    )
    .sort((left, right) => (right.ts ?? 0) - (left.ts ?? 0));
}

function getNodeActivityItems(
  node: InsightGraphNode | null,
  connections: InsightConnection[],
  memoNodes: InsightGraphNode[]
): InsightActivityItem[] {
  if (!node) return [];

  const connectionItems = connections.slice(0, 8).map(connection => ({
    id: connection.edge.id,
    title: `${getEdgeLabel(connection.edge.type)}: ${connection.node.label}`,
    subtitle: `${connection.direction === 'incoming' ? 'From' : 'To'} ${getNodeSubtitle(connection.node) || NODE_STYLE[connection.node.type].label}`,
    tone: connection.edge.type,
    ts: connection.node.ts,
  }));

  const memoItems = memoNodes.slice(0, 5).map(memo => ({
    id: memo.id,
    title: memo.label,
    subtitle: memo.detail
      ? summarizeText(memo.detail, 86)
      : `${NODE_STYLE[memo.type].label} · ${formatNodeTimestamp(memo.ts)}`,
    tone: memo.type,
    ts: memo.ts,
  }));

  return [
    {
      id: `${node.id}:selected`,
      title: `${node.label} selected`,
      subtitle: getNodeSubtitle(node) || NODE_STYLE[node.type].label,
      tone: node.type,
      ts: node.ts,
    },
    ...connectionItems,
    ...memoItems,
  ];
}

function getStackKind(node: InsightGraphNode): InsightWorkspaceItemKind {
  if (node.type === 'chat') return 'chat';
  if (node.type === 'thought') return 'thought';
  if (node.type === 'memo') return 'memo';
  return 'post';
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
    '',
    `게시물: ${post.year}/${post.slug}`,
  ].join('\n');
}

function statusClasses(status: InsightActionStatus) {
  switch (status.tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200';
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200';
    case 'error':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-border dark:bg-muted/30 dark:text-muted-foreground';
  }
}

function normalizeSearch(value: string) {
  return value.trim().toLowerCase();
}

function nodeMatchesQuery(node: InsightGraphNode, query: string) {
  if (!query) return true;
  const fields = [
    node.label,
    node.postKey,
    node.detail,
    node.post?.category,
    node.post?.description,
    node.post?.excerpt,
    ...(node.post?.tags ?? []),
  ];
  return fields.some(field => field?.toLowerCase().includes(query));
}

function buildEdgePath(source: InsightGraphNode, target: InsightGraphNode) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const sweep = source.id < target.id ? 1 : -1;
  const curve = Math.min(12, Math.max(4, Math.hypot(dx, dy) * 0.18));
  const cx1 = source.x + dx * 0.35 - dy * 0.08 * sweep - curve * 0.08;
  const cy1 = source.y + dy * 0.35 + dx * 0.08 * sweep;
  const cx2 = source.x + dx * 0.65 - dy * 0.08 * sweep + curve * 0.08;
  const cy2 = source.y + dy * 0.65 + dx * 0.08 * sweep;
  return `M ${source.x} ${source.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${target.x} ${target.y}`;
}

function summarizeText(value: string | undefined, maxLength = 128) {
  if (!value) return '';
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trim()}...`;
}

function buildInspectorBullets(node: InsightGraphNode) {
  const bullets = [
    node.post?.category ? `${node.post.category} 카테고리의 핵심 노드` : null,
    node.post?.tags?.length
      ? `${node.post.tags.slice(0, 3).join(', ')} 태그와 연결`
      : null,
    node.detail ? summarizeText(node.detail, 86) : null,
    node.post?.excerpt ? summarizeText(node.post.excerpt, 96) : null,
  ].filter(Boolean);

  return bullets.length
    ? (bullets as string[])
    : [`${NODE_STYLE[node.type].label} 노드의 연결 정보를 표시합니다.`];
}

function buildInspectorYaml(node: InsightGraphNode) {
  const kind = NODE_STYLE[node.type].label.replace(/\s+/g, '');
  return [
    'apiVersion: insight/v1',
    `kind: ${kind}`,
    'metadata:',
    `  name: ${node.id}`,
    `  postKey: ${node.postKey ?? 'none'}`,
    `  weight: ${node.weight}`,
  ].join('\n');
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
            err instanceof Error ? err.message : 'Failed to load insight graph'
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
  item: InsightWorkspaceItem
): string | null {
  if (!graph) return null;
  if (item.nodeId && graph.nodes.some(node => node.id === item.nodeId)) {
    return item.nodeId;
  }
  if (!item.postKey) return null;
  return (
    graph.nodes.find(
      node => node.type === 'post' && node.postKey === item.postKey
    )?.id ?? null
  );
}

export default function InsightWorkspacePage() {
  const navigate = useNavigate();
  const { isTerminal } = useTheme();
  const { graph, loading, error } = useInsightGraphData();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [stackItems, setStackItems] = useState<InsightWorkspaceItem[]>(() =>
    typeof window === 'undefined' ? [] : readStackItems()
  );
  const [dismissedRecentIds, setDismissedRecentIds] = useState<Set<string>>(
    () => new Set()
  );
  const [status, setStatus] = useState<InsightActionStatus>({
    tone: 'idle',
    message: 'Post inspector ready.',
  });
  const [chatPost, setChatPost] = useState<BlogPost | null>(null);

  useEffect(() => {
    const closeMemoPanel = () => {
      try {
        localStorage.setItem('aiMemo.isOpen', 'false');
      } catch {
        // Non-critical browser storage failure.
      }

      const memoEl = document.querySelector(
        'ai-memo-pad'
      ) as LegacyMemoElement | null;
      memoEl?.shadowRoot?.getElementById('panel')?.classList.remove('open');

      window.dispatchEvent(
        new CustomEvent('aiMemo:windowCommand', {
          detail: { action: 'close' },
        })
      );
    };

    closeMemoPanel();
    const timers = [100, 300, 700].map(delay =>
      window.setTimeout(closeMemoPanel, delay)
    );
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, []);

  const selectedNode = useMemo(
    () => graph?.nodes.find(node => node.id === selectedNodeId) ?? null,
    [graph, selectedNodeId]
  );

  const graphStats = useMemo(
    () => ({
      nodes: graph?.nodes.length ?? 0,
      posts: graph?.nodes.filter(node => node.type === 'post').length ?? 0,
      connections: graph?.edges.length ?? 0,
    }),
    [graph]
  );

  const recentGraphItems = useMemo(() => {
    if (!graph) return [];
    return graph.nodes
      .filter(
        node =>
          node.type === 'post' ||
          node.type === 'memo' ||
          node.type === 'chat' ||
          node.type === 'thought'
      )
      .slice(0, 5)
      .map(createStackItem);
  }, [graph]);

  const trayItems = useMemo(() => {
    if (stackItems.length) return stackItems;
    return recentGraphItems.filter(item => !dismissedRecentIds.has(item.id));
  }, [dismissedRecentIds, recentGraphItems, stackItems]);

  useEffect(() => {
    writeStackItems(stackItems);
  }, [stackItems]);

  useEffect(() => {
    if (!selectedNodeId && graph?.nodes.length) {
      setSelectedNodeId(
        graph.nodes.find(node => node.type === 'post')?.id ?? graph.nodes[0].id
      );
    }
  }, [graph, selectedNodeId]);

  const addNodeToStack = useCallback((node: InsightGraphNode) => {
    const item = createStackItem(node);
    setStackItems(prev =>
      [item, ...prev.filter(candidate => candidate.id !== item.id)].slice(
        0,
        MAX_STACK_ITEMS
      )
    );
    setStatus({
      tone: 'success',
      message: `${node.label} added to the insight stack.`,
    });
  }, []);

  const removeStackItem = useCallback((id: string) => {
    setStackItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearStack = useCallback(() => {
    setStackItems([]);
    setStatus({ tone: 'idle', message: 'Stack tray cleared.' });
  }, []);

  const removeTrayItem = useCallback(
    (id: string) => {
      if (stackItems.some(item => item.id === id)) {
        removeStackItem(id);
        return;
      }
      setDismissedRecentIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    },
    [removeStackItem, stackItems]
  );

  const clearTray = useCallback(() => {
    if (stackItems.length) {
      clearStack();
      return;
    }
    setDismissedRecentIds(new Set(recentGraphItems.map(item => item.id)));
    setStatus({ tone: 'idle', message: 'Recent stack tray cleared.' });
  }, [clearStack, recentGraphItems, stackItems.length]);

  const openPost = useCallback(
    (post: BlogPost) => {
      navigate(`/blog/${post.year}/${post.slug}`);
    },
    [navigate]
  );

  const openMemo = useCallback((post: BlogPost) => {
    const postKey = getPostKey(post);
    try {
      window.dispatchEvent(
        new CustomEvent('aiMemo:desktopLayout', {
          detail: { mode: 'rail', postId: postKey },
        })
      );
      const memoEl = document.querySelector(
        'ai-memo-pad'
      ) as LegacyMemoElement | null;
      const launcher = memoEl?.shadowRoot?.getElementById(
        'launcher'
      ) as HTMLElement | null;
      if (!launcher) {
        setStatus({
          tone: 'warning',
          message: 'Memo pad is not available on this page yet.',
        });
        return;
      }
      launcher.click();
      setStatus({
        tone: 'success',
        message: `Memo opened for ${postKey}.`,
      });
    } catch {
      setStatus({
        tone: 'error',
        message: 'Could not open memo from the insight workspace.',
      });
    }
  }, []);

  const openChat = useCallback((post: BlogPost) => {
    setChatPost(post);
    setStatus({
      tone: 'success',
      message: `AI chat opened with ${post.year}/${post.slug} context.`,
    });
  }, []);

  const selectStackItem = useCallback(
    (item: InsightWorkspaceItem) => {
      const targetNodeId = findPostNodeForItem(graph, item);
      if (targetNodeId) setSelectedNodeId(targetNodeId);
    },
    [graph]
  );

  return (
    <div className={cn(TOKENS.shell, isTerminal && 'font-mono')}>
      <main className='w-full px-3 py-3 sm:px-4 lg:px-5'>
        <div className='mx-auto flex max-w-[1540px] flex-col gap-3'>
          <section
            className={cn(
              TOKENS.panel,
              'grid min-h-[680px] overflow-hidden rounded-lg lg:h-[calc(100dvh-5.75rem)] lg:max-h-[820px] lg:grid-cols-[minmax(0,1fr)_392px]'
            )}
          >
            <div className='min-h-0 min-w-0'>
              {loading ? (
                <InsightSkeleton />
              ) : error ? (
                <InsightError message={error} />
              ) : graph ? (
                <InsightGraphStage
                  graph={graph}
                  stats={graphStats}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={node => {
                    setSelectedNodeId(node.id);
                    setStatus({
                      tone: 'idle',
                      message: `${node.label} selected.`,
                    });
                  }}
                />
              ) : (
                <InsightError message='No graph data available.' />
              )}
            </div>

            <PostInspector
              graph={graph}
              node={selectedNode}
              status={status}
              onSelectNode={node => {
                setSelectedNodeId(node.id);
                setStatus({
                  tone: 'idle',
                  message: `${node.label} selected from related context.`,
                });
              }}
              onOpenPost={openPost}
              onOpenMemo={openMemo}
              onOpenChat={openChat}
              onAddToStack={addNodeToStack}
            />
          </section>

          <StackTray
            items={trayItems}
            selectedNodeId={selectedNodeId}
            onSelect={selectStackItem}
            onRemove={removeTrayItem}
            onClear={clearTray}
          />
        </div>
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
    <div className='rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs tabular-nums text-slate-500 shadow-sm dark:border-border dark:bg-card dark:text-muted-foreground'>
      <span className='font-semibold text-slate-900 dark:text-foreground'>
        {value}
      </span>{' '}
      {label}
    </div>
  );
});

const InsightSkeleton = memo(function InsightSkeleton() {
  return (
    <div className='flex h-full min-h-0 flex-col bg-white dark:bg-card'>
      <div className='flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-border'>
        <div className='h-11 w-32 animate-pulse rounded-lg bg-slate-100 dark:bg-muted' />
        <div className='h-9 w-56 animate-pulse rounded-lg bg-slate-100 dark:bg-muted' />
        <div className='ml-auto h-10 w-64 animate-pulse rounded-lg bg-slate-100 dark:bg-muted' />
      </div>
      <div className='flex min-h-0 flex-1'>
        <div className='hidden w-14 border-r border-slate-200 p-2 dark:border-border sm:block' />
        <div className='relative flex-1 overflow-hidden bg-[#fbfdff] dark:bg-background'>
          <div className='absolute left-[48%] top-[45%] h-24 w-48 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-lg bg-slate-100 dark:bg-muted' />
          {[16, 28, 42, 62, 76, 88].map((left, index) => (
            <div
              key={left}
              className='absolute h-20 w-40 animate-pulse rounded-lg bg-slate-100 dark:bg-muted'
              style={{
                left: `${left}%`,
                top: `${index % 2 === 0 ? 28 : 66}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
          <div className='absolute left-4 top-4 flex items-center gap-2 text-sm text-slate-500 dark:text-muted-foreground'>
            <Loader2 className='h-4 w-4 animate-spin motion-reduce:animate-none' />
            Building graph
          </div>
        </div>
      </div>
    </div>
  );
});

const InsightError = memo(function InsightError({
  message,
}: {
  message: string;
}) {
  return (
    <div className='grid h-full min-h-[680px] place-items-center bg-white p-6 text-center dark:bg-card'>
      <div>
        <X className='mx-auto h-10 w-10 text-destructive' />
        <h2 className='mt-3 text-base font-semibold'>
          Insight graph unavailable
        </h2>
        <p className='mt-1 text-sm text-muted-foreground'>{message}</p>
      </div>
    </div>
  );
});

const InsightGraphStage = memo(function InsightGraphStage({
  graph,
  stats,
  selectedNodeId,
  onSelectNode,
}: {
  graph: InsightGraph;
  stats: { nodes: number; posts: number; connections: number };
  selectedNodeId: string | null;
  onSelectNode: (node: InsightGraphNode) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [focusMode, setFocusMode] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<InsightNodeType>>(
    () => new Set(ALL_NODE_TYPES)
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const nodeById = useMemo(
    () => new Map(graph.nodes.map(node => [node.id, node])),
    [graph.nodes]
  );

  const normalizedQuery = normalizeSearch(searchQuery);
  const focusedNodeIds = useMemo(() => {
    if (!focusMode || !selectedNodeId) return null;
    const ids = new Set([selectedNodeId]);
    graph.edges.forEach(edge => {
      if (edge.source === selectedNodeId) ids.add(edge.target);
      if (edge.target === selectedNodeId) ids.add(edge.source);
    });
    return ids;
  }, [focusMode, graph.edges, selectedNodeId]);

  const visibleNodes = useMemo(
    () =>
      graph.nodes.filter(
        node =>
          (!focusedNodeIds || focusedNodeIds.has(node.id)) &&
          activeTypes.has(node.type) &&
          nodeMatchesQuery(node, normalizedQuery)
      ),
    [activeTypes, focusedNodeIds, graph.nodes, normalizedQuery]
  );

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map(node => node.id)),
    [visibleNodes]
  );

  const visibleEdges = useMemo(
    () =>
      graph.edges.filter(
        edge =>
          visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
      ),
    [graph.edges, visibleNodeIds]
  );

  const toggleFilter = useCallback((types: InsightNodeType[]) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      const active = types.every(type => next.has(type));
      if (active) {
        types.forEach(type => next.delete(type));
      } else {
        types.forEach(type => next.add(type));
      }
      return next.size ? next : prev;
    });
  }, []);

  const resetView = useCallback(() => {
    setSearchQuery('');
    setFocusMode(false);
    setSelectedEdgeId(null);
    setZoom(1);
    setActiveTypes(new Set(ALL_NODE_TYPES));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(value => Math.max(0.75, Number((value - 0.1).toFixed(2))));
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(value => Math.min(1.35, Number((value + 0.1).toFixed(2))));
  }, []);

  return (
    <div className='flex h-full min-h-[680px] flex-col bg-white dark:bg-card'>
      <div className='flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-border'>
        <div className='flex items-center gap-2'>
          <ToolbarIconButton
            active
            icon={MousePointer2}
            label='Select'
            onClick={() => setSelectedEdgeId(null)}
          />
          <ToolbarIconButton
            icon={Command}
            label='Command'
            onClick={() => searchInputRef.current?.focus()}
          />
          <ToolbarIconButton
            icon={Maximize2}
            label='Fit view'
            onClick={resetView}
          />
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {GRAPH_FILTERS.map(filter => {
            const Icon = filter.icon;
            const active = filter.types.every(type => activeTypes.has(type));
            return (
              <button
                key={filter.id}
                type='button'
                className={cn(
                  TOKENS.chip,
                  TOKENS.focus,
                  TOKENS.motion,
                  active
                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:text-foreground'
                )}
                aria-pressed={active}
                onClick={() => toggleFilter(filter.types)}
              >
                <Icon className='h-3.5 w-3.5' />
                {filter.label}
              </button>
            );
          })}
        </div>

        <div className='ml-auto hidden items-center gap-2 text-xs text-slate-500 lg:flex'>
          <StatPill label='Posts' value={stats.posts} />
          <StatPill label='Nodes' value={stats.nodes} />
          <StatPill label='Links' value={stats.connections} />
        </div>

        <div className='relative min-w-[220px] flex-1 lg:max-w-xs lg:flex-none'>
          <label htmlFor='insight-node-search' className='sr-only'>
            Search graph nodes
          </label>
          <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
          <input
            id='insight-node-search'
            ref={searchInputRef}
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder='Search nodes, content, tags...'
            className={cn(
              'h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm dark:border-border dark:bg-background dark:text-foreground',
              TOKENS.focus
            )}
          />
          {searchQuery && (
            <button
              type='button'
              className={cn(
                'absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-muted',
                TOKENS.focus
              )}
              onClick={() => setSearchQuery('')}
              aria-label='Clear graph search'
            >
              <X className='h-3.5 w-3.5' />
            </button>
          )}
        </div>
      </div>

      <div className='flex min-h-[580px] flex-1'>
        <GraphRail
          nodeCount={visibleNodes.length}
          focusMode={focusMode}
          showLegend={showLegend}
          onToggleFocus={() => setFocusMode(value => !value)}
          onShowAll={() => setFocusMode(false)}
          onToggleLegend={() => setShowLegend(value => !value)}
          onReset={resetView}
        />

        <div className='relative flex-1 overflow-hidden bg-[#fbfdff] bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.22)_1px,transparent_0)] [background-size:20px_20px] dark:bg-background dark:bg-[radial-gradient(circle_at_1px_1px,rgba(148,163,184,0.14)_1px,transparent_0)]'>
          <div
            className='absolute inset-0 origin-center transition-transform duration-200 ease-smooth motion-reduce:transition-none'
            style={{ transform: `scale(${zoom})` }}
          >
            <svg
              className='absolute inset-0 h-full w-full'
              viewBox='0 0 100 100'
              preserveAspectRatio='none'
              aria-hidden
            >
              {visibleEdges.map(edge => {
                const source = nodeById.get(edge.source);
                const target = nodeById.get(edge.target);
                if (!source || !target) return null;
                const active =
                  selectedNodeId === source.id ||
                  selectedNodeId === target.id ||
                  selectedEdgeId === edge.id;
                const edgeStyle = EDGE_STYLE[edge.type];
                return (
                  <path
                    key={edge.id}
                    d={buildEdgePath(source, target)}
                    className={cn(
                      'cursor-pointer fill-none transition-opacity duration-200 motion-reduce:transition-none',
                      active ? edgeStyle.activeClassName : edgeStyle.className,
                      active ? 'opacity-90' : 'opacity-40'
                    )}
                    strokeWidth={active ? 0.42 : 0.22}
                    strokeLinecap='round'
                    strokeDasharray={edgeStyle.dash}
                    vectorEffect='non-scaling-stroke'
                    pointerEvents='visibleStroke'
                    onClick={() => setSelectedEdgeId(edge.id)}
                  />
                );
              })}
            </svg>

            {visibleNodes.map(node => (
              <GraphNodeButton
                key={node.id}
                node={node}
                selected={selectedNodeId === node.id}
                onSelect={() => {
                  setSelectedEdgeId(null);
                  onSelectNode(node);
                }}
              />
            ))}
          </div>

          {!visibleNodes.length && (
            <div className='absolute inset-0 grid place-items-center p-6 text-center'>
              <div className='rounded-lg border border-dashed border-slate-300 bg-white/90 p-5 text-sm text-slate-500 shadow-sm dark:border-border dark:bg-card/90 dark:text-muted-foreground'>
                No matching nodes.
              </div>
            </div>
          )}

          <ZoomControls
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={resetView}
          />
          {showLegend && <RelationLegend />}
          <GraphStatusBadge
            visibleNodes={visibleNodes.length}
            visibleEdges={visibleEdges.length}
            focusMode={focusMode}
          />
        </div>
      </div>
    </div>
  );
});

const ToolbarIconButton = memo(function ToolbarIconButton({
  active = false,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  icon: typeof FileText;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      className={cn(
        TOKENS.iconButton,
        TOKENS.focus,
        TOKENS.motion,
        active &&
          'border-blue-200 bg-blue-50 text-blue-600 shadow-blue-500/10 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200'
      )}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon className='h-4.5 w-4.5' />
    </button>
  );
});

const GraphRail = memo(function GraphRail({
  nodeCount,
  focusMode,
  showLegend,
  onToggleFocus,
  onShowAll,
  onToggleLegend,
  onReset,
}: {
  nodeCount: number;
  focusMode: boolean;
  showLegend: boolean;
  onToggleFocus: () => void;
  onShowAll: () => void;
  onToggleLegend: () => void;
  onReset: () => void;
}) {
  return (
    <aside className='hidden w-14 shrink-0 flex-col items-center gap-2 border-r border-slate-200 bg-white/90 p-2 dark:border-border dark:bg-card/90 sm:flex'>
      <ToolbarIconButton
        active={focusMode}
        icon={Crosshair}
        label='Focus selected links'
        onClick={onToggleFocus}
      />
      <ToolbarIconButton
        icon={Network}
        label={`${nodeCount} visible nodes`}
        onClick={onShowAll}
      />
      <ToolbarIconButton
        active={showLegend}
        icon={Layers}
        label='Toggle relation legend'
        onClick={onToggleLegend}
      />
      <ToolbarIconButton
        icon={Settings2}
        label='Clear filters'
        onClick={onReset}
      />
      <ToolbarIconButton
        icon={RotateCcw}
        label='Reset view'
        onClick={onReset}
      />
      <div className='mt-auto rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold tabular-nums text-slate-500 dark:border-border dark:text-muted-foreground'>
        {nodeCount}
      </div>
    </aside>
  );
});

const ZoomControls = memo(function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className='absolute bottom-4 left-4 z-40 flex overflow-hidden rounded-lg border border-slate-200 bg-white/95 text-sm shadow-sm backdrop-blur dark:border-border dark:bg-card/95'>
      <button
        type='button'
        className={cn(
          'grid h-10 w-11 place-items-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-muted',
          TOKENS.focus
        )}
        onClick={onZoomOut}
        aria-label='Zoom out'
      >
        <Minus className='h-4 w-4' />
      </button>
      <button
        type='button'
        className={cn(
          'h-10 min-w-[64px] border-x border-slate-200 px-3 text-xs font-semibold tabular-nums text-slate-600 hover:bg-slate-50 dark:border-border dark:text-muted-foreground dark:hover:bg-muted',
          TOKENS.focus
        )}
        onClick={onReset}
        aria-label='Reset graph view'
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type='button'
        className={cn(
          'grid h-10 w-11 place-items-center text-slate-500 hover:bg-slate-50 hover:text-slate-900 dark:text-muted-foreground dark:hover:bg-muted',
          TOKENS.focus
        )}
        onClick={onZoomIn}
        aria-label='Zoom in'
      >
        <Plus className='h-4 w-4' />
      </button>
    </div>
  );
});

const GraphStatusBadge = memo(function GraphStatusBadge({
  visibleNodes,
  visibleEdges,
  focusMode,
}: {
  visibleNodes: number;
  visibleEdges: number;
  focusMode: boolean;
}) {
  return (
    <div className='absolute bottom-4 right-4 z-40 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs font-medium text-slate-500 shadow-sm backdrop-blur dark:border-border dark:bg-card/95 dark:text-muted-foreground'>
      {visibleNodes} nodes · {visibleEdges} links
      {focusMode && <span className='text-blue-600'> · focused</span>}
    </div>
  );
});

const RelationLegend = memo(function RelationLegend() {
  return (
    <div className='absolute bottom-16 left-4 z-40 hidden w-[210px] rounded-lg border border-slate-200 bg-white/95 p-4 text-xs shadow-sm backdrop-blur dark:border-border dark:bg-card/95 md:block'>
      <h3 className='mb-3 text-sm font-semibold text-slate-900 dark:text-foreground'>
        관계 범례
      </h3>
      <div className='space-y-2.5'>
        {Object.entries(EDGE_STYLE).map(([type, style]) => (
          <div
            key={type}
            className='flex items-center gap-2 text-slate-600 dark:text-muted-foreground'
          >
            <span
              className={cn('h-0.5 w-7 rounded-full', style.legendClassName)}
            />
            <span>{style.label}</span>
          </div>
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
  const badges =
    node.type === 'post' && node.post?.tags?.length
      ? node.post.tags.slice(0, 2)
      : [style.label];
  const sizeClass =
    node.type === 'post'
      ? 'h-[92px] w-[190px] max-w-[48vw]'
      : 'h-[82px] w-[170px] max-w-[44vw]';

  return (
    <button
      type='button'
      onClick={onSelect}
      className={cn(
        'group absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border px-3 py-2.5 text-left shadow-sm outline-none ring-2 ring-transparent',
        TOKENS.focus,
        TOKENS.motion,
        sizeClass,
        style.className,
        selected
          ? cn('z-30 scale-[1.03]', style.selectedClassName)
          : 'z-10 hover:z-20 hover:scale-[1.02] active:scale-[0.98]'
      )}
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
      aria-pressed={selected}
      aria-label={`${style.label}: ${node.label}`}
      title={node.label}
    >
      <div className='flex min-w-0 items-start gap-2.5'>
        <span
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
            style.pillClassName
          )}
        >
          <Icon className='h-4 w-4' />
        </span>
        <span className='min-w-0 flex-1'>
          <span className='block truncate text-sm font-semibold leading-5'>
            {node.label}
          </span>
          <span className='mt-0.5 block truncate text-xs text-slate-500 dark:text-muted-foreground'>
            {getNodeSubtitle(node)}
          </span>
        </span>
      </div>
      <span className='mt-2 flex min-w-0 items-center gap-1.5 overflow-hidden'>
        {badges.map(badge => (
          <span
            key={badge}
            className='max-w-[82px] truncate rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-muted dark:text-muted-foreground'
          >
            {badge}
          </span>
        ))}
      </span>
    </button>
  );
});

const PostInspector = memo(function PostInspector({
  graph,
  node,
  status,
  onSelectNode,
  onOpenPost,
  onOpenMemo,
  onOpenChat,
  onAddToStack,
}: {
  graph: InsightGraph | null;
  node: InsightGraphNode | null;
  status: InsightActionStatus;
  onSelectNode: (node: InsightGraphNode) => void;
  onOpenPost: (post: BlogPost) => void;
  onOpenMemo: (post: BlogPost) => void;
  onOpenChat: (post: BlogPost) => void;
  onAddToStack: (node: InsightGraphNode) => void;
}) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('preview');
  const post = node?.post;
  const nodeStyle = node ? NODE_STYLE[node.type] : NODE_STYLE.post;
  const NodeIcon = nodeStyle.icon;
  const connections = useMemo(
    () => getNodeConnections(graph, node),
    [graph, node]
  );
  const memoNodes = useMemo(() => getNodeMemoNodes(graph, node), [graph, node]);
  const activityItems = useMemo(
    () => getNodeActivityItems(node, connections, memoNodes),
    [connections, memoNodes, node]
  );

  const tabCounts: Partial<Record<InspectorTab, number>> = {
    links: connections.length,
    notes: memoNodes.length,
    activity: activityItems.length,
  };

  return (
    <section className='flex h-[680px] min-h-0 flex-col border-t border-slate-200 bg-white dark:border-border dark:bg-card lg:h-full lg:border-l lg:border-t-0'>
      <div className='flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-border'>
        <div className='flex items-center gap-2'>
          <PanelRight className='h-4 w-4 text-blue-600' />
          <h2 className='text-sm font-semibold'>Post Inspector</h2>
        </div>
        <span className='rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600 dark:bg-blue-950/50 dark:text-blue-200'>
          {node ? NODE_STYLE[node.type].label : 'Post'}
        </span>
      </div>

      {node ? (
        <div className='shrink-0 border-b border-slate-200 px-4 py-4 dark:border-border'>
          <div className='flex items-start gap-3'>
            <span
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                nodeStyle.pillClassName
              )}
            >
              <NodeIcon className='h-5 w-5' />
            </span>
            <div className='min-w-0'>
              <h3 className='line-clamp-2 text-base font-semibold leading-snug text-slate-950 dark:text-foreground'>
                {node.label}
              </h3>
              <p className='mt-1 truncate text-xs text-slate-500 dark:text-muted-foreground'>
                {getNodeSubtitle(node)}
              </p>
            </div>
          </div>

          {!!post?.tags?.length && (
            <div className='mt-3 flex flex-wrap gap-1.5'>
              {post.tags.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  className='rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-muted dark:text-muted-foreground'
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className='grid shrink-0 grid-cols-5 border-b border-slate-200 px-3 dark:border-border'>
        {INSPECTOR_TABS.map(tab => (
          <button
            key={tab.id}
            type='button'
            className={cn(
              'relative min-h-11 px-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-muted-foreground dark:hover:text-foreground',
              activeTab === tab.id && 'text-blue-600 dark:text-blue-300'
            )}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
            {tabCounts[tab.id] != null && (
              <span className='ml-1 tabular-nums'>({tabCounts[tab.id]})</span>
            )}
            {activeTab === tab.id && (
              <span className='absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-blue-600' />
            )}
          </button>
        ))}
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto p-4'>
        <InspectorTabContent
          node={node}
          status={status}
          tab={activeTab}
          connections={connections}
          memoNodes={memoNodes}
          activityItems={activityItems}
          onSelectNode={onSelectNode}
          onAddToStack={onAddToStack}
        />
      </div>

      <div className='shrink-0 border-t border-slate-200 p-3 dark:border-border'>
        <div className='grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-3'>
          <Button
            type='button'
            variant='outline'
            className='min-h-11 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-card dark:text-foreground'
            onClick={() => post && onOpenPost(post)}
            disabled={!post}
          >
            <ExternalLink className='h-4 w-4' />
            Open
          </Button>
          <Button
            type='button'
            variant='outline'
            className='min-h-11 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-card dark:text-foreground'
            onClick={() => post && onOpenMemo(post)}
            disabled={!post}
          >
            <NotebookPen className='h-4 w-4' />
            Memo
          </Button>
          <Button
            type='button'
            variant='outline'
            className='min-h-11 rounded-lg border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-border dark:bg-card dark:text-foreground'
            onClick={() => post && onOpenChat(post)}
            disabled={!post}
          >
            <MessageSquare className='h-4 w-4' />
            AI Chat
          </Button>
        </div>
        <Button
          type='button'
          className='mt-2 min-h-11 w-full rounded-lg bg-blue-600 text-white shadow-blue-500/20 hover:bg-blue-700'
          onClick={() => node && onAddToStack(node)}
          disabled={!node}
        >
          <Plus className='h-4 w-4' />
          Stack
        </Button>
      </div>
    </section>
  );
});

const InspectorTabContent = memo(function InspectorTabContent({
  node,
  status,
  tab,
  connections,
  memoNodes,
  activityItems,
  onSelectNode,
  onAddToStack,
}: {
  node: InsightGraphNode | null;
  status: InsightActionStatus;
  tab: InspectorTab;
  connections: InsightConnection[];
  memoNodes: InsightGraphNode[];
  activityItems: InsightActivityItem[];
  onSelectNode: (node: InsightGraphNode) => void;
  onAddToStack: (node: InsightGraphNode) => void;
}) {
  if (!node) {
    return (
      <div className='grid min-h-[300px] place-items-center rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-border'>
        <div>
          <Network className='mx-auto h-10 w-10 text-slate-300 dark:text-muted-foreground/50' />
          <p className='mt-2 text-sm text-slate-500 dark:text-muted-foreground'>
            No graph node selected.
          </p>
        </div>
      </div>
    );
  }

  if (tab === 'info') {
    return (
      <div className='space-y-3'>
        <InfoRow label='Type' value={NODE_STYLE[node.type].label} />
        <InfoRow label='Post key' value={node.postKey ?? 'Not linked'} />
        <InfoRow label='Category' value={node.post?.category ?? 'None'} />
        <InfoRow label='Date' value={formatPostDate(node.post) ?? 'Unknown'} />
        <InfoRow label='Weight' value={String(node.weight)} />
        <InfoRow label='Links' value={`${connections.length}`} />
        <InfoRow label='Notes' value={`${memoNodes.length}`} />
        {!!node.post?.tags?.length && (
          <div className='rounded-lg border border-slate-200 bg-white p-3 dark:border-border dark:bg-background'>
            <dt className='text-sm font-semibold text-slate-900 dark:text-foreground'>
              Tags
            </dt>
            <dd className='mt-2 flex flex-wrap gap-1.5'>
              {node.post.tags.map(tag => (
                <span
                  key={tag}
                  className='rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-muted dark:text-muted-foreground'
                >
                  {tag}
                </span>
              ))}
            </dd>
          </div>
        )}
      </div>
    );
  }

  if (tab === 'links') {
    return (
      <div className='space-y-3'>
        <div>
          <h3 className='text-sm font-semibold text-slate-900 dark:text-foreground'>
            Connected nodes
          </h3>
          <p className='mt-1 text-xs text-slate-500 dark:text-muted-foreground'>
            실제 edge 데이터를 기준으로 연결된 노드를 표시합니다.
          </p>
        </div>
        {connections.length ? (
          <ul className='space-y-2'>
            {connections.map(connection => (
              <li key={connection.edge.id}>
                <ConnectionCard
                  connection={connection}
                  onSelect={() => onSelectNode(connection.node)}
                  onStack={() => onAddToStack(connection.node)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyInspectorState
            icon={GitBranch}
            message='No linked nodes for this selection.'
          />
        )}
      </div>
    );
  }

  if (tab === 'notes') {
    return (
      <div className='space-y-3'>
        <div>
          <h3 className='text-sm font-semibold text-slate-900 dark:text-foreground'>
            Memos and thoughts
          </h3>
          <p className='mt-1 text-xs text-slate-500 dark:text-muted-foreground'>
            같은 게시물 키에 기록된 메모/생각 노드를 모았습니다.
          </p>
        </div>
        {memoNodes.length ? (
          <ul className='space-y-2'>
            {memoNodes.map(memo => (
              <li key={memo.id}>
                <button
                  type='button'
                  className={cn(
                    'w-full rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-border dark:bg-background dark:hover:bg-emerald-950/20',
                    TOKENS.focus,
                    TOKENS.motion
                  )}
                  onClick={() => onSelectNode(memo)}
                >
                  <div className='flex items-start gap-2'>
                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                        NODE_STYLE[memo.type].pillClassName
                      )}
                    >
                      <NotebookPen className='h-4 w-4' />
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-sm font-semibold text-slate-900 dark:text-foreground'>
                        {memo.label}
                      </span>
                      <span className='mt-1 block text-xs leading-5 text-slate-500 dark:text-muted-foreground'>
                        {memo.detail
                          ? summarizeText(memo.detail, 120)
                          : formatNodeTimestamp(memo.ts)}
                      </span>
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className='rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600 dark:border-border dark:bg-muted/30 dark:text-muted-foreground'>
            {node.detail ||
              node.post?.excerpt ||
              'No notes recorded for this node.'}
          </p>
        )}
      </div>
    );
  }

  if (tab === 'activity') {
    return (
      <div className='space-y-3'>
        <div>
          <h3 className='text-sm font-semibold text-slate-900 dark:text-foreground'>
            Activity timeline
          </h3>
          <p className='mt-1 text-xs text-slate-500 dark:text-muted-foreground'>
            선택, 연결, 메모 이벤트를 시간순 단서로 정리합니다.
          </p>
        </div>
        <ol className='space-y-2'>
          {activityItems.map(item => (
            <li key={item.id} className='relative pl-5'>
              <span
                className={cn(
                  'absolute left-0 top-2 h-2.5 w-2.5 rounded-full',
                  getActivityToneClass(item.tone)
                )}
              />
              <div className='rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-border dark:bg-background'>
                <div className='truncate text-sm font-medium text-slate-900 dark:text-foreground'>
                  {item.title}
                </div>
                <div className='mt-1 text-xs leading-5 text-slate-500 dark:text-muted-foreground'>
                  {item.subtitle}
                </div>
                {item.ts && (
                  <div className='mt-1 text-[11px] text-slate-400'>
                    {formatNodeTimestamp(item.ts)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className='space-y-5'>
      <section>
        <h3 className='text-sm font-semibold text-slate-900 dark:text-foreground'>
          공통 특성
        </h3>
        <ul className='mt-2 space-y-1.5 text-sm leading-6 text-slate-600 dark:text-muted-foreground'>
          {buildInspectorBullets(node).map(bullet => (
            <li key={bullet}>- {bullet}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className='text-sm font-semibold text-slate-900 dark:text-foreground'>
          연관 활동 분석
        </h3>
        <p className='mt-2 text-sm leading-6 text-slate-600 dark:text-muted-foreground'>
          실제 콘텐츠 DNS 쿼리 지연처럼 연결 단서를 모아 표시합니다.
        </p>
        <pre className='mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-700 dark:border-border dark:bg-background dark:text-muted-foreground'>
          {`dig ${node.postKey ?? node.id}.insight.local
;; connected in ${(node.weight * 42).toFixed(0)}ms
;; ${NODE_STYLE[node.type].label} resolver ready`}
        </pre>
      </section>

      <section>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-semibold text-slate-900 dark:text-foreground'>
            관련 메타데이터
          </h3>
          <ChevronDown className='h-4 w-4 text-slate-400' />
        </div>
        <pre className='mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-700 shadow-sm dark:border-border dark:bg-background dark:text-muted-foreground'>
          {buildInspectorYaml(node)}
        </pre>
      </section>

      <div
        className={cn(
          'rounded-lg border px-3 py-2 text-sm',
          statusClasses(status)
        )}
        role='status'
        aria-live='polite'
      >
        {status.message}
      </div>
    </div>
  );
});

function getActivityToneClass(tone: InsightActivityItem['tone']): string {
  if (tone === 'memo' || tone === 'thought') return 'bg-emerald-500';
  if (tone === 'chat') return 'bg-violet-500';
  if (tone === 'tag' || tone === 'activity') return 'bg-sky-500';
  if (tone === 'category') return 'bg-blue-500';
  if (tone === 'search') return 'bg-slate-500';
  if (tone === 'post') return 'bg-blue-500';
  return 'bg-amber-500';
}

const EmptyInspectorState = memo(function EmptyInspectorState({
  icon: Icon,
  message,
}: {
  icon: typeof FileText;
  message: string;
}) {
  return (
    <div className='grid min-h-[140px] place-items-center rounded-lg border border-dashed border-slate-200 p-4 text-center dark:border-border'>
      <div>
        <Icon className='mx-auto h-8 w-8 text-slate-300 dark:text-muted-foreground/50' />
        <p className='mt-2 text-sm text-slate-500 dark:text-muted-foreground'>
          {message}
        </p>
      </div>
    </div>
  );
});

const ConnectionCard = memo(function ConnectionCard({
  connection,
  onSelect,
  onStack,
}: {
  connection: InsightConnection;
  onSelect: () => void;
  onStack: () => void;
}) {
  const nodeStyle = NODE_STYLE[connection.node.type];
  const Icon = nodeStyle.icon;
  const edgeStyle = EDGE_STYLE[connection.edge.type];

  return (
    <div className='rounded-lg border border-slate-200 bg-white p-3 dark:border-border dark:bg-background'>
      <div className='flex items-start gap-2.5'>
        <span
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
            nodeStyle.pillClassName
          )}
        >
          <Icon className='h-4 w-4' />
        </span>
        <div className='min-w-0 flex-1'>
          <div className='flex min-w-0 items-center gap-2'>
            <span className='truncate text-sm font-semibold text-slate-900 dark:text-foreground'>
              {connection.node.label}
            </span>
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                edgeStyle.legendClassName
              )}
            />
          </div>
          <div className='mt-1 truncate text-xs text-slate-500 dark:text-muted-foreground'>
            {connection.direction === 'incoming' ? 'Incoming' : 'Outgoing'} ·{' '}
            {getEdgeLabel(connection.edge.type)} ·{' '}
            {getNodeSubtitle(connection.node)}
          </div>
        </div>
      </div>
      <div className='mt-3 grid grid-cols-2 gap-2'>
        <Button
          type='button'
          variant='outline'
          className='h-9 rounded-lg border-slate-200 bg-white text-xs dark:border-border dark:bg-card'
          onClick={onSelect}
        >
          <Crosshair className='h-3.5 w-3.5' />
          Focus
        </Button>
        <Button
          type='button'
          variant='outline'
          className='h-9 rounded-lg border-slate-200 bg-white text-xs dark:border-border dark:bg-card'
          onClick={onStack}
        >
          <Plus className='h-3.5 w-3.5' />
          Stack
        </Button>
      </div>
    </div>
  );
});

const InfoRow = memo(function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className='grid grid-cols-[94px_minmax(0,1fr)] gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-border dark:bg-muted/30'>
      <dt className='text-slate-500 dark:text-muted-foreground'>{label}</dt>
      <dd className='truncate font-medium text-slate-800 dark:text-foreground'>
        {value}
      </dd>
    </div>
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
  const [view, setView] = useState<'recent' | 'pinned' | 'all'>('recent');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [expanded, setExpanded] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() =>
    typeof window === 'undefined' ? new Set() : readPinnedStackIds()
  );

  useEffect(() => {
    writePinnedStackIds(pinnedIds);
  }, [pinnedIds]);

  const pinnedItems = useMemo(
    () => items.filter(item => pinnedIds.has(item.id)),
    [items, pinnedIds]
  );

  const displayedItems = useMemo(() => {
    if (view === 'pinned') return pinnedItems;
    if (view === 'all') return items;
    return expanded ? items : items.slice(0, 5);
  }, [expanded, items, pinnedItems, view]);

  const togglePinned = useCallback((id: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const pinSelected = useCallback(() => {
    const selectedItem = items.find(item => item.nodeId === selectedNodeId);
    const fallbackItem = items[0];
    const target = selectedItem ?? fallbackItem;
    if (!target) return;
    setPinnedIds(prev => {
      const next = new Set(prev);
      next.add(target.id);
      return next;
    });
    setView('pinned');
  }, [items, selectedNodeId]);

  return (
    <section className={cn(TOKENS.panel, 'overflow-hidden rounded-lg')}>
      <div className='flex flex-wrap items-center justify-between gap-3 px-4 py-3'>
        <div className='flex items-center gap-3'>
          <div>
            <div className='flex items-center gap-2'>
              <h2 className='text-base font-semibold'>Stack Tray</h2>
              <span className='rounded-lg bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-muted dark:text-muted-foreground'>
                {items.length} items
              </span>
            </div>
          </div>
          <div className='hidden items-center gap-1 rounded-lg bg-slate-50 p-1 dark:bg-muted/30 sm:flex'>
            {(['recent', 'pinned', 'all'] as const).map(tab => (
              <button
                key={tab}
                type='button'
                className={cn(
                  'min-h-9 rounded-lg px-3 text-sm font-medium capitalize text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-muted-foreground dark:hover:text-foreground',
                  view === tab &&
                    'bg-white text-blue-600 shadow-sm dark:bg-card dark:text-blue-300'
                )}
                onClick={() => setView(tab)}
                aria-pressed={view === tab}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className='flex items-center gap-2'>
          <ToolbarIconButton
            active={layout === 'grid'}
            icon={layout === 'grid' ? Grid2X2 : List}
            label='Toggle stack layout'
            onClick={() =>
              setLayout(current => (current === 'grid' ? 'list' : 'grid'))
            }
          />
          <ToolbarIconButton
            active={expanded}
            icon={Maximize2}
            label='Show more stack items'
            onClick={() => setExpanded(value => !value)}
          />
          <ToolbarIconButton
            icon={Check}
            label='Pin selected stack item'
            onClick={pinSelected}
          />
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-11 w-11 rounded-lg text-slate-500 hover:bg-destructive/10 hover:text-destructive'
            onClick={onClear}
            disabled={!items.length}
            aria-label='Clear stack tray'
          >
            <Trash2 className='h-4 w-4' />
          </Button>
        </div>
      </div>

      <div className='border-t border-slate-200 px-4 pb-4 pt-3 dark:border-border'>
        <div className='mb-3 flex items-center gap-1 rounded-lg bg-slate-50 p-1 dark:bg-muted/30 sm:hidden'>
          {(['recent', 'pinned', 'all'] as const).map(tab => (
            <button
              key={tab}
              type='button'
              className={cn(
                'min-h-9 flex-1 rounded-lg px-3 text-sm font-medium capitalize text-slate-500',
                view === tab &&
                  'bg-white text-blue-600 shadow-sm dark:bg-card dark:text-blue-300'
              )}
              onClick={() => setView(tab)}
              aria-pressed={view === tab}
            >
              {tab}
            </button>
          ))}
        </div>

        {displayedItems.length ? (
          <ul
            className={cn(
              layout === 'grid'
                ? 'flex gap-3 overflow-x-auto pb-1'
                : 'grid grid-cols-1 gap-2 pb-1 md:grid-cols-2'
            )}
          >
            {displayedItems.map(item => {
              const active = item.nodeId === selectedNodeId;
              const pinned = pinnedIds.has(item.id);
              return (
                <li
                  key={item.id}
                  className={cn(
                    layout === 'grid'
                      ? 'min-w-[220px] flex-1 md:min-w-[260px]'
                      : 'min-w-0'
                  )}
                >
                  <div
                    className={cn(
                      'group relative flex h-[118px] flex-col rounded-lg border p-3',
                      TOKENS.motion,
                      active
                        ? 'border-blue-300 bg-blue-50 shadow-blue-500/10 dark:border-blue-900 dark:bg-blue-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-border dark:bg-card dark:hover:bg-muted/30'
                    )}
                  >
                    <button
                      type='button'
                      className={cn(
                        'min-h-11 min-w-0 pr-8 text-left',
                        TOKENS.focus
                      )}
                      onClick={() => onSelect(item)}
                    >
                      <div className='flex items-center gap-2'>
                        <StackKindIcon kind={item.kind} />
                        <span className='truncate text-sm font-semibold text-slate-900 dark:text-foreground'>
                          {item.title}
                        </span>
                        {active && (
                          <Check className='h-3.5 w-3.5 text-blue-600' />
                        )}
                      </div>
                      {item.subtitle && (
                        <div className='mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-muted-foreground'>
                          <Calendar className='h-3.5 w-3.5' />
                          <span className='truncate'>{item.subtitle}</span>
                        </div>
                      )}
                    </button>
                    <button
                      type='button'
                      className={cn(
                        'absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-destructive/10 hover:text-destructive',
                        TOKENS.focus,
                        TOKENS.motion
                      )}
                      onClick={() => onRemove(item.id)}
                      aria-label={`Remove ${item.title} from stack`}
                    >
                      <X className='h-4 w-4' />
                    </button>
                    <div className='mt-auto flex flex-wrap gap-1.5'>
                      <span className='rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-muted dark:text-muted-foreground'>
                        {item.kind}
                      </span>
                      {pinned && (
                        <span className='rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-200'>
                          pinned
                        </span>
                      )}
                      {item.postKey && (
                        <span className='max-w-[120px] truncate rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-muted dark:text-muted-foreground'>
                          {item.postKey}
                        </span>
                      )}
                    </div>
                    <button
                      type='button'
                      className={cn(
                        'absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30',
                        pinned && 'text-blue-600',
                        TOKENS.focus,
                        TOKENS.motion
                      )}
                      onClick={() => togglePinned(item.id)}
                      aria-pressed={pinned}
                      aria-label={`${pinned ? 'Unpin' : 'Pin'} ${item.title}`}
                    >
                      <Bookmark className='h-4 w-4' />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className='grid min-h-[118px] place-items-center rounded-lg border border-dashed border-slate-200 p-4 text-center dark:border-border'>
            <div>
              <LayoutGrid className='mx-auto h-9 w-9 text-slate-300 dark:text-muted-foreground/50' />
              <p className='mt-2 text-sm text-slate-500 dark:text-muted-foreground'>
                Stack tray is empty.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
});

function StackKindIcon({ kind }: { kind: InsightWorkspaceItemKind }) {
  const nodeType: InsightNodeType =
    kind === 'chat'
      ? 'chat'
      : kind === 'memo'
        ? 'memo'
        : kind === 'thought'
          ? 'thought'
          : 'post';
  const style = NODE_STYLE[nodeType];
  const Icon = style.icon;

  return (
    <span
      className={cn(
        'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
        style.pillClassName
      )}
    >
      <Icon className='h-4 w-4' />
    </span>
  );
}
