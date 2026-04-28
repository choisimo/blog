import type { SelectedBlockAttachment } from '@/services/chat';

export type SelectedBlockEventPayload = {
  text?: string;
  markdown?: string;
  html?: string;
  title?: string;
  url?: string;
  message?: string;
  post?: {
    year?: string;
    slug?: string;
    title?: string;
  } | null;
};

export type { SelectedBlockAttachment };
