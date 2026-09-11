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

type RawProjectCatalogRepository = {
  repository?: string;
  url?: string;
  sourceUrl?: string;
  isFork?: boolean;
  isArchived?: boolean;
  isEmpty?: boolean;
  pushedAt?: string;
  languages?: string[];
};

type RawProjectCatalog = {
  checkedAt?: string;
  repositories?: RawProjectCatalogRepository[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseRawManifestItem(value: unknown): RawManifestItem | null {
  return isRecord(value) ? (value as RawManifestItem) : null;
}

function parseProjectsManifest(value: unknown): RawProjectsManifest | null {
  if (!isRecord(value)) return null;

  const items = Array.isArray(value.items)
    ? value.items
        .map(parseRawManifestItem)
        .filter((item): item is RawManifestItem => item !== null)
    : [];

  return {
    total:
      typeof value.total === 'number' && Number.isFinite(value.total)
        ? value.total
        : items.length,
    items,
    generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : undefined,
    format:
      typeof value.format === 'number' && Number.isFinite(value.format)
        ? value.format
        : undefined,
  };
}

function parseProjectCatalog(value: unknown): RawProjectCatalog | null {
  if (!isRecord(value)) return null;

  const repositories = Array.isArray(value.repositories)
    ? value.repositories.filter(isRecord).map((repository) => repository as RawProjectCatalogRepository)
    : [];

  return {
    checkedAt: typeof value.checkedAt === 'string' ? value.checkedAt : undefined,
    repositories,
  };
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeProjectUrl(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '';

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }

  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
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
  const url = normalizeProjectUrl(item.url);

  if (!title || !url) return null;

  const codeUrl = normalizeProjectUrl(item.codeUrl);
  const thumbnail = normalizeProjectUrl(item.thumbnail);
  const category =
    typeof item.category === 'string' && item.category.trim() ? item.category.trim() : 'Web';
  const status =
    typeof item.status === 'string' && item.status.trim() ? item.status.trim() : 'Dev';

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

function normalizeCatalogProject(repository: RawProjectCatalogRepository, index: number): ProjectItem | null {
  const url = normalizeProjectUrl(repository.url);
  if (!url) return null;

  const [, rawTitle] = String(repository.repository || '').split('/');
  const title = rawTitle?.trim() || `Repository ${index + 1}`;
  const languages = sanitizeStringArray(repository.languages);
  const category = languages[0] || 'Web';
  const status = repository.isEmpty
    ? '빈 저장소'
    : repository.isArchived
      ? '보관'
      : repository.isFork
        ? '포크'
        : '공개';
  const tags = [...new Set([category, repository.isFork ? '포크' : '원본', ...languages])];

  return {
    id: `catalog-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || index + 1}`,
    title,
    description: `${title} 공개 저장소 항목입니다. 검토된 저장소 메타데이터를 바탕으로 복구된 프로젝트 카드입니다.`,
    date: toSafeDate(repository.pushedAt),
    category,
    tags,
    stack: languages,
    status,
    type: 'link',
    url,
    codeUrl: normalizeProjectUrl(repository.sourceUrl) || url,
    featured: false,
  };
}

function sortProjects(items: ProjectItem[]): ProjectItem[] {
  return items.sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export class ProjectService {
  private static cache: ProjectsManifest | null = null;

  private static getBasePath(): string {
    const base = import.meta.env.BASE_URL ?? '/';
    return base.replace(/\/$/, '');
  }

  private static async fetchJson(pathname: string): Promise<unknown> {
    const base = this.getBasePath();
    const cacheBust = import.meta.env.PROD ? `?v=${Date.now()}` : '';
    const url = `${base}${pathname}${cacheBust}`;
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Failed to load ${pathname}: ${response.status}`);
    }
    return response.json();
  }

  private static async loadManifest(): Promise<ProjectsManifest | null> {
    try {
      const rawManifest = parseProjectsManifest(
        await this.fetchJson('/projects-manifest.json')
      );
      const rawItems = Array.isArray(rawManifest?.items) ? rawManifest.items : [];
      const normalizedItems = sortProjects(
        rawItems
          .map((item, index) => normalizeProject(item, index))
          .filter((item): item is ProjectItem => item !== null)
      );

      if (!normalizedItems.length) {
        return null;
      }

      return {
        total: normalizedItems.length,
        items: normalizedItems,
        generatedAt: rawManifest?.generatedAt || new Date().toISOString(),
        format: rawManifest?.format ?? 1,
      };
    } catch (error) {
      console.error('Error loading projects manifest:', error);
      return null;
    }
  }

  private static async loadCatalogFallback(): Promise<ProjectsManifest | null> {
    try {
      const catalog = parseProjectCatalog(await this.fetchJson('/project-catalog.json'));
      const repositories = Array.isArray(catalog?.repositories) ? catalog.repositories : [];
      const normalizedItems = sortProjects(
        repositories
          .map((repository, index) => normalizeCatalogProject(repository, index))
          .filter((item): item is ProjectItem => item !== null)
      );
      if (!normalizedItems.length) {
        return null;
      }
      return {
        total: normalizedItems.length,
        items: normalizedItems,
        generatedAt: catalog?.checkedAt || new Date().toISOString(),
        format: 1,
      };
    } catch (error) {
      console.error('Error loading project catalog fallback:', error);
      return null;
    }
  }

  static async getAllProjects(): Promise<ProjectItem[]> {
    if (this.cache) return this.cache.items;

    const manifest = (await this.loadManifest()) || (await this.loadCatalogFallback());
    if (!manifest) {
      return [];
    }

    this.cache = manifest;
    return this.cache.items;
  }

  static getTags(projects: ProjectItem[]): string[] {
    return Array.from(new Set(projects.flatMap(project => project.tags))).sort();
  }

  static clearCache(): void {
    this.cache = null;
  }
}
