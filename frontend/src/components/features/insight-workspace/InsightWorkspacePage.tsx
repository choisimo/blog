import { memo, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bookmark, Bot, Calendar, Check, ChevronDown, Crosshair, ExternalLink, FileText, GitBranch, LayoutGrid, Loader2, MessageSquare, Network, NotebookPen, PanelRight, Plus, Search, Sparkles, Tag, X } from 'lucide-react';

import { InsightExplorer } from './InsightExplorer';
import { ActionButton } from '@/components/ui/action-button';
import { ActionToolbar } from '@/components/ui/action-toolbar';
import { PaneSwitcher, WorkspacePanel } from '@/components/organisms/layout';
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
import {
  normalizeInsightWorkspaceItem,
  normalizePinnedStackIds,
} from './storageGuards';

const STACK_STORAGE_KEY = 'insight.workspace.stack.v1';
const PINNED_STACK_STORAGE_KEY = 'insight.workspace.stack.pinned.v1';
const MAX_STACK_ITEMS = 8;
const INSIGHT_ANSI_ESCAPE_PATTERN =
  /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;
const INSIGHT_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const INSIGHT_WHITESPACE_PATTERN = /\s+/g;
const MAX_INSIGHT_LINE_CHARS = 500;

export function normalizeInsightWorkspaceLine(
  value: unknown,
  fallback = '',
  maxLength = MAX_INSIGHT_LINE_CHARS
): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const normalized = String(value)
    .replace(INSIGHT_ANSI_ESCAPE_PATTERN, '')
    .replace(INSIGHT_LINE_CONTROL_PATTERN, ' ')
    .replace(INSIGHT_WHITESPACE_PATTERN, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
  return normalized || fallback;
}

const TOKENS = {
  shell: 'ui-workspace ui-insight-workspace',
  panel: 'ui-insight-surface',
  elevated: 'ui-insight-overlay',
  focus: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-2',
  motion: 'transition-[opacity,border-color,background-color,color] duration-150 motion-reduce:transition-none',
  iconButton: 'ui-insight-icon-button',
  chip: 'ui-insight-chip',
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
    className: 'ui-graph-node-surface',
    selectedClassName: 'ui-graph-node-selected',
    pillClassName: 'ui-node-kind',
    dotClassName: 'ui-node-dot',
  },
  chat: {
    icon: Bot,
    label: 'AI Chat',
    className: 'ui-graph-node-surface',
    selectedClassName: 'ui-graph-node-selected',
    pillClassName: 'ui-node-kind',
    dotClassName: 'ui-node-dot',
  },
  memo: {
    icon: NotebookPen,
    label: 'Memo',
    className: 'ui-graph-node-surface',
    selectedClassName: 'ui-graph-node-selected',
    pillClassName: 'ui-node-kind',
    dotClassName: 'ui-node-dot',
  },
  thought: {
    icon: Sparkles,
    label: 'Thought',
    className: 'ui-graph-node-surface',
    selectedClassName: 'ui-graph-node-selected',
    pillClassName: 'ui-node-kind',
    dotClassName: 'ui-node-dot',
  },
  tag: {
    icon: Tag,
    label: 'Tag',
    className: 'ui-graph-node-surface',
    selectedClassName: 'ui-graph-node-selected',
    pillClassName: 'ui-node-kind',
    dotClassName: 'ui-node-dot',
  },
  search: {
    icon: Search,
    label: 'Search',
    className: 'ui-graph-node-surface',
    selectedClassName: 'ui-graph-node-selected',
    pillClassName: 'ui-node-kind',
    dotClassName: 'ui-node-dot',
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
    label: '같은 카테고리',
    className: 'ui-edge',
    activeClassName: 'ui-edge-active',
    legendClassName: 'ui-edge-legend',
  },
  tag: {
    label: '공통 태그',
    className: 'ui-edge',
    activeClassName: 'ui-edge-active',
    legendClassName: 'ui-edge-legend',
    dash: '4 5',
  },
  activity: {
    label: '활동 연결',
    className: 'ui-edge',
    activeClassName: 'ui-edge-active',
    legendClassName: 'ui-edge-legend',
    dash: '2 5',
  },
  chat: {
    label: '연결 (Linked)',
    className: 'ui-edge',
    activeClassName: 'ui-edge-active',
    legendClassName: 'ui-edge-legend',
    dash: '5 4',
  },
  memo: {
    label: '방문 노트',
    className: 'ui-edge',
    activeClassName: 'ui-edge-active',
    legendClassName: 'ui-edge-legend',
    dash: '6 4',
  },
  thought: {
    label: '방문 흐름',
    className: 'ui-edge',
    activeClassName: 'ui-edge-active',
    legendClassName: 'ui-edge-legend',
    dash: '1 5',
  },
};

type InspectorTab = 'preview' | 'info' | 'links' | 'notes' | 'activity';

const INSPECTOR_TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: 'preview', label: '내용' },
  { id: 'info', label: '정보' },
  { id: 'links', label: '연결' },
  { id: 'notes', label: '메모' },
  { id: 'activity', label: '기록' },
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
    return parsed.flatMap(item => {
      const normalized = normalizeInsightWorkspaceItem(item);
      return normalized ? [normalized] : [];
    });
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
    return new Set(normalizePinnedStackIds(parsed));
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
  if (Number.isNaN(parsed.getTime())) {
    return normalizeInsightWorkspaceLine(post.date) || null;
  }
  return parsed.toLocaleDateString();
}

function getNodeSubtitle(node: InsightGraphNode): string {
  if (node.type === 'post') {
    const date = formatPostDate(node.post);
    return [
      normalizeInsightWorkspaceLine(node.post?.category),
      date,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (node.postKey) return normalizeInsightWorkspaceLine(node.postKey);
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
  const item = {
    id: `${node.type}:${node.id}`,
    nodeId: node.id,
    kind: getStackKind(node),
    title: normalizeInsightWorkspaceLine(node.label, NODE_STYLE[node.type].label),
    subtitle: getNodeSubtitle(node),
    postKey: node.postKey,
    createdAt: Date.now(),
  };
  return normalizeInsightWorkspaceItem(item) ?? item;
}

export function buildChatInitialMessage(post: BlogPost): string {
  const title = normalizeInsightWorkspaceLine(post.title, 'Untitled post');
  const year = normalizeInsightWorkspaceLine(post.year, 'unknown');
  const slug = normalizeInsightWorkspaceLine(post.slug, 'unknown');
  return [
    `${title} 글을 기준으로 핵심 인사이트를 3가지로 요약해줘.`,
    '',
    `게시물: ${year}/${slug}`,
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

export function normalizeSearch(value: string) {
  return normalizeInsightWorkspaceLine(value, '', 200).toLowerCase();
}

export function summarizeText(value: string | undefined, maxLength = 128) {
  const compact = normalizeInsightWorkspaceLine(value, '', 5000);
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}

function buildInspectorBullets(node: InsightGraphNode) {
  const category = normalizeInsightWorkspaceLine(node.post?.category);
  const tags = (node.post?.tags ?? [])
    .map(tag => normalizeInsightWorkspaceLine(tag))
    .filter(Boolean)
    .slice(0, 3);
  const bullets = [
    category ? `${category} 카테고리의 핵심 노드` : null,
    tags.length
      ? `${tags.join(', ')} 태그와 연결`
      : null,
    node.detail ? summarizeText(node.detail, 86) : null,
    node.post?.excerpt ? summarizeText(node.post.excerpt, 96) : null,
  ].filter(Boolean);

  return bullets.length
    ? (bullets as string[])
    : [`${NODE_STYLE[node.type].label} 노드의 연결 정보를 표시합니다.`];
}

export function buildInspectorYaml(node: InsightGraphNode) {
  const kind = NODE_STYLE[node.type].label.replace(/\s+/g, '');
  const id = normalizeInsightWorkspaceLine(node.id, 'unknown');
  const postKey = normalizeInsightWorkspaceLine(node.postKey, 'none');
  const weight = Number.isFinite(node.weight) ? node.weight : 0;
  return [
    'apiVersion: insight/v1',
    `kind: ${kind}`,
    'metadata:',
    `  name: ${id}`,
    `  postKey: ${postKey}`,
    `  weight: ${weight}`,
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
            err instanceof Error
              ? normalizeInsightWorkspaceLine(
                  err.message,
                  'Failed to load insight graph'
                )
              : 'Failed to load insight graph'
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
  const [mobilePane, setMobilePane] = useState<'graph' | 'inspector'>('graph');
  const switchPane = useCallback((pane: 'graph' | 'inspector') => {
    setMobilePane(pane);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      window.requestAnimationFrame(() => document.getElementById(`insight-${pane}-pane`)?.focus());
    }
  }, []);
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
      if (window.matchMedia('(max-width: 767px)').matches) return;
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
      message: `${normalizeInsightWorkspaceLine(node.label, 'Node')} added to the insight stack.`,
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
        message: `Memo opened for ${normalizeInsightWorkspaceLine(postKey)}.`,
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
      message: `AI chat opened with ${normalizeInsightWorkspaceLine(post.year, 'unknown')}/${normalizeInsightWorkspaceLine(post.slug, 'unknown')} context.`,
    });
  }, []);

  const selectStackItem = useCallback(
    (item: InsightWorkspaceItem) => {
      const targetNodeId = findPostNodeForItem(graph, item);
      if (targetNodeId) {
        setSelectedNodeId(targetNodeId);
        switchPane('inspector');
      }
    },
    [graph, switchPane]
  );

  return (
    <div className={cn(TOKENS.shell, 'fn-insight-shell', isTerminal && 'font-mono')} data-ui-page='insight' data-active-pane={mobilePane}>
      <div className="ui-insight-container">
        <header className="ui-workspace-heading">
          <div><p className="ui-eyebrow">INSIGHT / CONNECTED NOTES</p><h1>Insight</h1></div>
          <div className="ui-workspace-context" role='status' aria-live='polite'>
            {loading ? '자료를 불러오는 중' : error ? '자료를 불러오지 못함' : `${graphStats.nodes}개 항목 · ${graphStats.connections}개 연결`}
          </div>
        </header>
        <PaneSwitcher label='Insight 작업 영역' value={mobilePane} onChange={switchPane}
          options={[{ id: 'graph', label: '자료 탐색', controls: 'insight-graph-pane' },
                    { id: 'inspector', label: '선택 항목', controls: 'insight-inspector-pane' }]} />
        <div className="ui-insight-sections">
          <section
            className={cn(
              TOKENS.panel,
              'ui-insight-layout fn-insight-panel'
            )}
          >
            <div className="ui-insight-graph-pane" id='insight-graph-pane' role='region' aria-label='지식 그래프' tabIndex={-1}>
              {loading ? (
                <InsightSkeleton />
              ) : error ? (
                <InsightError message={error} />
              ) : graph ? (
                <InsightExplorer
                  graph={graph}
                  selectedNodeId={selectedNodeId}
                  onSelectNode={node => {
                    setSelectedNodeId(node.id);
                    switchPane('inspector');
                    setStatus({
                      tone: 'idle',
                      message: `${normalizeInsightWorkspaceLine(node.label, 'Node')} selected.`,
                    });
                  }}
                />
              ) : (
                <InsightError message='No graph data available.' />
              )}
            </div>

            <div className="ui-insight-inspector-pane" id='insight-inspector-pane' role='region' aria-label='선택 항목 상세' tabIndex={-1}>
            <PostInspector
              graph={graph}
              node={selectedNode}
              status={status}
              onSelectNode={node => {
                setSelectedNodeId(node.id);
                setStatus({
                  tone: 'idle',
                  message: `${normalizeInsightWorkspaceLine(node.label, 'Node')} selected from related context.`,
                });
              }}
              onOpenPost={openPost}
              onOpenMemo={openMemo}
              onOpenChat={openChat}
              onAddToStack={addNodeToStack}
            />
            </div>
          </section>

          <details className="ui-insight-stack-disclosure"><summary>보관함 <span>{trayItems.length}개 · 열어서 확인</span></summary>
          <StackTray
            items={trayItems}
            selectedNodeId={selectedNodeId}
            onSelect={selectStackItem}
            onRemove={removeTrayItem}
            onClear={clearTray}
          />
          </details>
        </div>
      </div>

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

const InsightSkeleton = memo(function InsightSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-ui-surface dark:bg-card">
      <div className="ui-graph-toolbar">
        <div className="h-11 w-32 animate-pulse rounded-lg bg-ui-soft dark:bg-muted" />
        <div className="h-9 w-56 animate-pulse rounded-lg bg-ui-soft dark:bg-muted" />
        <div className="ml-auto h-10 w-64 animate-pulse rounded-lg bg-ui-soft dark:bg-muted" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-14 border-r border-ui-line p-2 dark:border-border sm:block" />
        <div className="relative flex-1 overflow-hidden bg-ui-canvas dark:bg-background">
          <div className="absolute left-[48%] top-[45%] h-24 w-48 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-lg bg-ui-soft dark:bg-muted" />
          {[16, 28, 42, 62, 76, 88].map((left, index) => (
            <div
              key={left}
              className="absolute h-20 w-40 animate-pulse rounded-lg bg-ui-soft dark:bg-muted"
              style={{
                left: `${left}%`,
                top: `${index % 2 === 0 ? 28 : 66}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
          <div className="absolute left-4 top-4 flex items-center gap-2 text-sm text-ui-muted dark:text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
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
    <div className="ui-insight-empty" role='status'>
      <div>
        <X className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 text-base font-semibold">
          Insight graph unavailable
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
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
    <section className="ui-insight-inspector">
      <div className="flex shrink-0 items-center justify-between border-b border-ui-line px-4 py-3 dark:border-border">
        <div className="flex items-center gap-2">
          <PanelRight className="h-4 w-4 text-ui-accent" />
          <h2 className="text-sm font-semibold">선택 항목</h2>
        </div>
        <span className="rounded-lg bg-ui-accent-soft px-2.5 py-1 text-xs font-medium text-ui-accent dark:bg-ui-accent-soft dark:text-ui-accent">
          {node ? NODE_STYLE[node.type].label : 'Post'}
        </span>
      </div>

      {node ? (
        <div className="shrink-0 border-b border-ui-line px-4 py-4 dark:border-border">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                nodeStyle.pillClassName
              )}
            >
              <NodeIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="ui-insight-selected-title">
                {node.label}
              </h3>
              <p className="ui-insight-selected-subtitle">
                {getNodeSubtitle(node)}
              </p>
            </div>
          </div>

          {!!post?.tags?.length && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.tags.slice(0, 4).map(tag => (
                <span
                  key={tag}
                  className="rounded-lg bg-ui-soft px-2.5 py-1 text-xs font-medium text-ui-muted dark:bg-muted dark:text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}

      <div className="ui-insight-inspector-tabs">
        {INSPECTOR_TABS.map(tab => (
          <button
            key={tab.id}
            type='button'
            className={cn(
              "relative min-h-11 px-1 text-xs font-medium text-ui-muted transition-colors hover:text-ui-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-accent dark:text-muted-foreground dark:hover:text-foreground",
              activeTab === tab.id && 'text-ui-accent dark:text-ui-accent'
            )}
            onClick={() => setActiveTab(tab.id)}
            aria-pressed={activeTab === tab.id}
          >
            {tab.label}
            {tabCounts[tab.id] != null && (
              <span className="ml-1 tabular-nums">({tabCounts[tab.id]})</span>
            )}
            {activeTab === tab.id && (
              <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ui-accent" />
            )}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
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

      <div className="shrink-0 border-t border-ui-line p-3 dark:border-border">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-3">
          <Button data-ui-variant='outline'
            type='button'
            variant='outline'
            className="ui-control min-h-11 rounded-lg border-ui-line bg-ui-surface text-ui-text hover:bg-ui-soft dark:border-border dark:bg-card dark:text-foreground"
            onClick={() => post && onOpenPost(post)}
            disabled={!post}
          >
            <ExternalLink className="h-4 w-4" />
            Open
          </Button>
          <Button data-ui-variant='outline'
            type='button'
            variant='outline'
            className="ui-control min-h-11 rounded-lg border-ui-line bg-ui-surface text-ui-text hover:bg-ui-soft dark:border-border dark:bg-card dark:text-foreground"
            onClick={() => post && onOpenMemo(post)}
            disabled={!post}
          >
            <NotebookPen className="h-4 w-4" />
            Memo
          </Button>
          <Button data-ui-variant='outline'
            type='button'
            variant='outline'
            className="ui-control min-h-11 rounded-lg border-ui-line bg-ui-surface text-ui-text hover:bg-ui-soft dark:border-border dark:bg-card dark:text-foreground"
            onClick={() => post && onOpenChat(post)}
            disabled={!post}
          >
            <MessageSquare className="h-4 w-4" />
            AI Chat
          </Button>
        </div>
        <Button data-ui-variant="default"
          type='button'
          className="ui-control mt-2 min-h-11 w-full rounded-lg bg-ui-accent text-[hsl(var(--ui-on-accent))] shadow-none hover:bg-ui-accent/90"
          onClick={() => node && onAddToStack(node)}
          disabled={!node}
        >
          <Plus className="h-4 w-4" />
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
      <div className="grid min-h-[300px] place-items-center rounded-lg border border-dashed border-ui-line p-6 text-center dark:border-border">
        <div>
          <Network className="mx-auto h-10 w-10 text-ui-muted dark:text-muted-foreground/50" />
          <p className="mt-2 text-sm text-ui-muted dark:text-muted-foreground">
            No graph node selected.
          </p>
        </div>
      </div>
    );
  }

  if (tab === 'info') {
    return (
      <div className="space-y-3">
        <InfoRow label='Type' value={NODE_STYLE[node.type].label} />
        <InfoRow label='Post key' value={node.postKey ?? 'Not linked'} />
        <InfoRow label='Category' value={node.post?.category ?? 'None'} />
        <InfoRow label='Date' value={formatPostDate(node.post) ?? 'Unknown'} />
        <InfoRow label='Weight' value={String(node.weight)} />
        <InfoRow label='Links' value={`${connections.length}`} />
        <InfoRow label='Notes' value={`${memoNodes.length}`} />
        {!!node.post?.tags?.length && (
          <div className="rounded-lg border border-ui-line bg-ui-surface p-3 dark:border-border dark:bg-background">
            <dt className="text-sm font-semibold text-ui-text dark:text-foreground">
              Tags
            </dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {node.post.tags.map(tag => (
                <span
                  key={tag}
                  className="rounded-md bg-ui-soft px-2 py-1 text-xs font-medium text-ui-muted dark:bg-muted dark:text-muted-foreground"
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
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ui-text dark:text-foreground">
            Connected nodes
          </h3>
          <p className="mt-1 text-xs text-ui-muted dark:text-muted-foreground">
            실제 edge 데이터를 기준으로 연결된 노드를 표시합니다.
          </p>
        </div>
        {connections.length ? (
          <ul className="space-y-2">
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
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ui-text dark:text-foreground">
            Memos and thoughts
          </h3>
          <p className="mt-1 text-xs text-ui-muted dark:text-muted-foreground">
            같은 게시물 키에 기록된 메모/생각 노드를 모았습니다.
          </p>
        </div>
        {memoNodes.length ? (
          <ul className="space-y-2">
            {memoNodes.map(memo => (
              <li key={memo.id}>
                <button
                  type='button'
                  className={cn(
                    "w-full rounded-lg border border-ui-line bg-ui-surface p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/60 dark:border-border dark:bg-background dark:hover:bg-emerald-950/20",
                    TOKENS.focus,
                    TOKENS.motion
                  )}
                  onClick={() => onSelectNode(memo)}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                        NODE_STYLE[memo.type].pillClassName
                      )}
                    >
                      <NotebookPen className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ui-text dark:text-foreground">
                        {memo.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-ui-muted dark:text-muted-foreground">
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
          <p className="rounded-lg border border-ui-line bg-ui-soft p-3 text-sm leading-6 text-ui-muted dark:border-border dark:bg-muted/30 dark:text-muted-foreground">
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
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ui-text dark:text-foreground">
            Activity timeline
          </h3>
          <p className="mt-1 text-xs text-ui-muted dark:text-muted-foreground">
            선택, 연결, 메모 이벤트를 시간순 단서로 정리합니다.
          </p>
        </div>
        <ol className="space-y-2">
          {activityItems.map(item => (
            <li key={item.id} className="relative pl-5">
              <span
                className={cn(
                  'absolute left-0 top-2 h-2.5 w-2.5 rounded-full',
                  getActivityToneClass(item.tone)
                )}
              />
              <div className="rounded-lg border border-ui-line bg-ui-surface px-3 py-2 dark:border-border dark:bg-background">
                <div className="truncate text-sm font-medium text-ui-text dark:text-foreground">
                  {item.title}
                </div>
                <div className="mt-1 text-xs leading-5 text-ui-muted dark:text-muted-foreground">
                  {item.subtitle}
                </div>
                {item.ts && (
                  <div className="mt-1 text-[11px] text-ui-muted">
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
    <div className="space-y-5">
      <section>
        <h3 className="text-sm font-semibold text-ui-text dark:text-foreground">
          공통 특성
        </h3>
        <ul className="mt-2 space-y-1.5 text-sm leading-6 text-ui-muted dark:text-muted-foreground">
          {buildInspectorBullets(node).map(bullet => (
            <li key={bullet}>- {bullet}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-ui-text dark:text-foreground">
          연관 활동 분석
        </h3>
        <p className="mt-2 text-sm leading-6 text-ui-muted dark:text-muted-foreground">
          실제 콘텐츠 DNS 쿼리 지연처럼 연결 단서를 모아 표시합니다.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-ui-line bg-ui-soft p-3 text-xs leading-6 text-ui-text dark:border-border dark:bg-background dark:text-muted-foreground">
          {`dig ${node.postKey ?? node.id}.insight.local
;; connected in ${(node.weight * 42).toFixed(0)}ms
;; ${NODE_STYLE[node.type].label} resolver ready`}
        </pre>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ui-text dark:text-foreground">
            관련 메타데이터
          </h3>
          <ChevronDown className="h-4 w-4 text-ui-muted" />
        </div>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-ui-line bg-ui-surface p-3 text-xs leading-6 text-ui-text dark:border-border dark:bg-background dark:text-muted-foreground">
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
  if (tone === 'category') return 'bg-ui-accent';
  if (tone === 'search') return 'bg-slate-500';
  if (tone === 'post') return 'bg-ui-accent';
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
    <div className="grid min-h-[140px] place-items-center rounded-lg border border-dashed border-ui-line p-4 text-center dark:border-border">
      <div>
        <Icon className="mx-auto h-8 w-8 text-ui-muted dark:text-muted-foreground/50" />
        <p className="mt-2 text-sm text-ui-muted dark:text-muted-foreground">
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
    <div className="rounded-lg border border-ui-line bg-ui-surface p-3 dark:border-border dark:bg-background">
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            'grid h-8 w-8 shrink-0 place-items-center rounded-lg',
            nodeStyle.pillClassName
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-semibold text-ui-text dark:text-foreground">
              {connection.node.label}
            </span>
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                edgeStyle.legendClassName
              )}
            />
          </div>
          <div className="ui-insight-selected-subtitle">
            {connection.direction === 'incoming' ? 'Incoming' : 'Outgoing'} ·{' '}
            {getEdgeLabel(connection.edge.type)} ·{' '}
            {getNodeSubtitle(connection.node)}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button data-ui-variant='outline'
          type='button'
          variant='outline'
          className="ui-control h-9 rounded-lg border-ui-line bg-ui-surface text-xs dark:border-border dark:bg-card"
          onClick={onSelect}
        >
          <Crosshair className="h-3.5 w-3.5" />
          Focus
        </Button>
        <Button data-ui-variant='outline'
          type='button'
          variant='outline'
          className="ui-control h-9 rounded-lg border-ui-line bg-ui-surface text-xs dark:border-border dark:bg-card"
          onClick={onStack}
        >
          <Plus className="h-3.5 w-3.5" />
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
    <div className="grid grid-cols-[94px_minmax(0,1fr)] gap-3 rounded-lg border border-ui-line bg-ui-soft px-3 py-2 text-sm dark:border-border dark:bg-muted/30">
      <dt className="text-ui-muted dark:text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium text-ui-text dark:text-foreground">
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
  const stackId = useId();
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
    <WorkspacePanel id={`${stackId}-panel`} title="작업 목록"
      description={`${items.length}개 항목 · 목록을 비워도 원본 글·메모·대화는 삭제되지 않습니다.`}
      className={cn(TOKENS.panel, 'overflow-hidden rounded-lg')}
      actions={<ActionToolbar label="작업 목록 도구">
        <ActionButton action="stackGrid" iconOnly pressed={layout === 'grid'}
          onClick={() => setLayout(current => (current === 'grid' ? 'list' : 'grid'))} />
        <ActionButton action="expandStack" iconOnly expanded={expanded} controls={`${stackId}-items`}
          disabled={view !== 'recent' || items.length <= 5} onClick={() => setExpanded(value => !value)} />
        <ActionButton action="pinStack" iconOnly disabled={!items.length} onClick={pinSelected}
          label={items.some(item => item.nodeId === selectedNodeId) ? '선택 항목 고정' : '첫 번째 항목 고정'} />
        <ActionButton action="clearStack" iconOnly variant="danger" disabled={!items.length} onClick={onClear} />
      </ActionToolbar>}>
      <div className="px-4 pb-4 pt-3" id={`${stackId}-items`}>
        <ActionToolbar label="작업 목록 범위" className="ui-stack-filter-toolbar">
          {(['recent', 'pinned', 'all'] as const).map(tab => (
            <button key={tab} type="button" data-toolbar-item="" className="ui-action-button"
              onClick={() => setView(tab)} aria-pressed={view === tab}>
              {{ recent: '최근 항목', pinned: '고정 항목', all: '전체 항목' }[tab]}
            </button>
          ))}
        </ActionToolbar>

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
                      'ui-insight-stack-item group relative flex h-[118px] flex-col rounded-lg border p-3',
                      TOKENS.motion,
                      active
                        ? 'border-ui-accent bg-ui-accent-soft shadow-none dark:border-ui-accent dark:bg-ui-accent-soft'
                        : "border-ui-line bg-ui-surface hover:border-ui-line hover:bg-ui-soft dark:border-border dark:bg-card dark:hover:bg-muted/30"
                    )}
                  >
                    <button
                      type='button'
                      className={cn(
                        'ui-insight-stack-select min-h-11 min-w-0 pr-8 text-left',
                        TOKENS.focus
                      )}
                      onClick={() => onSelect(item)}
                    >
                      <div className="flex items-center gap-2">
                        <StackKindIcon kind={item.kind} />
                        <span className="truncate text-sm font-semibold text-ui-text dark:text-foreground">
                          {item.title}
                        </span>
                        {active && (
                          <Check className="h-3.5 w-3.5 text-ui-accent" />
                        )}
                      </div>
                      {item.subtitle && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-ui-muted dark:text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="truncate">{item.subtitle}</span>
                        </div>
                      )}
                    </button>
                    <button
                      type='button'
                      className={cn(
                        "ui-insight-stack-action ui-insight-stack-remove absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-ui-muted hover:bg-destructive/10 hover:text-destructive",
                        TOKENS.focus,
                        TOKENS.motion
                      )}
                      onClick={() => onRemove(item.id)}
                      aria-label={`Remove ${item.title} from stack`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="ui-insight-stack-meta mt-auto flex flex-wrap gap-1.5">
                      <span className="rounded-lg bg-ui-soft px-2 py-0.5 text-[11px] font-medium text-ui-muted dark:bg-muted dark:text-muted-foreground">
                        {item.kind}
                      </span>
                      {pinned && (
                        <span className="rounded-lg bg-ui-accent-soft px-2 py-0.5 text-[11px] font-medium text-ui-accent dark:bg-ui-accent-soft dark:text-ui-accent">
                          pinned
                        </span>
                      )}
                      {item.postKey && (
                        <span className="max-w-[120px] truncate rounded-lg bg-ui-soft px-2 py-0.5 text-[11px] font-medium text-ui-muted dark:bg-muted dark:text-muted-foreground">
                          {item.postKey}
                        </span>
                      )}
                    </div>
                    <button
                      type='button'
                      className={cn(
                        "ui-insight-stack-action ui-insight-stack-pin absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-lg text-ui-muted hover:bg-ui-accent-soft hover:text-ui-accent dark:hover:bg-ui-accent-soft",
                        pinned && 'text-ui-accent',
                        TOKENS.focus,
                        TOKENS.motion
                      )}
                      onClick={() => togglePinned(item.id)}
                      aria-pressed={pinned}
                      aria-label={`${pinned ? 'Unpin' : 'Pin'} ${item.title}`}
                    >
                      <Bookmark className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="grid min-h-[118px] place-items-center rounded-lg border border-dashed border-ui-line p-4 text-center dark:border-border">
            <div>
              <LayoutGrid className="mx-auto h-9 w-9 text-ui-muted dark:text-muted-foreground/50" />
              <p className="mt-2 text-sm text-ui-muted dark:text-muted-foreground">
                Stack tray is empty.
              </p>
            </div>
          </div>
        )}
      </div>
    </WorkspacePanel>
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
      <Icon className="h-4 w-4" />
    </span>
  );
}
