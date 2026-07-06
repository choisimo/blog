import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ProjectCard,
  normalizeProjectCardUrl,
} from '@/components/features/projects/ProjectCard';
import type { ProjectItem } from '@/types/project';

function makeProject(overrides: Partial<ProjectItem> = {}): ProjectItem {
  return {
    id: 'project-1',
    title: 'Project One',
    description: 'A useful project',
    category: 'Tools',
    status: 'live',
    type: 'link',
    tags: ['react', 'testing'],
    url: 'https://example.com/project',
    ...overrides,
  } as ProjectItem;
}

describe('normalizeProjectCardUrl', () => {
  it('allows http, https, and site-relative urls only', () => {
    expect(normalizeProjectCardUrl(' https://example.com/demo ')).toBe(
      'https://example.com/demo'
    );
    expect(normalizeProjectCardUrl('http://example.com')).toBe(
      'http://example.com/'
    );
    expect(normalizeProjectCardUrl('/projects/demo')).toBe('/projects/demo');
    expect(normalizeProjectCardUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeProjectCardUrl('data:text/html,hello')).toBeUndefined();
    expect(normalizeProjectCardUrl('example.com')).toBeUndefined();
  });
});

describe('ProjectCard link boundaries', () => {
  it('renders safe project and code urls as links', () => {
    render(
      <ProjectCard
        project={makeProject({
          url: 'https://example.com/project',
          codeUrl: '/repos/project-1',
        })}
        onPreview={vi.fn()}
      />
    );

    expect(screen.getByRole('link', { name: /visit/i })).toHaveAttribute(
      'href',
      'https://example.com/project'
    );
    expect(screen.getByRole('link', { name: /code/i })).toHaveAttribute(
      'href',
      '/repos/project-1'
    );
  });

  it('disables visit and code actions instead of rendering unsafe links', () => {
    render(
      <ProjectCard
        project={makeProject({
          url: 'javascript:alert(1)',
          codeUrl: 'data:text/html,hello',
        })}
        onPreview={vi.fn()}
      />
    );

    expect(screen.queryByRole('link', { name: /visit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /code/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /visit/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /code/i })).toBeDisabled();
  });
});
