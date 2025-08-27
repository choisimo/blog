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
  readTime?: number;
  readingTime?: string;
  author?: string;
  published?: boolean;
  coverImage?: string;
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
