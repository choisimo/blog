import type { InsightGraph, InsightGraphEdge, InsightGraphNode, InsightNodeType } from './types';

export type InsightViewMode = 'list' | 'focus' | 'map';
export const INSIGHT_NODE_LABELS: Record<InsightNodeType, string> = {
  post: '게시글', memo: '메모', chat: 'AI 대화', thought: '생각', tag: '태그', search: '검색',
};
export const INSIGHT_EDGE_LABELS: Record<InsightGraphEdge['type'], string> = {
  category: '같은 카테고리', tag: '공통 태그', activity: '활동 연결',
  chat: '대화 맥락', memo: '메모 연결', thought: '생각 기록',
};
export const INSIGHT_NODE_TYPES = Object.keys(INSIGHT_NODE_LABELS) as InsightNodeType[];

export function insightText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g, '')
      .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
    : '';
}

export function filterInsightNodes(graph: InsightGraph, query: string, types: ReadonlySet<InsightNodeType>): InsightGraphNode[] {
  const term = insightText(query).toLocaleLowerCase();
  return graph.nodes.filter(node => types.has(node.type) && (!term || [
    node.label, node.detail, node.postKey, node.post?.description, node.post?.excerpt,
    node.post?.category, ...(node.post?.tags ?? []),
  ].some(value => insightText(value).toLocaleLowerCase().includes(term))));
}

/** Counts undirected neighbours, not duplicate links or dangling endpoints. Never edits the stored graph. */
export function insightDegree(graph: InsightGraph): Map<string, number> {
  const valid = new Set(graph.nodes.map(node => node.id));
  const neighbours = new Map<string, Set<string>>();
  for (const edge of graph.edges) {
    if (edge.source === edge.target || !valid.has(edge.source) || !valid.has(edge.target)) continue;
    for (const [a, b] of [[edge.source, edge.target], [edge.target, edge.source]]) {
      if (!neighbours.has(a)) neighbours.set(a, new Set());
      neighbours.get(a)?.add(b);
    }
  }
  return new Map(graph.nodes.map(node => [node.id, neighbours.get(node.id)?.size ?? 0]));
}

export function deriveInsightView(graph: InsightGraph, matches: InsightGraphNode[], selectedId: string | null,
  mode: InsightViewMode, limit: number) {
  const allowed = new Set(matches.map(node => node.id));
  const anchor = selectedId ? matches.find(node => node.id === selectedId) ?? null : matches[0] ?? null;
  const selectedHidden = !!selectedId && !allowed.has(selectedId);
  let candidates = matches;
  if (mode === 'focus') {
    const neighbours = new Set<string>();
    if (anchor) for (const edge of graph.edges) {
      if (edge.source === anchor.id) neighbours.add(edge.target);
      if (edge.target === anchor.id) neighbours.add(edge.source);
    }
    candidates = anchor ? [anchor, ...matches.filter(node => node.id !== anchor.id && neighbours.has(node.id))
      .sort((a, b) => (Number.isFinite(b.weight) ? b.weight : 0) - (Number.isFinite(a.weight) ? a.weight : 0)
        || a.id.localeCompare(b.id))] : [];
  } else if (mode === 'map' && anchor) {
    // Keep the selection in a bounded map, without silently discarding other data.
    candidates = [anchor, ...matches.filter(node => node.id !== anchor.id)];
  }
  const take = Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 40));
  const nodes = candidates.slice(0, take);
  const ids = new Set(nodes.map(node => node.id));
  const edges = graph.edges.filter(edge => edge.source !== edge.target && ids.has(edge.source) && ids.has(edge.target));
  return { nodes, edges, anchor, selectedHidden, candidateCount: candidates.length, remaining: Math.max(0, candidates.length - nodes.length) };
}

export interface InsightNodePlacement { node: InsightGraphNode; x: number; y: number; width: number; height: number; }
export interface InsightLayout { width: number; height: number; nodes: InsightNodePlacement[]; }

/** Non-overlapping presentation coordinates. Canonical node x/y are deliberately left unchanged. */
export function layoutInsightNodes(nodes: InsightGraphNode[], viewportWidth: number, mode: InsightViewMode, anchorId: string | null): InsightLayout {
  const measured = Number.isFinite(viewportWidth) ? Math.max(280, viewportWidth) : 800;
  const width = mode === 'map' ? Math.max(960, measured) : measured;
  const padding = 24;
  const gap = 28;
  const height = 132;
  const columns = Math.max(1, Math.min(mode === 'map' ? 5 : 3, Math.floor((width - padding * 2 + gap) / (252 + gap))));
  const cardWidth = Math.min(300, (width - padding * 2 - gap * (columns - 1)) / columns);
  const gridWidth = columns * cardWidth + gap * (columns - 1);
  const left = (width - gridWidth) / 2;
  if (mode === 'focus') {
    const anchor = nodes.find(node => node.id === anchorId) ?? nodes[0];
    if (!anchor) return { width, height: 320, nodes: [] };
    const rest = nodes.filter(node => node.id !== anchor.id);
    const placed: InsightNodePlacement[] = [{ node: anchor, x: (width - cardWidth) / 2, y: 28, width: cardWidth, height }];
    rest.forEach((node, index) => placed.push({ node, x: left + (index % columns) * (cardWidth + gap),
      y: 224 + Math.floor(index / columns) * (height + 56), width: cardWidth, height }));
    return { width, height: Math.max(340, 224 + Math.ceil(rest.length / columns) * (height + 56)), nodes: placed };
  }
  const ordered = [...nodes].sort((a, b) => INSIGHT_NODE_TYPES.indexOf(a.type) - INSIGHT_NODE_TYPES.indexOf(b.type) || a.id.localeCompare(b.id));
  const placed = ordered.map((node, index) => ({ node, x: left + (index % columns) * (cardWidth + gap),
    y: 32 + Math.floor(index / columns) * (height + 56), width: cardWidth, height }));
  return { width, height: Math.max(360, 64 + Math.ceil(nodes.length / columns) * (height + 56)), nodes: placed };
}

export function insightEdgePath(source: InsightNodePlacement, target: InsightNodePlacement): string {
  const sx = source.x + source.width / 2, sy = source.y + source.height / 2;
  const tx = target.x + target.width / 2, ty = target.y + target.height / 2;
  const middle = (sy + ty) / 2;
  return `M ${sx} ${sy} C ${sx} ${middle}, ${tx} ${middle}, ${tx} ${ty}`;
}
