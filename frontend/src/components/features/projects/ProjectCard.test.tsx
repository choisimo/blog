import type { ProjectItem } from '@/types/project';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ProjectCard,
  normalizeProjectCardText,
  normalizeProjectCardUrl,
} from './ProjectCard';

function project(overrides: Partial<ProjectItem> = {}): ProjectItem {
  return {
    id: 'project-1',
    title: 'Safe project',
    description: 'Safe description',
    category: 'Tools',
    status: 'live',
    type: 'link',
    url: '/projects/safe',
    codeUrl: 'https://example.test/repo',
    thumbnail: '/images/project.png',
    tags: ['AI', 'Tools'],
    ...overrides,
  } as ProjectItem;
}

describe('ProjectCard', () => {
  it('sanitizes card text, image alt text, tags, and action labels', () => {
    const onPreview = vi.fn();
    const { container } = render(
      <ProjectCard
        project={project({
          title: '\u001b[31mSafe project\u0000',
          description: '\u001b[32mSafe description\u0007',
          category: '\u001b[33mTools\u0000',
          status: '\u001b[34mlive\u0000' as ProjectItem['status'],
          tags: ['\u001b[35mAI\u0000', '\u0000', 'Tools\u0007'],
        })}
        onPreview={onPreview}
        label={'\u001b[36mProject\u0000'}
        title={'\u001b[31mCard title\u0007'}
        visitLabel={'\u001b[32mOpen\u0000'}
        codeLabel={'\u001b[33mSource\u0000'}
      />
    );

    expect(container.querySelector('[aria-label="Project: Safe project"]')).toHaveAttribute(
      'title',
      'Card title'
    );
    expect(screen.getByRole('img', { name: 'Safe project thumbnail' })).toHaveAttribute(
      'src',
      '/images/project.png'
    );
    expect(screen.getByText('Safe description')).toBeInTheDocument();
    expect(screen.getByText('live')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('Tools')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute(
      'href',
      '/projects/safe'
    );
    expect(screen.getByRole('link', { name: 'Source' })).toHaveAttribute(
      'href',
      'https://example.test/repo'
    );
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('keeps preview callback payload unchanged while exposing a sanitized preview label', () => {
    const onPreview = vi.fn();
    const rawProject = project({ title: '\u001b[31mPreview target\u0000' });
    render(<ProjectCard project={rawProject} onPreview={onPreview} />);

    fireEvent.click(screen.getByRole('button', { name: 'Preview: Preview target' }));

    expect(onPreview).toHaveBeenCalledWith(rawProject);
  });

  it('falls back to category artwork and disabled unsafe links', () => {
    render(
      <ProjectCard
        project={project({
          thumbnail: 'javascript:alert(1)',
          url: 'https://user:pass@example.test/project',
          codeUrl: 'data:text/html,unsafe',
          category: '\u001b[31mFallback category\u0000',
        })}
        onPreview={vi.fn()}
      />
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Fallback category')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Visit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Code' })).toBeDisabled();
  });

  it('normalizes only safe project URLs', () => {
    expect(normalizeProjectCardUrl('/projects/safe')).toBe('/projects/safe');
    expect(normalizeProjectCardUrl('https://example.test/project')).toBe(
      'https://example.test/project'
    );
    expect(normalizeProjectCardUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeProjectCardUrl('https://user:pass@example.test/project')).toBeUndefined();
    expect(normalizeProjectCardUrl('/projects/%0Aunsafe')).toBeUndefined();
  });

  it('strips OSC and CSI ANSI escape sequences from card text', () => {
    expect(
      normalizeProjectCardText(
        '\u001b]0;Hidden title\u0007Visible \u001b[31mproject\u001b[0m\u0000'
      )
    ).toBe('Visible project');
  });
});
