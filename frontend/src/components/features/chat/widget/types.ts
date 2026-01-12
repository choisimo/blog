export type { ChatSessionMeta } from "@/services/chat";

export type SourceLink = {
  title?: string;
  url?: string;
  score?: number;
  snippet?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
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
