export interface BlogPost {
  id: string;
  title: string;
  description: string;
  date: string;
  year: string;
  category: string;
  tags: string[];
  content: string;
  slug: string;
  readTime?: number;
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