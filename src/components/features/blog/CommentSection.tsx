import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiBase';

// Load any archived comments bundled at build-time
// Using a relative glob; keys may vary (relative vs absolute) depending on bundler.
const archivedModules = (import.meta as any).glob(
  '../../../data/comments/**/*.json',
  { eager: true }
);

type CommentItem = {
  id?: string;
  postId: string;
  author: string;
  content: string;
  website?: string | null;
  parentId?: string | null;
  createdAt?: string | null;
};

type ArchivedPayload = { comments: CommentItem[] };

function getArchivedFor(postId: string): ArchivedPayload | null {
  const entries = Object.entries(archivedModules as Record<string, any>);
  // Match any key that ends with `/${postId}.json`
  const found = entries.find(([k]) => k.endsWith(`/${postId}.json`));
  if (!found) return null;
  const mod = found[1];
  const data = mod?.default ?? mod;
  if (data && Array.isArray(data.comments)) return data as ArchivedPayload;
  return null;
}

export default function CommentSection({ postId }: { postId: string }) {
  const archived = useMemo(() => getArchivedFor(postId), [postId]);
  const [comments, setComments] = useState<CommentItem[] | null>(
    archived?.comments ?? null
  );
  const [loading, setLoading] = useState<boolean>(!archived);
  const [error, setError] = useState<string | null>(null);

  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (archived) {
      setLoading(false);
      setComments(archived.comments);
      return;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const apiBase = getApiBaseUrl();
        const url = apiBase
          ? `${apiBase.replace(/\/$/, '')}/api/v1/comments?postId=${encodeURIComponent(
              postId
            )}`
          : `/api/comments/list?postId=${encodeURIComponent(postId)}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as any;
        const list = Array.isArray(data?.comments)
          ? data.comments
          : data?.data?.comments || [];
        if (!cancelled) setComments(list || []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load comments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [postId, archived]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!author.trim() || !content.trim()) return;
    try {
      setSubmitting(true);
      setError(null);
      const apiBase = getApiBaseUrl();
      const url = apiBase
        ? `${apiBase.replace(/\/$/, '')}/api/v1/comments`
        : '/api/comments/add';
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          author: author.trim(),
          content: content.trim(),
          website: website.trim() || undefined,
        }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const respData = (await resp.json()) as any;
      const id = (respData?.id ?? respData?.data?.id) as string | undefined;
      // Optimistic append
      setComments(prev => [
        ...(prev || []),
        {
          id,
          postId,
          author: author.trim(),
          content: content.trim(),
          website: website.trim() || null,
          createdAt: new Date().toISOString(),
        },
      ]);
      setAuthor('');
      setContent('');
      setWebsite('');
    } catch (e: any) {
      setError(e?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-label='Comments' className='space-y-4'>
      <h2 className='text-xl font-semibold'>Comments</h2>

      {loading && (
        <p className='text-sm text-muted-foreground'>Loading comments…</p>
      )}
      {error && <p className='text-sm text-red-600'>{error}</p>}

      {comments && comments.length > 0 ? (
        <ul className='space-y-3'>
          {comments.map((c, idx) => (
            <li key={c.id || idx} className='rounded border p-3'>
              <div className='mb-1 text-sm font-medium'>{c.author}</div>
              <div className='text-sm whitespace-pre-wrap'>{c.content}</div>
              {c.website && (
                <div className='mt-1 text-xs text-muted-foreground'>
                  <a href={c.website} target='_blank' rel='noreferrer'>
                    {c.website}
                  </a>
                </div>
              )}
              {c.createdAt && (
                <div className='mt-1 text-xs text-muted-foreground'>
                  {new Date(c.createdAt).toLocaleString()}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        !loading && (
          <p className='text-sm text-muted-foreground'>
            Be the first to comment.
          </p>
        )
      )}

      <form onSubmit={onSubmit} className='mt-6 grid gap-2'>
        <div className='grid gap-1'>
          <label className='text-sm' htmlFor='c-author'>
            Name
          </label>
          <input
            id='c-author'
            className='rounded border px-3 py-2'
            value={author}
            onChange={e => setAuthor(e.target.value)}
            required
          />
        </div>
        <div className='grid gap-1'>
          <label className='text-sm' htmlFor='c-website'>
            Website (optional)
          </label>
          <input
            id='c-website'
            className='rounded border px-3 py-2'
            value={website}
            onChange={e => setWebsite(e.target.value)}
            placeholder='https://example.com'
          />
        </div>
        <div className='grid gap-1'>
          <label className='text-sm' htmlFor='c-content'>
            Comment
          </label>
          <textarea
            id='c-content'
            className='min-h-[120px] rounded border px-3 py-2'
            value={content}
            onChange={e => setContent(e.target.value)}
            required
          />
        </div>
        <div>
          <button
            type='submit'
            className='inline-flex items-center rounded bg-black px-4 py-2 text-white disabled:opacity-60 dark:bg-white dark:text-black'
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Post Comment'}
          </button>
          {archived && (
            <span className='ml-2 text-xs text-muted-foreground'>
              This post has archived comments; new comments will show
              dynamically.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
