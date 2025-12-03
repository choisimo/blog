import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ZoomIn, ZoomOut, RotateCcw, Network, MessageSquare, FileText, Sparkles, X, Lightbulb, PenLine, Calendar, ExternalLink } from 'lucide-react';
import { getPosts } from '@/data/posts';
import { BlogPost } from '@/types/blog';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type NodeType = 'post' | 'chat' | 'comment' | 'question';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  data?: any;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
  type: 'category' | 'tag' | 'chat' | 'comment';
}

interface ChatSession {
  id: string;
  title?: string;
  summary?: string;
  articleUrl?: string;
  articleTitle?: string;
  updatedAt?: string;
  messages?: Array<{ role: string; content: string }>;
}

interface MemoEvent {
  type: string;
  t: number;
  label?: string;
  content?: string;
  page?: {
    url?: string;
    title?: string;
    post?: {
      year: number;
      slug: string;
      title?: string;
    };
  };
}

interface RelatedContent {
  chats: ChatSession[];
  memos: MemoEvent[];
  thoughts: MemoEvent[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Dijkstra Algorithm for finding shortest paths
// ─────────────────────────────────────────────────────────────────────────────

function buildAdjacencyList(nodes: GraphNode[], edges: GraphEdge[]): Map<string, Map<string, number>> {
  const adj = new Map<string, Map<string, number>>();
  
  nodes.forEach(n => adj.set(n.id, new Map()));
  
  edges.forEach(e => {
    adj.get(e.source)?.set(e.target, e.weight);
    adj.get(e.target)?.set(e.source, e.weight);
  });
  
  return adj;
}

function dijkstra(adj: Map<string, Map<string, number>>, start: string): Map<string, number> {
  const dist = new Map<string, number>();
  const visited = new Set<string>();
  
  adj.forEach((_, id) => dist.set(id, Infinity));
  dist.set(start, 0);
  
  const pq: [string, number][] = [[start, 0]];
  
  while (pq.length > 0) {
    pq.sort((a, b) => a[1] - b[1]);
    const [u, d] = pq.shift()!;
    
    if (visited.has(u)) continue;
    visited.add(u);
    
    const neighbors = adj.get(u);
    if (!neighbors) continue;
    
    neighbors.forEach((w, v) => {
      const alt = d + w;
      if (alt < (dist.get(v) ?? Infinity)) {
        dist.set(v, alt);
        pq.push([v, alt]);
      }
    });
  }
  
  return dist;
}

// ─────────────────────────────────────────────────────────────────────────────
// Force-directed layout simulation with collision avoidance
// ─────────────────────────────────────────────────────────────────────────────

function simulateForces(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  iterations: number = 150
): GraphNode[] {
  const result = nodes.map(n => ({ ...n }));
  
  // Minimum distance between nodes (based on node sizes)
  const minDistance = 80; // Nodes are ~24-28px radius, so 80px prevents overlap
  
  // Initialize positions using a grid-based approach to reduce initial overlap
  const cols = Math.ceil(Math.sqrt(result.length));
  const cellWidth = (width - 120) / cols;
  const cellHeight = (height - 120) / Math.ceil(result.length / cols);
  
  result.forEach((n, i) => {
    if (n.x === 0 && n.y === 0) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      // Add some randomness within the cell to avoid perfect grid
      n.x = 60 + col * cellWidth + cellWidth / 2 + (Math.random() - 0.5) * cellWidth * 0.5;
      n.y = 60 + row * cellHeight + cellHeight / 2 + (Math.random() - 0.5) * cellHeight * 0.5;
    }
    n.vx = 0;
    n.vy = 0;
  });
  
  // Build edge map for faster lookups
  const edgeMap = new Map<string, Set<string>>();
  result.forEach(n => edgeMap.set(n.id, new Set()));
  edges.forEach(e => {
    edgeMap.get(e.source)?.add(e.target);
    edgeMap.get(e.target)?.add(e.source);
  });
  
  const idealDist = Math.sqrt((width * height) / result.length) * 0.6;
  const gravity = 0.08;
  const damping = 0.8;
  
  for (let iter = 0; iter < iterations; iter++) {
    // Temperature decreases over iterations (simulated annealing)
    const temp = 1 - iter / iterations;
    const forceScale = 0.1 * (1 + temp);
    
    // Repulsive forces between all nodes
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        let dx = result[j].x - result[i].x;
        let dy = result[j].y - result[i].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        
        // Prevent division by zero and handle overlapping nodes
        if (dist < 1) {
          // Push apart in random direction
          const angle = Math.random() * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        
        // Strong repulsion when nodes are too close (collision avoidance)
        let force: number;
        if (dist < minDistance) {
          // Very strong repulsion to prevent overlap
          force = ((minDistance - dist) / minDistance) * idealDist * 2;
        } else {
          // Standard Coulomb-like repulsion
          force = (idealDist * idealDist) / dist;
        }
        
        const fx = (dx / dist) * force * forceScale;
        const fy = (dy / dist) * force * forceScale;
        
        result[i].vx -= fx;
        result[i].vy -= fy;
        result[j].vx += fx;
        result[j].vy += fy;
      }
    }
    
    // Attractive forces along edges (Hooke's law)
    edges.forEach(e => {
      const source = result.find(n => n.id === e.source);
      const target = result.find(n => n.id === e.target);
      if (!source || !target) return;
      
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      
      // Target distance based on edge weight (higher weight = closer)
      const targetDist = idealDist * (0.8 + e.weight * 0.2);
      const force = (dist - targetDist) * 0.05 * temp;
      
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      
      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    });
    
    // Gravity towards center (weaker for nodes with many connections)
    result.forEach(n => {
      const connections = edgeMap.get(n.id)?.size || 0;
      const gravityMod = 1 / (1 + connections * 0.3); // Less gravity for well-connected nodes
      
      const dx = width / 2 - n.x;
      const dy = height / 2 - n.y;
      n.vx += dx * gravity * 0.01 * gravityMod;
      n.vy += dy * gravity * 0.01 * gravityMod;
    });
    
    // Apply velocities with damping
    result.forEach(n => {
      n.vx *= damping;
      n.vy *= damping;
      
      // Limit max velocity
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      const maxSpeed = 20 * temp + 5;
      if (speed > maxSpeed) {
        n.vx = (n.vx / speed) * maxSpeed;
        n.vy = (n.vy / speed) * maxSpeed;
      }
      
      n.x += n.vx;
      n.y += n.vy;
      
      // Keep within bounds with padding
      const padding = 80;
      n.x = Math.max(padding, Math.min(width - padding, n.x));
      n.y = Math.max(padding, Math.min(height - padding, n.y));
    });
  }
  
  // Final pass: resolve any remaining overlaps
  for (let pass = 0; pass < 10; pass++) {
    let hasOverlap = false;
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const dx = result[j].x - result[i].x;
        const dy = result[j].y - result[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < minDistance) {
          hasOverlap = true;
          const overlap = (minDistance - dist) / 2 + 1;
          const angle = dist > 0 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
          
          result[i].x -= Math.cos(angle) * overlap;
          result[i].y -= Math.sin(angle) * overlap;
          result[j].x += Math.cos(angle) * overlap;
          result[j].y += Math.sin(angle) * overlap;
          
          // Keep within bounds
          result[i].x = Math.max(80, Math.min(width - 80, result[i].x));
          result[i].y = Math.max(80, Math.min(height - 80, result[i].y));
          result[j].x = Math.max(80, Math.min(width - 80, result[j].x));
          result[j].y = Math.max(80, Math.min(height - 80, result[j].y));
        }
      }
    }
    if (!hasOverlap) break;
  }
  
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Graph Canvas Component
// ─────────────────────────────────────────────────────────────────────────────

interface GraphCanvasProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode: string | null;
  hoveredNode: string | null;
  pathNodes: Set<string>;
  onNodeClick: (id: string) => void;
  onNodeHover: (id: string | null) => void;
  zoom: number;
  offset: { x: number; y: number };
  isTerminal: boolean;
}

function GraphCanvas({
  nodes,
  edges,
  selectedNode,
  hoveredNode,
  pathNodes,
  onNodeClick,
  onNodeHover,
  zoom,
  offset,
  isTerminal,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  
  // Handle resize
  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (!container) return;
    
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setCanvasSize({ width, height });
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  
  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);
    
    const draw = () => {
      // Clear
      ctx.fillStyle = isTerminal ? '#0a0a0f' : '#fafafa';
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
      
      ctx.save();
      ctx.translate(offset.x, offset.y);
      ctx.scale(zoom, zoom);
      
      // Draw grid
      ctx.strokeStyle = isTerminal ? 'rgba(80, 250, 123, 0.05)' : 'rgba(0, 0, 0, 0.03)';
      ctx.lineWidth = 1 / zoom;
      const gridSize = 40;
      for (let x = 0; x < canvasSize.width / zoom; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasSize.height / zoom);
        ctx.stroke();
      }
      for (let y = 0; y < canvasSize.height / zoom; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasSize.width / zoom, y);
        ctx.stroke();
      }
      
      // Draw edges
      edges.forEach(e => {
        const source = nodes.find(n => n.id === e.source);
        const target = nodes.find(n => n.id === e.target);
        if (!source || !target) return;
        
        const isPath = pathNodes.has(source.id) && pathNodes.has(target.id);
        const isHovered = hoveredNode === source.id || hoveredNode === target.id;
        
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        
        if (isPath) {
          ctx.strokeStyle = isTerminal ? '#bd93f9' : '#8b5cf6';
          ctx.lineWidth = 3 / zoom;
        } else if (isHovered) {
          ctx.strokeStyle = isTerminal ? 'rgba(80, 250, 123, 0.6)' : 'rgba(59, 130, 246, 0.6)';
          ctx.lineWidth = 2 / zoom;
        } else {
          ctx.strokeStyle = isTerminal ? 'rgba(80, 250, 123, 0.15)' : 'rgba(0, 0, 0, 0.1)';
          ctx.lineWidth = 1 / zoom;
        }
        ctx.stroke();
      });
      
      // Draw nodes
      nodes.forEach(n => {
        const isSelected = selectedNode === n.id;
        const isHovered = hoveredNode === n.id;
        const isInPath = pathNodes.has(n.id);
        
        // Node colors by type
        let fillColor: string;
        let strokeColor: string;
        let size = 24;
        
        switch (n.type) {
          case 'post':
            fillColor = isTerminal ? '#50fa7b' : '#22c55e';
            strokeColor = isTerminal ? '#50fa7b' : '#16a34a';
            size = 28;
            break;
          case 'chat':
            fillColor = isTerminal ? '#bd93f9' : '#8b5cf6';
            strokeColor = isTerminal ? '#bd93f9' : '#7c3aed';
            size = 22;
            break;
          case 'comment':
            fillColor = isTerminal ? '#8be9fd' : '#06b6d4';
            strokeColor = isTerminal ? '#8be9fd' : '#0891b2';
            size = 18;
            break;
          case 'question':
            fillColor = isTerminal ? '#ffb86c' : '#f59e0b';
            strokeColor = isTerminal ? '#ffb86c' : '#d97706';
            size = 20;
            break;
        }
        
        if (isSelected || isInPath) {
          size *= 1.3;
        }
        
        // Draw glow for selected/hovered
        if (isSelected || isHovered) {
          ctx.shadowColor = fillColor;
          ctx.shadowBlur = 20;
        }
        
        // Draw node
        ctx.beginPath();
        ctx.arc(n.x, n.y, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#fff' : strokeColor;
        ctx.lineWidth = isSelected ? 3 / zoom : 2 / zoom;
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        // Draw icon inside node - use dark color for contrast on bright backgrounds
        ctx.fillStyle = isTerminal ? '#1a1a2e' : '#fff';
        ctx.font = `bold ${size * 0.5}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let icon: string;
        switch (n.type) {
          case 'post': icon = 'P'; break;
          case 'chat': icon = 'C'; break;
          case 'comment': icon = 'M'; break;
          case 'question': icon = '?'; break;
        }
        ctx.fillText(icon, n.x, n.y);
        
        // Draw label
        if (isSelected || isHovered || zoom > 0.8) {
          const label = n.label.length > 20 ? n.label.slice(0, 20) + '...' : n.label;
          ctx.font = `${11 / zoom}px monospace`;
          ctx.fillStyle = isTerminal ? 'rgba(80, 250, 123, 0.9)' : 'rgba(0, 0, 0, 0.8)';
          ctx.fillText(label, n.x, n.y + size / 2 + 12 / zoom);
        }
      });
      
      ctx.restore();
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
    return () => cancelAnimationFrame(animationRef.current);
  }, [nodes, edges, selectedNode, hoveredNode, pathNodes, zoom, offset, isTerminal, canvasSize]);
  
  // Mouse interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;
    
    const hovered = nodes.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });
    
    onNodeHover(hovered?.id || null);
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  };
  
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offset.x) / zoom;
    const y = (e.clientY - rect.top - offset.y) / zoom;
    
    const clicked = nodes.find(n => {
      const dx = n.x - x;
      const dy = n.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 20;
    });
    
    if (clicked) {
      onNodeClick(clicked.id);
    }
  };
  
  return (
    <canvas
      ref={canvasRef}
      width={canvasSize.width}
      height={canvasSize.height}
      style={{ width: '100%', height: '100%' }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
      onMouseLeave={() => onNodeHover(null)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Insight Page Component
// ─────────────────────────────────────────────────────────────────────────────

const Insight = () => {
  const { isTerminal } = useTheme();
  const navigate = useNavigate();
  
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [pathNodes, setPathNodes] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showPreview, setShowPreview] = useState(false);
  const [relatedContent, setRelatedContent] = useState<RelatedContent>({ chats: [], memos: [], thoughts: [] });
  const [allMemoEvents, setAllMemoEvents] = useState<MemoEvent[]>([]);
  const [allChatSessions, setAllChatSessions] = useState<ChatSession[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Load data and build graph
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      
      try {
        // Load posts
        const posts = await getPosts();
        
        // Load AI chat sessions from localStorage
        let chatSessions: ChatSession[] = [];
        try {
          const raw = localStorage.getItem('ai_chat_sessions_index');
          if (raw) {
            chatSessions = JSON.parse(raw).filter((s: any) => s && s.id);
          }
        } catch {}
        setAllChatSessions(chatSessions);
        
        // Load memo events from localStorage
        let memoEvents: MemoEvent[] = [];
        try {
          const raw = localStorage.getItem('aiMemo.events');
          if (raw) {
            memoEvents = JSON.parse(raw).filter((e: any) => e && typeof e.t === 'number');
          }
        } catch {}
        setAllMemoEvents(memoEvents);
        
        // Load visited posts
        let visitedPosts: any[] = [];
        try {
          const raw = localStorage.getItem('visited.posts');
          if (raw) {
            visitedPosts = JSON.parse(raw);
          }
        } catch {}
        
        // Build nodes
        const newNodes: GraphNode[] = [];
        const newEdges: GraphEdge[] = [];
        
        // Add post nodes (only visited ones for now, or limit to recent)
        const recentPosts = posts.slice(0, 30);
        recentPosts.forEach((p, i) => {
          newNodes.push({
            id: `post-${p.slug}`,
            type: 'post',
            label: p.title,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            data: p,
          });
        });
        
        // Add chat session nodes
        chatSessions.slice(0, 20).forEach((s, i) => {
          newNodes.push({
            id: `chat-${s.id}`,
            type: 'chat',
            label: s.title || s.articleTitle || 'AI Chat',
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            data: s,
          });
          
          // Link chat to its article
          if (s.articleUrl) {
            const slug = s.articleUrl.split('/').pop();
            const postId = `post-${slug}`;
            if (newNodes.find(n => n.id === postId)) {
              newEdges.push({
                source: `chat-${s.id}`,
                target: postId,
                weight: 1,
                type: 'chat',
              });
            }
          }
        });
        
        // Build edges based on shared tags/categories
        for (let i = 0; i < recentPosts.length; i++) {
          for (let j = i + 1; j < recentPosts.length; j++) {
            const p1 = recentPosts[i];
            const p2 = recentPosts[j];
            
            // Same category = connected
            if (p1.category === p2.category) {
              newEdges.push({
                source: `post-${p1.slug}`,
                target: `post-${p2.slug}`,
                weight: 2,
                type: 'category',
              });
            }
            
            // Shared tags = connected
            const sharedTags = p1.tags.filter(t => p2.tags.includes(t));
            if (sharedTags.length > 0) {
              newEdges.push({
                source: `post-${p1.slug}`,
                target: `post-${p2.slug}`,
                weight: 3 - Math.min(sharedTags.length, 2),
                type: 'tag',
              });
            }
          }
        }
        
        // Apply force-directed layout
        const containerWidth = containerRef.current?.clientWidth || 800;
        const containerHeight = containerRef.current?.clientHeight || 600;
        const layoutedNodes = simulateForces(newNodes, newEdges, containerWidth, containerHeight, 150);
        
        setNodes(layoutedNodes);
        setEdges(newEdges);
      } catch (err) {
        console.error('Failed to load insight data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Handle node selection and path finding
  const handleNodeClick = useCallback((id: string) => {
    if (selectedNode === id) {
      // Double-click: open preview panel for posts
      const node = nodes.find(n => n.id === id);
      if (node?.type === 'post') {
        setShowPreview(true);
      } else if (node?.type === 'post' && node.data) {
        navigate(`/blog/${node.data.year}/${node.data.slug}`);
      }
      return;
    }
    
    // Find related content for the selected node
    const node = nodes.find(n => n.id === id);
    if (node?.type === 'post' && node.data) {
      const postKey = `${node.data.year}/${node.data.slug}`;
      
      // Find related chats
      const relatedChats = allChatSessions.filter(s => {
        if (!s.articleUrl) return false;
        return s.articleUrl.includes(node.data.slug);
      });
      
      // Find related memo events (memos and thoughts for this post)
      const relatedMemos = allMemoEvents.filter(e => {
        if (!e.page?.post) return false;
        const eventKey = `${e.page.post.year}/${e.page.post.slug}`;
        return eventKey === postKey && (e.type === 'memo' || e.type === 'save');
      });
      
      const relatedThoughts = allMemoEvents.filter(e => {
        if (!e.page?.post) return false;
        const eventKey = `${e.page.post.year}/${e.page.post.slug}`;
        return eventKey === postKey && e.type === 'thought';
      });
      
      setRelatedContent({
        chats: relatedChats,
        memos: relatedMemos,
        thoughts: relatedThoughts,
      });
    } else {
      setRelatedContent({ chats: [], memos: [], thoughts: [] });
    }
    
    if (selectedNode) {
      // Find shortest path between selected and clicked
      const adj = buildAdjacencyList(nodes, edges);
      const distances = dijkstra(adj, selectedNode);
      
      // Reconstruct path (simplified - just highlight connected nodes)
      const path = new Set<string>([selectedNode, id]);
      
      // Add intermediate nodes with short distances
      nodes.forEach(n => {
        const d = distances.get(n.id);
        if (d !== undefined && d < 5 && d > 0) {
          path.add(n.id);
        }
      });
      
      setPathNodes(path);
    }
    
    setSelectedNode(id);
  }, [selectedNode, nodes, edges, navigate, allChatSessions, allMemoEvents]);
  
  // Zoom controls
  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setSelectedNode(null);
    setPathNodes(new Set());
    setShowPreview(false);
    setRelatedContent({ chats: [], memos: [], thoughts: [] });
  };
  
  // Pan controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }
  };
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };
  
  const handleMouseUp = () => setIsDragging(false);
  
  // Stats
  const stats = useMemo(() => ({
    posts: nodes.filter(n => n.type === 'post').length,
    chats: nodes.filter(n => n.type === 'chat').length,
    connections: edges.length,
  }), [nodes, edges]);
  
  return (
    <div className={cn(
      'min-h-screen flex flex-col',
      isTerminal
        ? 'bg-[#0a0a0f] text-[#50fa7b]'
        : 'bg-gradient-to-b from-[#fafafa] to-white'
    )}>
      {/* Header */}
      <header className={cn(
        'sticky top-0 z-50 border-b px-4 py-3',
        isTerminal
          ? 'bg-[#0a0a0f]/95 border-[#50fa7b]/20 backdrop-blur'
          : 'bg-white/95 border-gray-200 backdrop-blur'
      )}>
        <div className='max-w-7xl mx-auto flex items-center justify-between gap-4'>
          <div className='flex items-center gap-3'>
            <Button
              variant='ghost'
              size='icon'
              onClick={() => navigate(-1)}
              className={cn(
                'h-9 w-9',
                isTerminal && 'text-[#50fa7b] hover:bg-[#50fa7b]/10'
              )}
            >
              <ArrowLeft className='h-5 w-5' />
            </Button>
            <div>
              <h1 className={cn(
                'text-lg font-semibold',
                isTerminal && 'font-mono'
              )}>
                {isTerminal ? '// insight_graph' : 'Insight Graph'}
              </h1>
              <p className={cn(
                'text-xs',
                isTerminal ? 'text-[#50fa7b]/60' : 'text-muted-foreground'
              )}>
                {isTerminal ? '> dijkstra_map v1.0' : 'Your content universe'}
              </p>
            </div>
          </div>
          
          {/* Zoom controls */}
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='icon'
              onClick={handleZoomOut}
              className={cn('h-8 w-8', isTerminal && 'text-[#50fa7b] hover:bg-[#50fa7b]/10')}
            >
              <ZoomOut className='h-4 w-4' />
            </Button>
            <span className={cn(
              'text-xs font-mono w-12 text-center',
              isTerminal ? 'text-[#50fa7b]/80' : 'text-muted-foreground'
            )}>
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant='ghost'
              size='icon'
              onClick={handleZoomIn}
              className={cn('h-8 w-8', isTerminal && 'text-[#50fa7b] hover:bg-[#50fa7b]/10')}
            >
              <ZoomIn className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='icon'
              onClick={handleReset}
              className={cn('h-8 w-8', isTerminal && 'text-[#50fa7b] hover:bg-[#50fa7b]/10')}
            >
              <RotateCcw className='h-4 w-4' />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Stats bar */}
      <div className={cn(
        'border-b px-4 py-2',
        isTerminal
          ? 'bg-[#0d0d14] border-[#50fa7b]/10'
          : 'bg-gray-50 border-gray-100'
      )}>
        <div className='max-w-7xl mx-auto flex items-center gap-6 text-xs'>
          <div className='flex items-center gap-2'>
            <FileText className={cn('h-3.5 w-3.5', isTerminal ? 'text-[#50fa7b]' : 'text-green-500')} />
            <span className={isTerminal ? 'font-mono' : ''}>
              {isTerminal ? `posts: ${stats.posts}` : `${stats.posts} Posts`}
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <Sparkles className={cn('h-3.5 w-3.5', isTerminal ? 'text-[#bd93f9]' : 'text-purple-500')} />
            <span className={isTerminal ? 'font-mono' : ''}>
              {isTerminal ? `chats: ${stats.chats}` : `${stats.chats} AI Chats`}
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <Network className={cn('h-3.5 w-3.5', isTerminal ? 'text-[#8be9fd]' : 'text-cyan-500')} />
            <span className={isTerminal ? 'font-mono' : ''}>
              {isTerminal ? `edges: ${stats.connections}` : `${stats.connections} Connections`}
            </span>
          </div>
        </div>
      </div>
      
      {/* Graph container */}
      <div
        ref={containerRef}
        className='flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing'
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {loading ? (
          <div className='absolute inset-0 flex items-center justify-center'>
            <div className={cn(
              'text-center space-y-3',
              isTerminal && 'font-mono'
            )}>
              <div className={cn(
                'w-8 h-8 border-2 rounded-full animate-spin mx-auto',
                isTerminal
                  ? 'border-[#50fa7b]/30 border-t-[#50fa7b]'
                  : 'border-gray-200 border-t-primary'
              )} />
              <p className={isTerminal ? 'text-[#50fa7b]/60' : 'text-muted-foreground'}>
                {isTerminal ? '> loading graph data...' : 'Building your insight graph...'}
              </p>
            </div>
          </div>
        ) : nodes.length === 0 ? (
          <div className='absolute inset-0 flex items-center justify-center'>
            <div className={cn(
              'text-center space-y-4 max-w-sm px-4',
              isTerminal && 'font-mono'
            )}>
              <Network className={cn(
                'h-16 w-16 mx-auto',
                isTerminal ? 'text-[#50fa7b]/30' : 'text-muted-foreground/30'
              )} />
              <h2 className={cn(
                'text-lg font-semibold',
                isTerminal ? 'text-[#50fa7b]' : ''
              )}>
                {isTerminal ? '> no_data_found' : 'No data yet'}
              </h2>
              <p className={cn(
                'text-sm',
                isTerminal ? 'text-[#50fa7b]/60' : 'text-muted-foreground'
              )}>
                {isTerminal
                  ? '// read posts and chat with AI to build your knowledge graph'
                  : 'Read some posts and chat with AI to start building your insight graph.'}
              </p>
              <Button
                onClick={() => navigate('/blog')}
                className={cn(
                  isTerminal && 'bg-[#50fa7b] text-[#052e16] hover:bg-[#50fa7b]/80 font-semibold'
                )}
              >
                {isTerminal ? '> explore_posts' : 'Explore Posts'}
              </Button>
            </div>
          </div>
        ) : (
          <GraphCanvas
            nodes={nodes}
            edges={edges}
            selectedNode={selectedNode}
            hoveredNode={hoveredNode}
            pathNodes={pathNodes}
            onNodeClick={handleNodeClick}
            onNodeHover={setHoveredNode}
            zoom={zoom}
            offset={offset}
            isTerminal={isTerminal}
          />
        )}
      </div>
      
      {/* Legend */}
      <div className={cn(
        'border-t px-4 py-3',
        isTerminal
          ? 'bg-[#0d0d14] border-[#50fa7b]/10'
          : 'bg-gray-50 border-gray-100'
      )}>
        <div className='max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-4 text-xs'>
          <div className='flex items-center gap-2'>
            <div className={cn(
              'w-4 h-4 rounded-full',
              isTerminal ? 'bg-[#50fa7b]' : 'bg-green-500'
            )} />
            <span className={isTerminal ? 'font-mono text-[#50fa7b]/80' : 'text-muted-foreground'}>
              Post
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <div className={cn(
              'w-4 h-4 rounded-full',
              isTerminal ? 'bg-[#bd93f9]' : 'bg-purple-500'
            )} />
            <span className={isTerminal ? 'font-mono text-[#50fa7b]/80' : 'text-muted-foreground'}>
              AI Chat
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <div className={cn(
              'w-4 h-4 rounded-full',
              isTerminal ? 'bg-[#8be9fd]' : 'bg-cyan-500'
            )} />
            <span className={isTerminal ? 'font-mono text-[#50fa7b]/80' : 'text-muted-foreground'}>
              Comment
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <div className={cn(
              'w-4 h-4 rounded-full',
              isTerminal ? 'bg-[#ffb86c]' : 'bg-amber-500'
            )} />
            <span className={isTerminal ? 'font-mono text-[#50fa7b]/80' : 'text-muted-foreground'}>
              Question
            </span>
          </div>
          <span className={cn(
            'hidden sm:inline',
            isTerminal ? 'font-mono text-[#50fa7b]/40' : 'text-muted-foreground/60'
          )}>
            {isTerminal ? '| click: select | double-click: preview |' : '• Click to select • Double-click to preview'}
          </span>
        </div>
      </div>
      
      {/* Selected node info panel (compact) */}
      {selectedNode && !showPreview && (
        <div className={cn(
          'fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 rounded-xl border p-4 shadow-lg',
          isTerminal
            ? 'bg-[#0d0d14]/95 border-[#50fa7b]/20 backdrop-blur'
            : 'bg-white/95 border-gray-200 backdrop-blur'
        )}>
          {(() => {
            const node = nodes.find(n => n.id === selectedNode);
            if (!node) return null;
            
            const hasRelated = relatedContent.chats.length > 0 || relatedContent.memos.length > 0 || relatedContent.thoughts.length > 0;
            
            return (
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    {node.type === 'post' && <FileText className={cn('h-4 w-4', isTerminal ? 'text-[#50fa7b]' : 'text-green-500')} />}
                    {node.type === 'chat' && <Sparkles className={cn('h-4 w-4', isTerminal ? 'text-[#bd93f9]' : 'text-purple-500')} />}
                    {node.type === 'comment' && <MessageSquare className={cn('h-4 w-4', isTerminal ? 'text-[#8be9fd]' : 'text-cyan-500')} />}
                    <span className={cn(
                      'text-xs uppercase tracking-wide',
                      isTerminal ? 'font-mono text-[#50fa7b]/60' : 'text-muted-foreground'
                    )}>
                      {node.type}
                    </span>
                  </div>
                  {hasRelated && (
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      isTerminal ? 'bg-[#bd93f9]/20 text-[#bd93f9] font-mono' : 'bg-purple-100 text-purple-700'
                    )}>
                      +{relatedContent.chats.length + relatedContent.memos.length + relatedContent.thoughts.length} related
                    </span>
                  )}
                </div>
                <h3 className={cn(
                  'font-semibold line-clamp-2',
                  isTerminal && 'font-mono text-[#50fa7b]'
                )}>
                  {node.label}
                </h3>
                {node.data?.category && (
                  <p className={cn(
                    'text-xs',
                    isTerminal ? 'font-mono text-[#50fa7b]/60' : 'text-muted-foreground'
                  )}>
                    {isTerminal ? `category: ${node.data.category}` : node.data.category}
                  </p>
                )}
                <div className='flex gap-2 mt-2'>
                  {node.type === 'post' && (
                    <Button
                      size='sm'
                      variant='outline'
                      className={cn(
                        'flex-1',
                        isTerminal && 'border-[#50fa7b]/30 text-[#50fa7b] hover:bg-[#50fa7b]/10 font-mono'
                      )}
                      onClick={() => setShowPreview(true)}
                    >
                      {isTerminal ? '> preview' : 'Preview'}
                    </Button>
                  )}
                  <Button
                    size='sm'
                    className={cn(
                      'flex-1',
                      isTerminal && 'bg-[#50fa7b] text-[#052e16] hover:bg-[#50fa7b]/80 font-mono font-semibold'
                    )}
                    onClick={() => {
                      if (node.type === 'post' && node.data) {
                        navigate(`/blog/${node.data.year}/${node.data.slug}`);
                      }
                    }}
                  >
                    {isTerminal ? '> open' : 'Open'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      
      {/* Full preview panel with aggregated content */}
      {showPreview && selectedNode && (
        <div className={cn(
          'fixed inset-4 md:left-auto md:right-4 md:top-20 md:bottom-20 md:w-[400px] rounded-xl border shadow-xl overflow-hidden flex flex-col',
          isTerminal
            ? 'bg-[#0d0d14] border-[#50fa7b]/20'
            : 'bg-white border-gray-200'
        )}>
          {(() => {
            const node = nodes.find(n => n.id === selectedNode);
            if (!node) return null;
            
            return (
              <>
                {/* Header */}
                <div className={cn(
                  'flex items-start justify-between gap-3 p-4 border-b',
                  isTerminal ? 'border-[#50fa7b]/10' : 'border-gray-100'
                )}>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-2'>
                      <FileText className={cn('h-4 w-4 shrink-0', isTerminal ? 'text-[#50fa7b]' : 'text-green-500')} />
                      <span className={cn(
                        'text-xs uppercase tracking-wide',
                        isTerminal ? 'font-mono text-[#50fa7b]/60' : 'text-muted-foreground'
                      )}>
                        {node.type}
                      </span>
                    </div>
                    <h3 className={cn(
                      'font-semibold text-lg leading-tight',
                      isTerminal && 'font-mono text-[#50fa7b]'
                    )}>
                      {node.label}
                    </h3>
                    {node.data?.category && (
                      <p className={cn(
                        'text-xs mt-1',
                        isTerminal ? 'font-mono text-[#50fa7b]/60' : 'text-muted-foreground'
                      )}>
                        {node.data.category}
                        {node.data?.date && ` • ${new Date(node.data.date).toLocaleDateString()}`}
                      </p>
                    )}
                  </div>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => setShowPreview(false)}
                    className={cn('h-8 w-8 shrink-0', isTerminal && 'text-[#50fa7b] hover:bg-[#50fa7b]/10')}
                  >
                    <X className='h-4 w-4' />
                  </Button>
                </div>
                
                {/* Content */}
                <div className={cn(
                  'flex-1 overflow-y-auto p-4 space-y-4',
                  isTerminal ? 'scrollbar-thin scrollbar-thumb-[#50fa7b]/20' : ''
                )}>
                  {/* Post excerpt */}
                  {node.data?.excerpt && (
                    <div className={cn(
                      'p-3 rounded-lg',
                      isTerminal ? 'bg-[#50fa7b]/5 border border-[#50fa7b]/10' : 'bg-gray-50'
                    )}>
                      <p className={cn(
                        'text-sm',
                        isTerminal ? 'font-mono text-[#50fa7b]/80' : 'text-muted-foreground'
                      )}>
                        {node.data.excerpt}
                      </p>
                    </div>
                  )}
                  
                  {/* Tags */}
                  {node.data?.tags?.length > 0 && (
                    <div className='flex flex-wrap gap-1.5'>
                      {node.data.tags.map((tag: string) => (
                        <span
                          key={tag}
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full',
                            isTerminal
                              ? 'bg-[#50fa7b]/10 text-[#50fa7b]/80 font-mono'
                              : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  {/* Related AI Chats */}
                  {relatedContent.chats.length > 0 && (
                    <div>
                      <h4 className={cn(
                        'flex items-center gap-2 text-sm font-medium mb-2',
                        isTerminal ? 'font-mono text-[#bd93f9]' : 'text-purple-600'
                      )}>
                        <Sparkles className='h-3.5 w-3.5' />
                        AI Conversations ({relatedContent.chats.length})
                      </h4>
                      <div className='space-y-2'>
                        {relatedContent.chats.slice(0, 5).map((chat) => (
                          <div
                            key={chat.id}
                            className={cn(
                              'p-2.5 rounded-lg text-sm cursor-pointer transition-colors',
                              isTerminal
                                ? 'bg-[#bd93f9]/10 hover:bg-[#bd93f9]/20 border border-[#bd93f9]/20'
                                : 'bg-purple-50 hover:bg-purple-100'
                            )}
                          >
                            <p className={cn(
                              'font-medium line-clamp-1',
                              isTerminal ? 'font-mono text-[#bd93f9]' : 'text-purple-700'
                            )}>
                              {chat.title || chat.summary || 'AI Chat Session'}
                            </p>
                            {chat.updatedAt && (
                              <p className={cn(
                                'text-xs mt-0.5 flex items-center gap-1',
                                isTerminal ? 'text-[#bd93f9]/60' : 'text-purple-500'
                              )}>
                                <Calendar className='h-3 w-3' />
                                {new Date(chat.updatedAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Related Memos */}
                  {relatedContent.memos.length > 0 && (
                    <div>
                      <h4 className={cn(
                        'flex items-center gap-2 text-sm font-medium mb-2',
                        isTerminal ? 'font-mono text-[#8be9fd]' : 'text-cyan-600'
                      )}>
                        <PenLine className='h-3.5 w-3.5' />
                        Saved Memos ({relatedContent.memos.length})
                      </h4>
                      <div className='space-y-2'>
                        {relatedContent.memos.slice(0, 5).map((memo, i) => (
                          <div
                            key={`memo-${i}`}
                            className={cn(
                              'p-2.5 rounded-lg text-sm',
                              isTerminal
                                ? 'bg-[#8be9fd]/10 border border-[#8be9fd]/20'
                                : 'bg-cyan-50'
                            )}
                          >
                            <p className={cn(
                              'line-clamp-2',
                              isTerminal ? 'font-mono text-[#8be9fd]/80' : 'text-cyan-700'
                            )}>
                              {memo.label || memo.content || 'Memo saved'}
                            </p>
                            <p className={cn(
                              'text-xs mt-1 flex items-center gap-1',
                              isTerminal ? 'text-[#8be9fd]/60' : 'text-cyan-500'
                            )}>
                              <Calendar className='h-3 w-3' />
                              {new Date(memo.t).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Related Thoughts */}
                  {relatedContent.thoughts.length > 0 && (
                    <div>
                      <h4 className={cn(
                        'flex items-center gap-2 text-sm font-medium mb-2',
                        isTerminal ? 'font-mono text-[#ffb86c]' : 'text-amber-600'
                      )}>
                        <Lightbulb className='h-3.5 w-3.5' />
                        Thoughts ({relatedContent.thoughts.length})
                      </h4>
                      <div className='space-y-2'>
                        {relatedContent.thoughts.slice(0, 5).map((thought, i) => (
                          <div
                            key={`thought-${i}`}
                            className={cn(
                              'p-2.5 rounded-lg text-sm',
                              isTerminal
                                ? 'bg-[#ffb86c]/10 border border-[#ffb86c]/20'
                                : 'bg-amber-50'
                            )}
                          >
                            <p className={cn(
                              'line-clamp-3',
                              isTerminal ? 'font-mono text-[#ffb86c]/80' : 'text-amber-700'
                            )}>
                              {thought.content || thought.label || 'Thought captured'}
                            </p>
                            <p className={cn(
                              'text-xs mt-1 flex items-center gap-1',
                              isTerminal ? 'text-[#ffb86c]/60' : 'text-amber-500'
                            )}>
                              <Calendar className='h-3 w-3' />
                              {new Date(thought.t).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* No related content message */}
                  {relatedContent.chats.length === 0 && 
                   relatedContent.memos.length === 0 && 
                   relatedContent.thoughts.length === 0 && (
                    <div className={cn(
                      'text-center py-6',
                      isTerminal ? 'text-[#50fa7b]/40' : 'text-muted-foreground'
                    )}>
                      <MessageSquare className='h-8 w-8 mx-auto mb-2 opacity-50' />
                      <p className={cn('text-sm', isTerminal && 'font-mono')}>
                        {isTerminal ? '// no related content yet' : 'No related content yet'}
                      </p>
                      <p className={cn('text-xs mt-1', isTerminal && 'font-mono')}>
                        {isTerminal 
                          ? '// use ai chat or memo pad on this post'
                          : 'Use AI Chat or Memo Pad while reading this post'}
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Footer actions */}
                <div className={cn(
                  'p-4 border-t',
                  isTerminal ? 'border-[#50fa7b]/10' : 'border-gray-100'
                )}>
                  <Button
                    className={cn(
                      'w-full gap-2',
                      isTerminal && 'bg-[#50fa7b] text-[#052e16] hover:bg-[#50fa7b]/80 font-mono font-semibold'
                    )}
                    onClick={() => {
                      if (node.type === 'post' && node.data) {
                        navigate(`/blog/${node.data.year}/${node.data.slug}`);
                      }
                    }}
                  >
                    <ExternalLink className='h-4 w-4' />
                    {isTerminal ? '> open_post' : 'Open Post'}
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default Insight;
