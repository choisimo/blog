import type { HomeEditorPicksSectionProps } from './home.types';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Clock } from 'lucide-react';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { cn } from '@/lib/utils';
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
    <section className='mb-14'>
      <div className='mb-5 flex items-center justify-between gap-4'>
        <div>
          <h2
            className={cn(
              'my-0 text-2xl font-bold tracking-tight text-[hsl(var(--blog-title))]',
              isTerminal && 'font-mono'
            )}
          >
            {isTerminal ? '// editor_picks' : "Editor's Picks"}
          </h2>
          {sanitizedNotice && (
            <p className='mt-1 text-sm text-muted-foreground'>
              {sanitizedNotice}
            </p>
          )}
        </div>
        <Link
          to='/blog'
          className='inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-muted-foreground transition-[color,transform] duration-200 ease-spring hover:text-primary active:scale-[0.98] whitespace-nowrap'
        >
          전체 보기
          <ArrowRight className='h-4 w-4' />
        </Link>
      </div>

      {state === 'loading' ? (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className='h-[19rem] animate-pulse rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface-muted))]'
            />
          ))}
        </div>
      ) : editorPickItems.length === 0 ? (
        <div className='rounded-lg border border-dashed border-[hsl(var(--blog-border))] px-4 py-8 text-center text-sm text-muted-foreground'>
          추천 포스트를 준비 중입니다.
        </div>
      ) : (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {editorPickItems.map(
            ({ post, year, slug, title, category, readingTime }) => (
            <Link
              key={`${year}/${slug}`}
              to={`/blog/${year}/${slug}`}
              className='group min-w-0 overflow-hidden rounded-lg border border-[hsl(var(--blog-border))] bg-[hsl(var(--blog-surface))] shadow-none transition-[border-color,box-shadow,transform] duration-200 ease-spring hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[var(--blog-shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.99]'
            >
              <div className='aspect-[16/9] overflow-hidden bg-[hsl(var(--blog-surface-muted))]'>
                {post.coverImage ? (
                  <OptimizedImage
                    src={post.coverImage}
                    alt={title}
                    className='h-full w-full object-cover transition-transform duration-300 ease-smooth group-hover:scale-[1.03]'
                  />
                ) : (
                  <div className='flex h-full w-full items-center justify-center'>
                    <BookOpen className='h-7 w-7 text-muted-foreground/50' />
                  </div>
                )}
              </div>
              <div className='space-y-3 p-4'>
                <div className='flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground'>
                  <span className='truncate rounded-md bg-secondary px-2 py-1 text-secondary-foreground'>
                    {category}
                  </span>
                  <span className='inline-flex items-center gap-1 whitespace-nowrap'>
                    <CalendarDays className='h-3 w-3' />
                    {formatDate(post.date)}
                  </span>
                </div>
                <h3 className='my-0 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-[hsl(var(--blog-title))] transition-colors group-hover:text-primary'>
                  {title}
                </h3>
                {readingTime && (
                  <div className='inline-flex items-center gap-1 text-xs text-muted-foreground'>
                    <Clock className='h-3 w-3' />
                    {readingTime}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
