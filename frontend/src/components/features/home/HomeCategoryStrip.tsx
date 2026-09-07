import type { HomeCategoryStripProps } from './home.types';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/organisms/layout';
import { ContentStatus } from '@/components/molecules/ContentStatus';

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeCategoryName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  if (!normalized || normalized.includes('/') || normalized.includes('\\')) {
    return null;
  }
  return normalized;
}

function normalizeCategoryCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

export function HomeCategoryStrip({
  categories,
  state,
  isTerminal,
}: HomeCategoryStripProps) {
  const shown = categories
    .flatMap((category) => {
      const name = normalizeCategoryName(category.name);
      return name ? [{ ...category, name, count: normalizeCategoryCount(category.count) }] : [];
    })
    .slice(0, 6);

  return (
    <section className="ui-home__section" aria-labelledby="home-categories-title">
      <PageHeader level={2} id="home-categories-title" title={isTerminal ? '// categories' : 'Browse Categories'}
        actions={<Link to="/blog" className="ui-inline-link">전체 보기</Link>} />
      {state === 'loading' ? <ContentStatus kind="loading">주제별 글 수를 불러오는 중입니다.</ContentStatus>
        : shown.length === 0 ? <ContentStatus kind={state === 'error' ? 'error' : 'empty'}>{state === 'error' ? '주제 목록을 불러오지 못했습니다.' : '아직 분류된 주제가 없습니다.'}</ContentStatus>
          : <nav className="ui-category-list" aria-label="블로그 주제">{shown.map((category, index) => (
            <Link key={`${category.name}-${index}`} to={`/blog?category=${encodeURIComponent(category.name)}`} className="ui-topic-link">
              <span>{category.name}</span><span className="ui-topic-count">{state === 'error' ? '집계 오류' : `${category.count.toLocaleString()} Posts`}</span>
            </Link>
          ))}</nav>}
    </section>
  );
}
