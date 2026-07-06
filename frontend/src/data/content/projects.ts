import { ProjectService } from '@/services/content/projectService';
import type { ProjectItem } from '@/types/project';

export type { ProjectCategory, ProjectStatus, ProjectType, ProjectItem } from '@/types/project';

export const getProjects = async (): Promise<ProjectItem[]> => {
  return ProjectService.getAllProjects();
};

export const normalizeProjectTags = (projects: ProjectItem[]): string[] => {
  const tags = new Set<string>();

  for (const project of projects) {
    const rawTags = Array.isArray((project as { tags?: unknown }).tags)
      ? (project as { tags: unknown[] }).tags
      : [];

    for (const tag of rawTags) {
      if (typeof tag !== 'string') continue;
      const normalized = tag.trim();
      if (!normalized || normalized.toLowerCase() === 'all') continue;
      tags.add(normalized);
    }
  }

  return Array.from(tags).sort();
};

export const getProjectTags = (projects: ProjectItem[]): string[] => {
  return normalizeProjectTags(projects);
};

export const clearProjectsCache = (): void => {
  ProjectService.clearCache();
};
