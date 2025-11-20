export type SupportedLanguage = 'ko' | 'en';

export interface LocalizedPostFields {
  title: string;
  description: string;
  excerpt?: string;
  content?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  description: string;
  excerpt?: string;
  date: string;
  year: string;
  category: string;
  tags: string[];
  content: string;
  slug: string;
  language: SupportedLanguage;
  readTime?: number;
  readingTime?: string;
  author?: string;
  published?: boolean;
  coverImage?: string;
  defaultLanguage?: SupportedLanguage;
  availableLanguages?: SupportedLanguage[];
  translations?: Partial<Record<SupportedLanguage, LocalizedPostFields>>;
}

export interface BlogCategory {
  name: string;
  count: number;
  slug: string;
}

export interface BlogTag {
  name: string;
  count: number;
  slug: string;
}

// Generic page result for paginated queries
export interface PostsPage<T = BlogPost> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}
