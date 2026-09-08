import { Link } from 'react-router-dom';
import type { BlogPost } from '@/types/blog';
import { ContentStatus } from '@/components/molecules/ContentStatus';
import { formatDate } from '@/utils/content/blog';

interface FieldnotesPostsSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  posts: BlogPost[];
  state: 'loading' | 'ready' | 'error';
  error?: string | null;
  notice?: string | null;
  onRetry: () => void;
}

export function FieldnotesPostsSection({
  id,
  eyebrow,
  title,
  posts,
  state,
  error,
  notice,
  onRetry,
}: FieldnotesPostsSectionProps) {
  return (
    <section
      className='fn-notes-section'
      aria-labelledby={id}
      aria-busy={state === 'loading'}
    >
      <header className='fn-section-rule'>
        <div>
          <p className='fn-eyebrow'>{eyebrow}</p>
          <h2 id={id}>{title}</h2>
        </div>
        <Link to='/blog' className='ui-inline-link'>
          모든 글 보기 ↗
        </Link>
      </header>
      {notice && <ContentStatus kind='notice'>{notice}</ContentStatus>}
      {state === 'error' ? (
        <ContentStatus kind='error'>
          {error || '글을 불러오지 못했습니다.'}{' '}
          <button type='button' className='ui-inline-link' onClick={onRetry}>
            다시 시도
          </button>
        </ContentStatus>
      ) : state === 'loading' ? (
        <>
          <ContentStatus kind='loading'>글을 불러오는 중입니다.</ContentStatus>
          <div className='fn-note-grid' aria-hidden='true'>
            {[0, 1, 2].map(index => (
              <div key={index} className='fn-note-card fn-note-skeleton'>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        </>
      ) : posts.length === 0 ? (
        <ContentStatus kind='empty'>아직 표시할 기록이 없습니다.</ContentStatus>
      ) : (
        <div className='fn-note-grid'>
          {posts.map(post => (
            <article key={`${post.year}/${post.slug}`} className='fn-note-card'>
              <span className='fn-eyebrow'>{post.category}</span>
              <h3>
                <Link to={`/blog/${post.year}/${post.slug}`}>{post.title || 'Untitled post'}</Link>
              </h3>
              <p>{post.excerpt || post.description}</p>
              <div className='fn-note-bottom'>
                <time dateTime={post.date}>{formatDate(post.date)}</time>
                <span aria-hidden='true'>READ NOTE ↗</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
