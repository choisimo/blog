import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectService } from '@/services/content/projectService';

describe('project service', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    ProjectService.clearCache();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    ProjectService.clearCache();
    vi.unstubAllGlobals();
  });

  it('skips malformed manifest rows instead of failing the full manifest', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          null,
          'not-an-object',
          {
            id: 'valid-project',
            title: ' Valid Project ',
            description: ' A useful project ',
            url: ' https://example.com/project ',
            date: '2026-07-03',
            type: 'console',
            tags: [' ai ', '', 123],
            stack: [' TypeScript '],
            published: true,
          },
        ],
        generatedAt: 123,
        format: '2',
      }),
    });

    await expect(ProjectService.getAllProjects()).resolves.toEqual([
      {
        id: 'valid-project',
        title: 'Valid Project',
        description: 'A useful project',
        date: '2026-07-03',
        category: 'Web',
        tags: ['ai'],
        stack: ['TypeScript'],
        status: 'Dev',
        type: 'console',
        url: 'https://example.com/project',
        featured: false,
      },
    ]);
  });

  it('falls back to an empty project list for malformed top-level manifests', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ['not-a-manifest'],
    });

    await expect(ProjectService.getAllProjects()).resolves.toEqual([]);
  });

  it('filters unsafe manifest urls before exposing project data', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 'unsafe-project',
            title: 'Unsafe Project',
            url: 'javascript:alert(1)',
            published: true,
          },
          {
            id: 'safe-project',
            title: 'Safe Project',
            url: '/projects/safe-project',
            codeUrl: 'data:text/html,hello',
            thumbnail: 'ftp://example.com/thumbnail.png',
            published: true,
          },
        ],
      }),
    });

    await expect(ProjectService.getAllProjects()).resolves.toEqual([
      {
        id: 'safe-project',
        title: 'Safe Project',
        description: 'No description provided.',
        date: '1970-01-01',
        category: 'Web',
        tags: [],
        stack: [],
        status: 'Dev',
        type: 'link',
        url: '/projects/safe-project',
        featured: false,
      },
    ]);
  });
});
