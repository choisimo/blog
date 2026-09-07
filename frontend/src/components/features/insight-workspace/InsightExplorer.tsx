import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, FileText, NotebookPen, Search, Sparkles, Tag, X } from 'lucide-react';
import { ActionButton } from '@/components/ui/action-button';
import { ActionToolbar } from '@/components/ui/action-toolbar';
import type { InsightGraph, InsightGraphNode, InsightNodeType } from './types';
import { deriveInsightView, filterInsightNodes, insightDegree, insightEdgePath, insightText, layoutInsightNodes,
  INSIGHT_EDGE_LABELS, INSIGHT_NODE_LABELS, INSIGHT_NODE_TYPES, type InsightViewMode } from './insightPresentation';

const ICONS = { post: FileText, memo: NotebookPen, chat: Bot, thought: Sparkles, tag: Tag, search: Search };
const MODES = [{ id: 'list', action: 'viewList' }, { id: 'focus', action: 'viewFocus' },
  { id: 'map', action: 'viewMap' }] as const;

interface InsightExplorerProps {
  graph: InsightGraph;
  selectedNodeId: string | null;
  onSelectNode: (node: InsightGraphNode) => void;
}

/** One state owner for all views; the inspector, graph data, and saved stack remain owned by the page. */
export const InsightExplorer = memo(function InsightExplorer({ graph, selectedNodeId, onSelectNode }: InsightExplorerProps) {
  const [view, setView] = useState<InsightViewMode>(() => typeof window !== 'undefined'
    && window.matchMedia?.('(max-width: 767px)').matches ? 'list' : 'focus');
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState<Set<InsightNodeType>>(() => new Set(INSIGHT_NODE_TYPES));
  const [limit, setLimit] = useState(40);
  const [zoom, setZoom] = useState(1);
  const [showAllEdges, setShowAllEdges] = useState(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState('');
  const [width, setWidth] = useState(760);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; left: number; top: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const matches = useMemo(() => filterInsightNodes(graph, query, types), [graph, query, types]);
  const degree = useMemo(() => insightDegree(graph), [graph]);
  const presentation = useMemo(() => deriveInsightView(graph, matches, selectedNodeId, view, view === 'focus' ? Math.min(limit, 13 + Math.max(0, limit - 40)) : limit),
    [graph, matches, selectedNodeId, view, limit]);
  const layout = useMemo(() => layoutInsightNodes(presentation.nodes, width, view, presentation.anchor?.id ?? null),
    [presentation.nodes, presentation.anchor, width, view]);
  const placements = useMemo(() => new Map(layout.nodes.map(item => [item.node.id, item])), [layout]);
  const visibleEdges = useMemo(() => presentation.edges.filter(edge => showAllEdges || edge.source === selectedNodeId
    || edge.target === selectedNodeId || edge.id === selectedEdgeId), [presentation.edges, showAllEdges, selectedNodeId, selectedEdgeId]);
  const selectedEdge = presentation.edges.find(edge => edge.id === selectedEdgeId);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => { if (el.clientWidth > 0) setWidth(Math.floor(el.clientWidth)); };
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update); observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { setLimit(40); setSelectedEdgeId(''); }, [query, types, view]);
  const clearFilters = () => { setQuery(''); setTypes(new Set(INSIGHT_NODE_TYPES)); searchRef.current?.focus(); };
  const select = (node: InsightGraphNode) => { setSelectedEdgeId(''); onSelectNode(node); };
  const fit = () => { setZoom(1); viewportRef.current?.scrollTo({ top: 0, left: 0 }); };

  return <div className="ui-insight-explorer" data-view={view}>
    <div className="ui-insight-explorer-toolbar">
      <ActionToolbar className="ui-insight-view-switch" label="자료를 보는 방식">
        {MODES.map(({ id, action }) => <ActionButton key={id} action={action}
          pressed={view === id} onClick={() => setView(id)} />)}
      </ActionToolbar>
      <div className="ui-insight-query"><label htmlFor="insight-node-search" className="sr-only">자료 검색</label><Search aria-hidden="true" size={17} />
        <input ref={searchRef} id="insight-node-search" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="제목, 내용, 태그 검색" />
        {query && <button type="button" onClick={() => { setQuery(''); searchRef.current?.focus(); }} aria-label="검색어 지우기"><X size={16} aria-hidden="true" /></button>}
      </div>
      <details className="ui-insight-filter"><summary>유형 필터 <span>{types.size} / {INSIGHT_NODE_TYPES.length}</span></summary>
        <fieldset><legend className="sr-only">표시할 자료 유형</legend>{INSIGHT_NODE_TYPES.map(type => <label key={type}>
          <input type="checkbox" checked={types.has(type)} onChange={() => setTypes(previous => {
            const next = new Set(previous); if (next.has(type)) next.delete(type); else next.add(type); return next;
          })} /><span>{INSIGHT_NODE_LABELS[type]}</span><span>{graph.nodes.filter(node => node.type === type).length}</span></label>)}</fieldset>
      </details>
    </div>
    <div className="ui-insight-view-summary">
      <p role="status" aria-live="polite"><strong>{matches.length}</strong> / {graph.nodes.length}개 자료
        {view !== 'list' && <> · 현재 화면 {presentation.nodes.length}개</>}</p>
      <span>{view === 'list' ? '제목을 선택하면 상세 내용을 확인합니다.' : view === 'focus' ? '선택한 자료와 직접 연결된 항목만 표시합니다.' : '유형별 배치 · 연결선은 기본적으로 선택 항목 주변만 표시합니다.'}</span>
    </div>
    {presentation.selectedHidden && <div className="ui-insight-selection-notice">선택한 항목이 검색·필터 범위 밖에 있습니다. 상세 내용은 유지됩니다.
      <button type="button" onClick={clearFilters}>검색·필터 초기화</button><button type="button" onClick={() => setView('list')}>목록에서 선택</button></div>}
    {view !== 'list' && <div className="ui-insight-map-tools">
      <ActionToolbar label="지도 배율">
        <ActionButton action="zoomOut" iconOnly disabled={zoom <= .8}
          onClick={() => setZoom(value => Math.max(.8, Math.round((value - .1) * 10) / 10))} />
        <ActionButton action="resetView" label={`${Math.round(zoom * 100)}% · 배율과 위치 초기화 · 검색 조건 유지`} onClick={fit}>
          {Math.round(zoom * 100)}%
        </ActionButton>
        <ActionButton action="zoomIn" iconOnly disabled={zoom >= 1.5}
          onClick={() => setZoom(value => Math.min(1.5, Math.round((value + .1) * 10) / 10))} />
      </ActionToolbar>
      <label><input type="checkbox" checked={showAllEdges} onChange={event => setShowAllEdges(event.target.checked)} />현재 표시된 항목의 연결선 모두 보기</label>
    </div>}
    <div ref={viewportRef} className="ui-insight-explorer-viewport" tabIndex={0} role="region" aria-label={view === 'list' ? '자료 목록' : '스크롤 가능한 지식 지도'}
      onPointerDown={event => {
        if (view === 'list' || event.pointerType !== 'mouse' || event.button !== 0 || (event.target as Element).closest('button,input,a,select,summary')) return;
        dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={event => { const drag = dragRef.current; if (drag?.id !== event.pointerId) return;
        event.currentTarget.scrollLeft = drag.left - (event.clientX - drag.x); event.currentTarget.scrollTop = drag.top - (event.clientY - drag.y); }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); dragRef.current = null; }}
      onPointerCancel={() => { dragRef.current = null; }}
      onLostPointerCapture={() => { dragRef.current = null; }}>
      {!matches.length || !presentation.nodes.length ? <div className="ui-insight-view-empty"><h2>{graph.nodes.length ? '표시할 자료가 없습니다' : '아직 연결할 자료가 없습니다'}</h2>
        <p>{graph.nodes.length ? '검색어와 유형 필터를 확인해 주세요. 저장된 자료는 삭제되지 않았습니다.' : '게시글을 읽거나 메모와 대화를 남기면 이 공간에서 확인할 수 있습니다.'}</p>
        {!!graph.nodes.length && <button type="button" className="ui-control" data-ui-variant="outline" onClick={clearFilters}>검색·필터 초기화</button>}</div>
      : view === 'list' ? <ul className="ui-insight-record-list">{presentation.nodes.map(node => {
          const Icon = ICONS[node.type]; return <li key={node.id}><button type="button" onClick={() => select(node)} aria-pressed={node.id === selectedNodeId}>
            <span className="ui-insight-record-kind" data-kind={node.type}><Icon aria-hidden="true" size={17} />{INSIGHT_NODE_LABELS[node.type]}</span>
            <span className="ui-insight-record-copy"><strong>{insightText(node.label) || '제목 없는 자료'}</strong><span>{insightText(node.detail || node.post?.description || node.post?.excerpt || node.postKey)}</span></span>
            <span className="ui-insight-record-degree">연결 {degree.get(node.id) ?? 0}</span></button></li>;
        })}</ul>
      : <div className="ui-insight-map-size" style={{ width: layout.width * zoom, height: layout.height * zoom }}>
          <div className="ui-insight-map-world" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})` }}>
            <svg className="ui-insight-map-links" width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true">
              {visibleEdges.map(edge => { const source = placements.get(edge.source), target = placements.get(edge.target); if (!source || !target) return null;
                return <path key={edge.id} d={insightEdgePath(source, target)} data-active={edge.id === selectedEdgeId || edge.source === selectedNodeId || edge.target === selectedNodeId}
                  strokeDasharray={edge.type === 'tag' ? '5 5' : edge.type === 'activity' ? '2 4' : undefined} vectorEffect="non-scaling-stroke" />; })}
            </svg>
            {layout.nodes.map(({ node, x, y, width: nodeWidth, height }) => {
              const Icon = ICONS[node.type]; return <button key={node.id} type="button" className="ui-insight-map-node" data-node-id={node.id} data-kind={node.type}
                aria-pressed={node.id === selectedNodeId} aria-label={`${INSIGHT_NODE_LABELS[node.type]}: ${insightText(node.label)}`} title={insightText(node.label)}
                style={{ left: x, top: y, width: nodeWidth, height }} onClick={() => select(node)}
                onFocus={event => event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' })}>
                <span className="ui-insight-node-category"><Icon aria-hidden="true" size={16} />{INSIGHT_NODE_LABELS[node.type]}{node.id === selectedNodeId && <em>선택됨</em>}</span>
                <strong>{insightText(node.label) || '제목 없는 자료'}</strong><span className="ui-insight-node-meta">연결 {degree.get(node.id) ?? 0}{node.post?.category ? ` · ${insightText(node.post.category)}` : ''}</span>
              </button>;
            })}
          </div>
        </div>}
    </div>
    <footer className="ui-insight-explorer-footer">
      <p>{presentation.nodes.length} / {presentation.candidateCount}개 표시{view === 'focus' ? ' · 선택 항목과 직접 연결된 자료' : ''}</p>
      {presentation.remaining > 0 && <button type="button" className="ui-control" data-ui-variant="outline" onClick={() => setLimit(value => value + (view === 'focus' ? 12 : 40))}>
        {Math.min(presentation.remaining, view === 'focus' ? 12 : 40)}개 더 보기 <span>({presentation.remaining}개 남음)</span></button>}
      {view !== 'list' && <details className="ui-insight-relations"><summary>연결 의미 · {presentation.edges.length}개</summary>
        <p>선은 기록된 관계를 뜻하며 인과관계나 유사도 점수가 아닙니다.</p>
        <label>연결 확인<select value={selectedEdge ? selectedEdgeId : ''} onChange={event => setSelectedEdgeId(event.target.value)}><option value="">연결을 선택하세요</option>
          {presentation.edges.map(edge => <option key={edge.id} value={edge.id}>{insightText(placements.get(edge.source)?.node.label)} — {INSIGHT_EDGE_LABELS[edge.type]} — {insightText(placements.get(edge.target)?.node.label)}</option>)}
        </select></label>
        {selectedEdge && <p role="status">{INSIGHT_EDGE_LABELS[selectedEdge.type]}: {insightText(placements.get(selectedEdge.source)?.node.label)} ↔ {insightText(placements.get(selectedEdge.target)?.node.label)}</p>}
      </details>}
    </footer>
  </div>;
});
