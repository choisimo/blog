import { describe, expect, it } from 'vitest';
import {
  getProjectTags,
  normalizeProjectTags,
} from '@/data/content/projects';
import type { ProjectItem } from '@/types/project';

function makeProject(tags: unknown): ProjectItem {
  return {
    id: 'project-1',
    title: 'Project One',
    description: 'A useful project',
    date: '2026-07-03',
    category: 'Tools',
    status: 'live',
    type: 'link',
    url: 'https://example.com',
    tags,
    stack: [],
    featured: false,
  } as ProjectItem;
}

describe('projects data facade', () => {
  it('normalizes tag lists before exposing filter values', () => {
    const projects = [
      makeProject([' react ', '', 'All', 'TypeScript', 'react']),
      makeProject('not-an-array'),
      makeProject(['Testing', 123, ' all ']),
    ];

    expect(normalizeProjectTags(projects)).toEqual([
      'Testing',
      'TypeScript',
      'react',
    ]);
  });

  it('uses the same normalization through getProjectTags', () => {
    expect(getProjectTags([makeProject([' zed ', 'alpha', 'zed'])])).toEqual([
      'alpha',
      'zed',
    ]);
  });
});
