interface ImportMetaEnv {
  readonly BASE_URL: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
  readonly VITE_SITE_BASE_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_HOST?: string;
  readonly VITE_DEV_PORT?: string;
  readonly VITE_SITE_NAME?: string;
  readonly VITE_AUTHOR_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
