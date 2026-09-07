import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MarkdownTable } from '@/components/molecules/MarkdownTable';
import { ReadingProgress } from '@/components/common/ReadingProgress';

vi.mock('@/contexts/ThemeContext', () => ({ useTheme: () => ({ isTerminal: false }) }));

describe('reading scroll surfaces', () => {
  it('forwards a sanitized label and keyboard focus to the actual scroll viewport', () => {
    render(<ScrollArea viewportProps={{ tabIndex: 0, role: 'region', 'aria-label': '\u001b[31mContents\u001b[0m\u0000' }}>Text</ScrollArea>);
    expect(screen.getByRole('region', { name: 'Contents' })).toHaveAttribute('data-radix-scroll-area-viewport');
    expect(screen.getByRole('region', { name: 'Contents' })).toHaveAttribute('tabindex', '0');
  });

  it('uses a single focusable table wrapper and reveals a hint only when it overflows', () => {
    render(<MarkdownTable><tbody><tr><td>First</td><td>Second</td></tr></tbody></MarkdownTable>);
    const region = screen.getByRole('region', { name: '표 내용' });
    expect(screen.getByRole('table').parentElement).toBe(region);
    expect(screen.queryByText('좌우로 스크롤하면 표의 나머지 열을 볼 수 있습니다.')).not.toBeInTheDocument();
    Object.defineProperties(region, { scrollWidth: { configurable: true, value: 900 }, clientWidth: { configurable: true, value: 320 } });
    fireEvent(window, new Event('resize'));
    expect(screen.getByRole('region', { name: '표 내용. 가로로 스크롤할 수 있습니다.' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByText('좌우로 스크롤하면 표의 나머지 열을 볼 수 있습니다.')).toBeInTheDocument();
  });

  it('measures only the requested article instead of the full document', () => {
    const article = document.createElement('section');
    article.dataset.readingTest = '';
    article.getBoundingClientRect = () => ({ top: 100, height: 300 } as DOMRect);
    document.body.append(article);
    try {
      render(<ReadingProgress targetSelector='[data-reading-test]' />);
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    } finally { article.remove(); }
  });
});
