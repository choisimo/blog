import type { ProjectItem, ProjectType, ProjectsManifest } from '@/types/project';

type RawManifestItem = Partial<ProjectItem> & {
  published?: boolean;
  slug?: string;
};

type RawProjectsManifest = {
  total?: number;
  items?: RawManifestItem[];
  generatedAt?: string;
  format?: number;
};

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeProjectType(value: unknown): ProjectType {
  const normalized = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (normalized === 'console' || normalized === 'embed' || normalized === 'link') {
    return normalized;
  }
  return 'link';
}

function toSafeDate(value: unknown): string {
  const candidate = typeof value === 'string' ? value : '';
  if (!candidate) return '1970-01-01';
  const parsed = new Date(candidate);
  if (Number.isNaN(parsed.getTime())) return '1970-01-01';
  return parsed.toISOString().slice(0, 10);
}

function createId(item: RawManifestItem, index: number): string {
  if (typeof item.id === 'string' && item.id.trim()) return item.id.trim();
  if (typeof item.slug === 'string' && item.slug.trim()) return item.slug.trim();
  if (typeof item.title === 'string' && item.title.trim()) {
    return item.title
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  return `project-${index + 1}`;
}

function normalizeProject(item: RawManifestItem, index: number): ProjectItem | null {
  if (item.published === false) return null;

  const title = typeof item.title === 'string' ? item.title.trim() : '';
  const description = typeof item.description === 'string' ? item.description.trim() : '';
  const url = typeof item.url === 'string' ? item.url.trim() : '';

  if (!title || !url) return null;

  const codeUrl = typeof item.codeUrl === 'string' ? item.codeUrl.trim() : '';
  const thumbnail = typeof item.thumbnail === 'string' ? item.thumbnail.trim() : '';
  const category = typeof item.category === 'string' && item.category.trim()
    ? item.category.trim()
    : 'Web';
  const status = typeof item.status === 'string' && item.status.trim()
    ? item.status.trim()
    : 'Dev';

  return {
    id: createId(item, index),
    title,
    description: description || 'No description provided.',
    date: toSafeDate(item.date),
    category,
    tags: sanitizeStringArray(item.tags),
    stack: sanitizeStringArray(item.stack),
    status,
    type: normalizeProjectType(item.type),
    url,
    codeUrl: codeUrl || undefined,
    thumbnail: thumbnail || undefined,
    featured: Boolean(item.featured),
  };
}

export class ProjectService {
  private static cache: ProjectsManifest | null = null;

  private static getBasePath(): string {
    const base = import.meta.env.BASE_URL ?? '/';
    return base.replace(/\/$/, '');
  }

  private static async loadManifest(): Promise<RawProjectsManifest | null> {
    try {
      const base = this.getBasePath();
      const url = `${base}/projects-manifest.json${import.meta.env.PROD ? `?v=${Date.now()}` : ''}`;
      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Failed to load projects manifest: ${response.status}`);
      }
      return (await response.json()) as RawProjectsManifest;
    } catch (error) {
      console.error('Error loading projects manifest:', error);
      return null;
    }
  }

  static async getAllProjects(): Promise<ProjectItem[]> {
    if (this.cache) return this.cache.items;

    const manifest = await this.loadManifest();
    const rawItems = Array.isArray(manifest?.items) ? manifest?.items : [];

    const normalizedItems = rawItems
      .map((item, index) => normalizeProject(item, index))
      .filter((item): item is ProjectItem => item !== null)
      .sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

    this.cache = {
      total: normalizedItems.length,
      items: normalizedItems,
      generatedAt: manifest?.generatedAt || new Date().toISOString(),
      format: manifest?.format ?? 1,
    };

    return this.cache.items;
  }

  static getTags(projects: ProjectItem[]): string[] {
    return Array.from(new Set(projects.flatMap(project => project.tags))).sort();
  }

  static clearCache(): void {
    this.cache = null;
  }
}
