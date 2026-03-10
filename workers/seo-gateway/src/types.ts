export interface Env {
  GITHUB_PAGES_ORIGIN: string;
  API_BASE_URL: string;
  SITE_BASE_URL: string;
  SITE_NAME: string;
}

export interface PostMeta {
  title: string;
  description: string;
  ogImage: string;
  url: string;
  type: 'article' | 'website';
  publishedTime?: string;
  author?: string;
  category?: string;
  tags?: string[];
}

export interface ManifestItem {
  title: string;
  description?: string;
  snippet?: string;
  slug: string;
  year: string;
  date?: string;
  author?: string;
  category?: string;
  tags?: string[];
  coverImage?: string;
  published?: boolean;
}

export interface Manifest {
  format?: number;
  items?: ManifestItem[];
}
