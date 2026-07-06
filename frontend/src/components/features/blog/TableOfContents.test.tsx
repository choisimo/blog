import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TableOfContents, TocDrawer } from './TableOfContents';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div role='dialog' {...props}>{children}</div>
  ),
  SheetTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props}>{children}</h2>
  ),
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/utils/content/markdownHeadings', () => ({
  buildMarkdownToc: vi.fn(() => [
    { id: 'intro', title: '\u001b[31mIntro\u0000', level: 2 },
    { id: 'bad%2Fid', title: 'Unsafe', level: 2 },
    { id: 'details', title: '\u001b[32mDetails\u0007', level: 3 },
  ]),
}));

class IntersectionObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
}

describe('TableOfContents', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    window.scrollTo = vi.fn();
    document.body.innerHTML = '';
  });

  it('sanitizes labels, heading text, item text, and filters unsafe toc ids', () => {
    const { container } = render(
      <TableOfContents
        content='content'
        label={'\u001b[35mArticle toc\u0000'}
        title={'\u001b[34mTOC title\u0007'}
        headingLabel={'\u001b[31mContents\u0000'}
        itemLabel={'\u001b[32mJump\u0000'}
      />
    );

    expect(screen.getByRole('region', { name: 'Article toc' })).toHaveAttribute(
      'title',
      'TOC title'
    );
    expect(screen.getByText('Contents')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jump 1: Intro' })).toHaveAttribute(
      'aria-current',
      'location'
    );
    expect(screen.getByRole('button', { name: 'Jump 2: Details' })).toBeInTheDocument();
    expect(screen.queryByText('Unsafe')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0000');
  });

  it('scrolls to headings and calls close callback when a toc item is selected', () => {
    const target = document.createElement('h2');
    target.id = 'details';
    target.getBoundingClientRect = () => ({ top: 500 }) as DOMRect;
    document.body.appendChild(target);
    const onClose = vi.fn();

    render(<TableOfContents content='content' onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '목차 항목 2: Details' }));

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: 'smooth',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('sanitizes drawer trigger, close label, sheet label, and nested toc labels', () => {
    const { container } = render(
      <TocDrawer
        content='content'
        label={'\u001b[35mDrawer toc\u0000'}
        title={'\u001b[34mDrawer title\u0007'}
        triggerLabel={'\u001b[31mOpen toc\u0000'}
        closeLabel={'\u001b[32mClose toc\u0000'}
        triggerPlacement='inline'
      />
    );

    expect(screen.getByRole('button', { name: 'Open toc' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Drawer toc' })).toHaveAttribute(
      'title',
      'Drawer title'
    );
    expect(screen.getByRole('button', { name: 'Close toc' })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Drawer toc' })).toHaveLength(1);
    expect(container.textContent).not.toContain('\u001b');
  });
});
