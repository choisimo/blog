export type { ChatSessionMeta } from "@/services/chat";

export type SourceLink = {
  title?: string;
  url?: string;
  score?: number;
  snippet?: string;
};

export type SystemMessageLevel = "info" | "warn" | "error";
export type LiveSenderType = "client" | "agent";
export type ChatTransportPhase =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type ChatTransportStatus = {
  phase: ChatTransportPhase;
  label: string;
  detail: string;
  tone: SystemMessageLevel;
  roomLabel: string;
  updatedAt: number;
  onlineCount?: number;
  reconnectAttempts?: number;
};

export type ChatStatusBanner = {
  id: string;
  text: string;
  tone: SystemMessageLevel;
};

export type LiveReplyTarget = {
  name: string;
  senderType: LiveSenderType;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  pending?: boolean;
  typingLabel?: string;
  typingKey?: string;
  channel?: "default" | "live";
  liveSenderType?: LiveSenderType;
  authorName?: string;
  authorMeta?: string;
  systemLevel?: SystemMessageLevel;
  systemKind?: "status" | "error";
  statusSource?: "event" | "command" | "memory";
  transient?: boolean;
  expiresAt?: number;
  sources?: SourceLink[];
  followups?: string[];
};

export type UploadedChatImage = {
  id: string;
  url: string;
  name: string;
  size: number;
};

export type QuestionMode = "article" | "general";
