import { Link, useLocation } from 'react-router-dom';
import { BlogPost } from '@/types/blog';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PostNavigationProps {
  currentPost: BlogPost;
  posts: BlogPost[];
  fromState?: unknown;
  label?: string;
  title?: string;
  previousLabel?: string;
  nextLabel?: string;
}

type SafeNavigationPost = BlogPost & {
  safeYear: string;
  safeSlug: string;
  safeTitle: string;
  safePath: string;
};

const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const SINGLE_LINE_CONTROL_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const ENCODED_SINGLE_LINE_CONTROL_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_NAVIGATION_LABEL = 'Post navigation';
const DEFAULT_PREVIOUS_LABEL = 'Previous Post';
const DEFAULT_NEXT_LABEL = 'Next Post';

function decodeNavigationValue(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizeNavigationText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalNavigationText(value: unknown): string | undefined {
  return normalizeNavigationText(value) || undefined;
}

function normalizePathSegment(value: unknown): string | undefined {
  const normalized = normalizeNavigationText(value);
  const decoded = decodeNavigationValue(normalized);
  if (
    !normalized ||
    !decoded ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    decoded.includes('/') ||
    decoded.includes('\\') ||
    SINGLE_LINE_CONTROL_TEST_PATTERN.test(decoded)
  ) {
    return undefined;
  }
  return encodeURIComponent(normalized);
}

function normalizeSearch(value: unknown): string {
  const search = normalizeNavigationText(value);
  if (/\s/.test(search) || ENCODED_SINGLE_LINE_CONTROL_PATTERN.test(search)) return '';
  return search.startsWith('?') && !search.startsWith('??') ? search : '';
}

function normalizeNavigationPost(post: BlogPost): SafeNavigationPost | null {
  const safeYear = normalizePathSegment(post.year);
  const safeSlug = normalizePathSegment(post.slug);
  if (!safeYear || !safeSlug) return null;

  return {
    ...post,
    safeYear,
    safeSlug,
    safeTitle: normalizeNavigationText(post.title, 'Untitled'),
    safePath: `/blog/${safeYear}/${safeSlug}`,
  };
}

export function PostNavigation({
  currentPost,
  posts,
  fromState,
  label = DEFAULT_NAVIGATION_LABEL,
  title,
  previousLabel = DEFAULT_PREVIOUS_LABEL,
  nextLabel = DEFAULT_NEXT_LABEL,
}: PostNavigationProps) {
  const location = useLocation();
  const preservedFrom =
    fromState ?? (location.state as { from?: unknown })?.from ?? location;
  const preservedSearch = normalizeSearch(
    (preservedFrom as { search?: string })?.search ?? location.search ?? ''
  );
  const safeCurrentSlug = normalizePathSegment(currentPost.slug);
  const safePosts = posts.flatMap(post => {
    const normalized = normalizeNavigationPost(post);
    return normalized ? [normalized] : [];
  });
  const currentIndex = safePosts.findIndex(post => post.safeSlug === safeCurrentSlug);
  const previousPost =
    currentIndex >= 0 && currentIndex < safePosts.length - 1 ? safePosts[currentIndex + 1] : null;
  const nextPost = currentIndex > 0 ? safePosts[currentIndex - 1] : null;
  const safeLabel = normalizeNavigationText(label, DEFAULT_NAVIGATION_LABEL);
  const safeTitle = normalizeOptionalNavigationText(title);
  const safePreviousLabel = normalizeNavigationText(previousLabel, DEFAULT_PREVIOUS_LABEL);
  const safeNextLabel = normalizeNavigationText(nextLabel, DEFAULT_NEXT_LABEL);

  if (!previousPost && !nextPost) return null;

  return (
    <nav
      aria-label={safeLabel}
      title={safeTitle}
      className='grid gap-4 md:grid-cols-2 mt-12'
    >
      {previousPost && (
        <Card className='group hover:shadow-md transition-shadow'>
          <CardContent className='p-6'>
            <Link
              to={{
                pathname: previousPost.safePath,
                search: preservedSearch || undefined,
              }}
              state={{ from: preservedFrom }}
              className='block'
              aria-label={`${safePreviousLabel}: ${previousPost.safeTitle}`}
            >
              <div className='flex items-center text-sm text-muted-foreground mb-2'>
                <ChevronLeft aria-hidden='true' className='h-4 w-4 mr-1' />
                {safePreviousLabel}
              </div>
              <h3 className='font-semibold group-hover:text-primary transition-colors line-clamp-2'>
                {previousPost.safeTitle}
              </h3>
            </Link>
          </CardContent>
        </Card>
      )}

      {nextPost && (
        <Card className='group hover:shadow-md transition-shadow'>
          <CardContent className='p-6'>
            <Link
              to={{
                pathname: nextPost.safePath,
                search: preservedSearch || undefined,
              }}
              state={{ from: preservedFrom }}
              className='block'
              aria-label={`${safeNextLabel}: ${nextPost.safeTitle}`}
            >
              <div className='flex items-center justify-end text-sm text-muted-foreground mb-2'>
                {safeNextLabel}
                <ChevronRight aria-hidden='true' className='h-4 w-4 ml-1' />
              </div>
              <h3 className='font-semibold group-hover:text-primary transition-colors line-clamp-2 text-right'>
                {nextPost.safeTitle}
              </h3>
            </Link>
          </CardContent>
        </Card>
      )}
    </nav>
  );
}

export default PostNavigation;
