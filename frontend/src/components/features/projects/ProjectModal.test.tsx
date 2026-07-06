import type { HTMLAttributes, ReactNode } from 'react';
import type { ProjectItem } from '@/types/project';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  ProjectModal,
  normalizeProjectModalText,
  normalizeProjectPreviewUrl,
} from './ProjectModal';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({
    open,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
  }) => (open ? <div>{children}</div> : null),
  DialogContent: ({
    children,
    hideClose: _hideClose,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { hideClose?: boolean }) => (
    <div role='dialog' {...props}>
      {children}
    </div>
  ),
  DialogTitle: ({ children, ...props }: HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props}>{children}</h2>
  ),
}));

vi.mock('@/components/molecules/AIConsole', () => ({
  AIConsole: ({ onClose }: { onClose: () => void }) => (
    <button type='button' onClick={onClose}>
      Console close
    </button>
  ),
}));

function project(overrides: Partial<ProjectItem> = {}): ProjectItem {
  return {
    id: 'project-1',
    title: 'Safe project',
    description: 'Safe description',
    category: 'Tools',
    status: 'live',
    type: 'embed',
    url: '/projects/safe',
    codeUrl: 'https://example.test/repo',
    thumbnail: '/images/project.png',
    tags: ['AI'],
    ...overrides,
  } as ProjectItem;
}

describe('ProjectModal', () => {
  it('sanitizes modal title, action labels, and iframe title while preserving safe URLs', () => {
    const { container } = render(
      <ProjectModal
        open
        project={project({
          title: '\u001b[31mSafe project\u0000',
          url: 'https://example.test/project',
        })}
        onOpenChange={vi.fn()}
        label={'\u001b[35mPreview panel\u0000'}
        title={'\u001b[34mPanel title\u0007'}
        openLabel={'\u001b[32mOpen project\u0000'}
        fullscreenLabel={'\u001b[33mExpand project\u0000'}
        closeLabel={'\u001b[36mClose panel\u0000'}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Preview panel: Safe project' })).toHaveAttribute(
      'title',
      'Panel title'
    );
    expect(screen.getByRole('heading', { name: 'Safe project' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open project: Safe project' })).toHaveAttribute(
      'href',
      'https://example.test/project'
    );
    expect(screen.getByRole('button', { name: 'Expand project: Safe project' })).toBeInTheDocument();
    expect(screen.getByTitle('Safe project preview')).toHaveAttribute(
      'src',
      'https://example.test/project'
    );
    expect(screen.getByRole('button', { name: 'Close panel' })).toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('renders console projects and routes console close through onOpenChange', () => {
    const onOpenChange = vi.fn();
    render(
      <ProjectModal
        open
        project={project({ type: 'console', title: 'Console project' })}
        onOpenChange={onOpenChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Console close' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('suppresses unsafe preview URLs and sanitizes fallback copy', () => {
    render(
      <ProjectModal
        open
        project={project({
          title: '\u001b[31mUnsafe project\u0000',
          url: 'https://user:pass@example.test/project',
        })}
        onOpenChange={vi.fn()}
        unavailableMessage={'\u001b[32mCannot embed safely\u0007'}
      />
    );

    expect(screen.queryByRole('link', { name: /Open/ })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Unsafe project preview')).not.toBeInTheDocument();
    expect(screen.getByText('Cannot embed safely')).toBeInTheDocument();
  });

  it('normalizes only safe preview URLs', () => {
    expect(normalizeProjectPreviewUrl('/projects/safe')).toBe('/projects/safe');
    expect(normalizeProjectPreviewUrl('https://example.test/project')).toBe(
      'https://example.test/project'
    );
    expect(normalizeProjectPreviewUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeProjectPreviewUrl('https://user:pass@example.test/project')).toBeUndefined();
    expect(normalizeProjectPreviewUrl('/projects/%0Aunsafe')).toBeUndefined();
  });

  it('strips OSC and CSI ANSI escape sequences from modal text', () => {
    expect(
      normalizeProjectModalText(
        '\u001b]0;Hidden title\u0007Visible \u001b[31mmodal\u001b[0m\u0000'
      )
    ).toBe('Visible modal');
  });
});
