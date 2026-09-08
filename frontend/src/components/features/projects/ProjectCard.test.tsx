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

    expect(
      container.querySelector('[aria-label="Project: Safe project"]')
    ).toHaveAttribute('title', 'Card title');
    expect(
      screen.getByRole('img', { name: 'Safe project 미리보기' })
    ).toHaveAttribute('src', '/images/project.png');
    expect(screen.getByText('Safe description')).toBeInTheDocument();
    expect(screen.getByText('live')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getAllByText('Tools')[0]).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Open: Safe project · 새 탭' })
    ).toHaveAttribute('href', '/projects/safe');
    expect(
      screen.getByRole('link', { name: 'Source: Safe project · 새 탭' })
    ).toHaveAttribute('href', 'https://example.test/repo');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('keeps preview callback payload unchanged while exposing a sanitized preview label', () => {
    const onPreview = vi.fn();
    const rawProject = project({
      type: 'embed',
      title: '\u001b[31mPreview target\u0000',
    });
    render(<ProjectCard project={rawProject} onPreview={onPreview} />);

    fireEvent.click(
      screen.getByRole('button', { name: '미리보기: Preview target' })
    );

    expect(onPreview).toHaveBeenCalledWith(rawProject);
  });

  it('retains the project description and disables unavailable preview without unsafe links', () => {
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
    expect(
      screen.getByRole('button', { name: 'Visit: Safe project' })
    ).toBeDisabled();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('공개 주소가 아직 없습니다.')).toBeInTheDocument();
  });

  it('normalizes only safe project URLs', () => {
    expect(normalizeProjectCardUrl('/projects/safe')).toBe('/projects/safe');
    expect(normalizeProjectCardUrl('https://example.test/project')).toBe(
      'https://example.test/project'
    );
    expect(normalizeProjectCardUrl('javascript:alert(1)')).toBeUndefined();
    expect(
      normalizeProjectCardUrl('https://user:pass@example.test/project')
    ).toBeUndefined();
    expect(normalizeProjectCardUrl('/projects/%0Aunsafe')).toBeUndefined();
  });

  it('exposes mobile embed navigation as a real link without duplicate service actions', () => {
    const onPreview = vi.fn();
    render(
      <ProjectCard
        project={project({ type: 'embed' })}
        onPreview={onPreview}
        openExternally
        visitLabel='서비스 열기'
      />
    );

    const link = screen.getByRole('link', {
      name: '서비스 열기: Safe project · 새 탭',
    });
    expect(link).toHaveAttribute('href', '/projects/safe');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      screen.queryByRole('button', { name: /미리보기/ })
    ).not.toBeInTheDocument();
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('strips OSC and CSI ANSI escape sequences from card text', () => {
    expect(
      normalizeProjectCardText(
        '\u001b]0;Hidden title\u0007Visible \u001b[31mproject\u001b[0m\u0000'
      )
    ).toBe('Visible project');
  });
});
