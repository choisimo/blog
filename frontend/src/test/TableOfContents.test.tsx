import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TableOfContents } from '@/components/features/blog/TableOfContents';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));

vi.mock('@/hooks/ui/use-mobile', () => ({
  useIsMobile: () => true,
}));

vi.mock('@/utils/content/markdownHeadings', () => ({
  buildMarkdownToc: () => [
    { id: ' intro\u0000 ', title: ' Intro\u0000\nHeading ', level: 2.8 },
    { id: 'bad/heading', title: 'Bad heading', level: 2 },
    { id: 'bad%2Fheading', title: 'Encoded separator heading', level: 2 },
    { id: 'bad%00heading', title: 'Encoded control heading', level: 2 },
    { id: '%E0%A4%A', title: 'Malformed heading', level: 2 },
    { id: 'empty-title', title: '\u0000', level: 3 },
    { id: 'deep-heading', title: 'Deep Heading', level: 99 },
  ],
}));

describe('TableOfContents', () => {
  it('normalizes toc ids, titles, and levels before rendering and scrolling', () => {
    const scrollToMock = vi.fn();
    const heading = document.createElement('h2');
    heading.id = 'intro';
    heading.getBoundingClientRect = () => ({ top: 150 }) as DOMRect;
    document.body.appendChild(heading);
    vi.stubGlobal('scrollTo', scrollToMock);

    render(<TableOfContents content="# Intro" />);

    expect(screen.getByText('Intro Heading')).toBeInTheDocument();
    expect(screen.getByText('Deep Heading')).toBeInTheDocument();
    expect(screen.queryByText('Bad heading')).not.toBeInTheDocument();
    expect(screen.queryByText('Encoded separator heading')).not.toBeInTheDocument();
    expect(screen.queryByText('Encoded control heading')).not.toBeInTheDocument();
    expect(screen.queryByText('Malformed heading')).not.toBeInTheDocument();
    expect(screen.queryByText('empty-title')).not.toBeInTheDocument();

    const introButton = screen.getByRole('button', { name: 'Intro Heading' });
    expect(introButton).toHaveAttribute('title', 'Intro Heading');

    fireEvent.click(introButton);
    expect(scrollToMock).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: 'smooth',
    });

    document.body.removeChild(heading);
    vi.unstubAllGlobals();
  });
});
