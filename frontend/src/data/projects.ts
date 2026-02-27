import { ProjectService } from '@/services/projectService';
import type { ProjectItem } from '@/types/project';

export type { ProjectCategory, ProjectStatus, ProjectType, ProjectItem } from '@/types/project';

export const getProjects = async (): Promise<ProjectItem[]> => {
  return ProjectService.getAllProjects();
};

export const getProjectTags = (projects: ProjectItem[]): string[] => {
  return ProjectService.getTags(projects);
};

export const clearProjectsCache = (): void => {
  ProjectService.clearCache();
};
