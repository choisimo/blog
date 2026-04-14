interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly VITE_SITE_BASE_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_CHAT_BASE_URL?: string;
  readonly VITE_CHAT_API_KEY?: string;
  readonly VITE_CHAT_WS_URL?: string;
  readonly VITE_CHAT_WS_ENABLED?: string;
  readonly VITE_AI_UNIFIED?: string;
  readonly VITE_FEATURE_FAB?: string;
  readonly VITE_DEV_HOST?: string;
  readonly VITE_DEV_PORT?: string;
  readonly VITE_SITE_NAME?: string;
  readonly VITE_AUTHOR_NAME?: string;
  readonly VITE_TERMINAL_GATEWAY_URL?: string;
  readonly VITE_EMAILJS_SERVICE_ID?: string;
  readonly VITE_EMAILJS_TEMPLATE_ID?: string;
  readonly VITE_EMAILJS_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
  readonly glob: <T = unknown>(
    pattern: string,
  ) => Record<string, () => Promise<T>>;
}
