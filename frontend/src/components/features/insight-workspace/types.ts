import type { BlogPost } from "@/types/blog";
import type { ChatSessionMeta } from "@/services/chat";

export type InsightPostKey = `${string}/${string}`;

export type InsightNodeType =
  | "post"
  | "chat"
  | "memo"
  | "thought"
  | "tag"
  | "search";

export type InsightGraphNode = {
  id: string;
  type: InsightNodeType;
  label: string;
  postKey?: InsightPostKey;
  x: number;
  y: number;
  weight: number;
  ts?: number;
  post?: BlogPost;
  chat?: ChatSessionMeta;
  detail?: string;
};

export type InsightGraphEdge = {
  id: string;
  source: string;
  target: string;
  weight: number;
  type: "category" | "tag" | "chat" | "memo" | "thought" | "activity";
};

export type InsightGraph = {
  nodes: InsightGraphNode[];
  edges: InsightGraphEdge[];
  updatedAt: number;
};

export type AiMemoEventRecord = {
  t?: unknown;
  type?: unknown;
  label?: unknown;
  content?: unknown;
  page?: {
    post?: {
      year?: unknown;
      slug?: unknown;
      title?: unknown;
    } | null;
  } | null;
};

export type CuriosityEventLike = {
  id?: unknown;
  type?: unknown;
  ts?: unknown;
  context?: {
    postId?: unknown;
    tag?: unknown;
    queryHash?: unknown;
    queryText?: unknown;
    snippet?: unknown;
  } | null;
};

export type BuildInsightGraphInput = {
  posts: BlogPost[];
  chatSessions: ChatSessionMeta[];
  aiMemoEvents: AiMemoEventRecord[];
  curiosityEvents: CuriosityEventLike[];
  maxPosts?: number;
};

export type InsightWorkspaceItemKind = "post" | "memo" | "chat" | "thought";

export type InsightWorkspaceItem = {
  id: string;
  kind: InsightWorkspaceItemKind;
  title: string;
  subtitle?: string;
  nodeId?: string;
  postKey?: InsightPostKey;
  createdAt: number;
};

export type InsightActionStatus =
  | { tone: "idle"; message: string }
  | { tone: "success"; message: string }
  | { tone: "warning"; message: string }
  | { tone: "error"; message: string };
