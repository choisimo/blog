/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_BASE_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DEV_HOST?: string;
  readonly VITE_DEV_PORT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
