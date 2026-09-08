import type { HomeLatestPostsSectionProps } from './home.types';
import { HomePostListSkeleton } from './HomePostListSkeleton';
import { Link } from 'react-router-dom';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { PageHeader } from '@/components/organisms/layout';
import { ContentStatus } from '@/components/molecules/ContentStatus';
import { formatDate } from '@/utils/content/blog';

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const HAS_CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]/;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeHomeText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const normalized = String(value)
    .replace(CONTROL_TEXT_PATTERN, ' ')
    .replace(COLLAPSED_WHITESPACE_PATTERN, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeHomePathSegment(value: unknown): string | null {
  const normalized = normalizeHomeText(value);
  if (!normalized || normalized.includes('/') || normalized.includes('\\'))
    return null;
  try {
    const decoded = decodeURIComponent(normalized);
    if (
      !decoded.trim() ||
      decoded === '.' ||
      decoded === '..' ||
      HAS_CONTROL_TEXT_PATTERN.test(decoded) ||
      decoded.includes('/') ||
      decoded.includes('\\')
    ) {
      return null;
    }
    return encodeURIComponent(decoded.trim());
  } catch {
    return null;
  }
}

function normalizeHomeCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.trunc(value))
    : 0;
}

export function HomeLatestPostsSection({
  posts,
  tags,
  state,
  error,
  isTerminal,
}: HomeLatestPostsSectionProps) {
  const safePosts = posts.flatMap((post) => {
    const year = normalizeHomePathSegment(post.year);
    const slug = normalizeHomePathSegment(post.slug);
    if (!year || !slug || !/^\d{4}$/.test(year)) return [];
    return [{
      ...post,
      year,
      slug,
      title: normalizeHomeText(post.title, 'Untitled post'),
      category: normalizeHomeText(post.category, 'Post'),
      description: normalizeHomeText(post.description),
      readingTime: normalizeHomeText(post.readingTime),
    }];
  });
  const safeTags = tags.flatMap((tag) => {
    const name = normalizeHomeText(tag.name);
    if (!name || name.includes('/') || name.includes('\\')) return [];
    return [{ ...tag, name, count: normalizeHomeCount(tag.count) }];
  });
  const safeError = normalizeHomeText(error, '최신 글을 불러오지 못했습니다.');

  return (
    <section className='ui-home__section' aria-labelledby='home-latest-title'>
      <PageHeader
        level={2}
        id='home-latest-title'
        title={isTerminal ? '// latest_posts' : 'Latest Posts'}
        actions={
          <Link to='/blog' className='ui-inline-link'>
            전체 보기
          </Link>
        }
      />
      <div className='ui-home-reading-grid'>
        <div className='ui-latest-list'>
          {state === 'error' ? (
            <ContentStatus kind='error'>{safeError}</ContentStatus>
          ) : state === 'loading' ? (
            <>
              <ContentStatus kind='loading'>
                최신 글을 불러오는 중입니다.
              </ContentStatus>
              <HomePostListSkeleton />
            </>
          ) : safePosts.length === 0 ? (
            <ContentStatus kind='empty'>
              아직 공개된 글이 없습니다.
            </ContentStatus>
          ) : (
            safePosts.map(post => (
              <Link
                key={`${post.year}/${post.slug}`}
                to={`/blog/${post.year}/${post.slug}`}
                className={`ui-post-row${post.coverImage ? ' ui-post-row--image' : ''}`}
              >
                <article>
                  <div className='ui-post-meta'>
                    <span>{post.category}</span>
                    <span>{formatDate(post.date)}</span>
                    {post.readingTime && <span>{post.readingTime}</span>}
                  </div>
                  <h3 className='ui-post-row__title'>{post.title}</h3>
                  {post.description && (
                    <p className='ui-post-row__description'>
                      {post.description}
                    </p>
                  )}
                </article>
                {post.coverImage && (
                  <div className='ui-post-row__cover'>
                    <OptimizedImage
                      src={post.coverImage}
                      alt={post.title}
                      className='ui-pick__image'
                    />
                  </div>
                )}
              </Link>
            ))
          )}
        </div>
        <aside className='ui-home-rail' aria-labelledby='home-tags-title'>
          <h3 id='home-tags-title'>Popular Tags</h3>
          {safeTags.length === 0 ? (
            <p className='ui-home-rail__notice'>표시할 태그가 없습니다.</p>
          ) : (
            <div className='ui-topic-list'>
              {safeTags.slice(0, 6).map(tag => (
                <Link
                  key={tag.name}
                  to={`/blog?tag=${encodeURIComponent(tag.name)}`}
                  className='ui-topic-link'
                >
                  <span>#{tag.name}</span>
                  <span className='ui-topic-count'>{tag.count}</span>
                </Link>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
