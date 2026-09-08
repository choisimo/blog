import type { HomeEditorPicksSectionProps } from './home.types';
import { HomePostListSkeleton } from './HomePostListSkeleton';
import { Link } from 'react-router-dom';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { PageHeader } from '@/components/organisms/layout';
import { ContentStatus } from '@/components/molecules/ContentStatus';
import { formatDate } from '@/utils/content/blog';

const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;
const CONTROL_TEXT_DETECTOR = /[\u0000-\u001f\u007f-\u009f]/;
const UNSAFE_BLOG_SEGMENT_PATTERN = /[\\/#?]/;

type EditorPickItem = {
  post: HomeEditorPicksSectionProps['posts'][number];
  year: string;
  slug: string;
  title: string;
  category: string;
  readingTime: string;
};

function sanitizeDisplayText(value: unknown): string {
  return String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
}

function normalizeBlogPathSegment(value: unknown): string | null {
  const segment = sanitizeDisplayText(value);
  if (!segment || UNSAFE_BLOG_SEGMENT_PATTERN.test(segment)) return null;

  let decodedSegment: string;
  try {
    decodedSegment = decodeURIComponent(segment);
  } catch {
    return null;
  }

  if (
    !decodedSegment ||
    decodedSegment === '.' ||
    decodedSegment === '..' ||
    CONTROL_TEXT_DETECTOR.test(decodedSegment) ||
    UNSAFE_BLOG_SEGMENT_PATTERN.test(decodedSegment)
  ) {
    return null;
  }

  return segment;
}

function buildEditorPickItems(
  posts: HomeEditorPicksSectionProps['posts']
): EditorPickItem[] {
  return posts.slice(0, 4).reduce<EditorPickItem[]>((items, post) => {
    const year = normalizeBlogPathSegment(post.year);
    const slug = normalizeBlogPathSegment(post.slug);
    if (!year || !slug) return items;

    items.push({
      post,
      year,
      slug,
      title: sanitizeDisplayText(post.title),
      category: sanitizeDisplayText(post.category),
      readingTime: sanitizeDisplayText(post.readingTime),
    });

    return items;
  }, []);
}

export function HomeEditorPicksSection({
  posts,
  state,
  notice,
  isTerminal,
}: HomeEditorPicksSectionProps) {
  const editorPickItems = buildEditorPickItems(posts);
  const sanitizedNotice = sanitizeDisplayText(notice);

  return (
    <section
      className='ui-home__section ui-editor-picks'
      aria-labelledby='home-picks-title'
    >
      <PageHeader
        level={2}
        id='home-picks-title'
        title={isTerminal ? '// editor_picks' : "Editor's Picks"}
        actions={
          <Link to='/blog' className='ui-inline-link'>
            전체 보기
          </Link>
        }
      />
      {sanitizedNotice && (
        <ContentStatus kind='notice'>{sanitizedNotice}</ContentStatus>
      )}
      {state === 'loading' ? (
        <>
          <ContentStatus kind='loading'>
            추천 글을 불러오는 중입니다.
          </ContentStatus>
          <HomePostListSkeleton lead count={4} />
        </>
      ) : editorPickItems.length === 0 ? (
        <ContentStatus kind={state === 'error' ? 'error' : 'empty'}>
          {state === 'error'
            ? '추천 글을 불러오지 못했습니다.'
            : '추천 포스트를 준비 중입니다.'}
        </ContentStatus>
      ) : (
        <div className='ui-picks-list'>
          {editorPickItems.map(
            ({ post, year, slug, title, category, readingTime }, index) => (
              <Link
                key={`${year}/${slug}`}
                to={`/blog/${year}/${slug}`}
                className={`ui-pick${index === 0 ? ' ui-pick--lead' : ''}${post.coverImage ? ' ui-pick--image' : ''}`}
              >
                <article className='ui-pick__body'>
                  <div className='ui-post-meta'>
                    <span>{category}</span>
                    <span>{formatDate(post.date)}</span>
                    {readingTime && <span>{readingTime}</span>}
                  </div>
                  <h3 className='ui-pick__title'>{title}</h3>
                  {index === 0 && (post.excerpt || post.description) && (
                    <p className='ui-pick__excerpt'>
                      {sanitizeDisplayText(post.excerpt || post.description)}
                    </p>
                  )}
                </article>
                {post.coverImage && (
                  <div className='ui-pick__cover'>
                    <OptimizedImage
                      src={post.coverImage}
                      alt={title}
                      className='ui-pick__image'
                    />
                  </div>
                )}
              </Link>
            )
          )}
        </div>
      )}
    </section>
  );
}
