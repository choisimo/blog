export type ProjectCategory = string;
export type ProjectStatus = 'Live' | 'Dev' | 'Archive' | string;
export type ProjectType = 'console' | 'embed' | 'link';

export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  date: string;
  category: ProjectCategory;
  tags: string[];
  stack: string[];
  status: ProjectStatus;
  type: ProjectType;
  url: string;
  codeUrl?: string;
  thumbnail?: string;
  featured?: boolean;
}

export interface ProjectsManifest {
  total: number;
  items: ProjectItem[];
  generatedAt: string;
  format: number;
}
