import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PageContainer } from './PageContainer';
import { PageHeader } from './PageHeader';
import { PublicShell } from './PublicShell';
import { ContentStatus } from '@/components/molecules/ContentStatus';

afterEach(cleanup);

describe('presentation-only layout foundation', () => {
  it('keeps the route as the sole owner of the main landmark', () => {
    render(
      <PublicShell>
        <main id="main-content" tabIndex={-1}>
          <PageContainer width="article" data-testid="container" aria-label="본문">
            <PageHeader title="글 제목" />
          </PageContainer>
        </main>
      </PublicShell>,
    );
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('link', { name: '본문으로 이동' })).toHaveAttribute('href', '#main-content');
    expect(screen.getByTestId('container')).toHaveClass('ui-container--article');
    expect(screen.getByTestId('container')).toHaveAttribute('aria-label', '본문');
  });

  it('uses an h2 for a named section without inventing another page heading', () => {
    render(<PageHeader level={2} id="latest-heading" title="최근 글" description="실제 게시글" actions={<a href="/blog">전체 보기</a>} />);
    expect(screen.getByRole('heading', { name: '최근 글', level: 2 })).toHaveAttribute('id', 'latest-heading');
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '전체 보기' })).toHaveAttribute('href', '/blog');
  });

  it('merges caller layout classes without transferring state ownership', () => {
    render(<PageContainer width="wide" className="page-specific" data-testid="wide">본문</PageContainer>);
    expect(screen.getByTestId('wide')).toHaveClass('ui-container', 'ui-container--wide', 'page-specific');
  });

  it('announces loading locally and exposes a non-busy final state', () => {
    const { rerender } = render(<ContentStatus kind="loading">글을 불러오는 중입니다.</ContentStatus>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    rerender(<ContentStatus kind="empty">공개된 글이 없습니다.</ContentStatus>);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'false');
  });

  it('presents a failed operation as an alert rather than a success toast', () => {
    render(<ContentStatus kind="error">검색 조건은 유지되어 있습니다.</ContentStatus>);
    expect(screen.getByRole('alert')).toHaveTextContent('검색 조건은 유지되어 있습니다.');
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });
});
