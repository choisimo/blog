import type { LucideIcon } from "lucide-react";

// Shell command definitions
export type ShellCommand = {
  name: string;
  aliases: string[];
  description: string;
  action: (args?: string) => void;
};

// Virtual filesystem types for blog navigation
export type BlogPost = {
  slug: string;
  title: string;
  category: string;
  date: string;
  tags: string[];
  url: string;
};

export type VirtualFS = {
  currentPath: string;
  posts: BlogPost[];
};

export type DockAction = {
  key: "chat" | "memo" | "stack" | "insight";
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  badge?: boolean;
  primary?: boolean;
};

export type ShellLog = {
  type: "input" | "output";
  text: string;
};
