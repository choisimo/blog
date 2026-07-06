import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import {
  ProjectModal,
  normalizeProjectPreviewUrl,
} from '@/components/features/projects/ProjectModal';
import type { ProjectItem } from '@/types/project';

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({
    children,
    hideClose: _hideClose,
    ...props
  }: HTMLAttributes<HTMLDivElement> & { hideClose?: boolean }) => (
    <div {...props}>{children}</div>
  ),
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    asChild,
    children,
    variant: _variant,
    size: _size,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
    variant?: string;
    size?: string;
  }) =>
    asChild ? (
      <>{children}</>
    ) : (
      <button type='button' {...props}>
        {children}
      </button>
    ),
}));

vi.mock('@/components/molecules/AIConsole', () => ({
  AIConsole: () => <div>Console preview</div>,
}));

function makeProject(overrides: Partial<ProjectItem> = {}): ProjectItem {
  return {
    id: 'project-1',
    title: 'Project One',
    description: 'A useful project',
    category: 'Tools',
    status: 'live',
    type: 'embed',
    tags: ['react'],
    url: 'https://example.com/demo',
    ...overrides,
  } as ProjectItem;
}

describe('normalizeProjectPreviewUrl', () => {
  it('allows only http, https, and site-relative preview urls', () => {
    expect(normalizeProjectPreviewUrl(' https://example.com/demo ')).toBe(
      'https://example.com/demo'
    );
    expect(normalizeProjectPreviewUrl('http://example.com')).toBe(
      'http://example.com/'
    );
    expect(normalizeProjectPreviewUrl('/projects/demo')).toBe('/projects/demo');
    expect(normalizeProjectPreviewUrl('//example.com/demo')).toBeUndefined();
    expect(normalizeProjectPreviewUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeProjectPreviewUrl('data:text/html,hello')).toBeUndefined();
  });
});

describe('ProjectModal preview URL boundary', () => {
  it('renders safe embed previews and open links with normalized urls', () => {
    render(
      <ProjectModal
        open
        project={makeProject({ url: ' https://example.com/demo ' })}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.getByRole('link', { name: /open/i })).toHaveAttribute(
      'href',
      'https://example.com/demo'
    );
    expect(screen.getByTitle('Project One preview')).toHaveAttribute(
      'src',
      'https://example.com/demo'
    );
    expect(screen.getByRole('button', { name: /fullscreen/i })).toBeInTheDocument();
  });

  it('does not render links, fullscreen, or iframe for unsafe embed urls', () => {
    render(
      <ProjectModal
        open
        project={makeProject({ url: 'javascript:alert(1)' })}
        onOpenChange={vi.fn()}
      />
    );

    expect(screen.queryByRole('link', { name: /open/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /fullscreen/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByTitle('Project One preview')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'This project cannot be embedded due to security policy. Use the Open button.'
      )
    ).toBeInTheDocument();
  });
});
