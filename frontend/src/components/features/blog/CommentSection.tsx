import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getApiBaseUrl } from '@/utils/apiBase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
  const [hp, setHp] = useState(''); // honeypot
  const [formShownAt, setFormShownAt] = useState<number>(Date.now());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    if (archived) {
      setLoading(false);
      setComments(archived.comments);
      return () => void 0;
    }

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const base = getApiBaseUrl().replace(/\/$/, '');
        const url = `${base}/api/v1/comments?postId=${encodeURIComponent(
          postId
        )}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = (await resp.json()) as any;
        const list = Array.isArray(data?.comments)
          ? data.comments
          : data?.data?.comments || [];
        if (!cancelled) setComments(list || []);

        // Try to open SSE stream for live updates (best-effort)
        const sseUrl = `${base}/api/v1/comments/stream?postId=${encodeURIComponent(
          postId
        )}`;
        es = new EventSource(sseUrl, { withCredentials: true } as any);
        es.onmessage = ev => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg && msg.type === 'append' && Array.isArray(msg.items)) {
              setComments(prev => {
                const before = (prev || []).filter(Boolean) as any[];
                const keyOf = (it: any) =>
                  String(it.id || `${it.createdAt || ''}|${it.author || ''}|${(it.content || '').slice(0, 24)}`);
                const seen = new Set(before.map(keyOf));
                const merged = [...before];
                for (const it of msg.items) {
                  const k = keyOf(it);
                  if (!seen.has(k)) {
                    seen.add(k);
                    merged.push(it);
                  }
                }
                // keep chronological order by createdAt
                merged.sort((a, b) => {
                  const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
                  const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
                  return ta - tb;
                });
                return merged;
              });
            }
          } catch {}
        };
        es.onerror = () => {
          es?.close();
          es = null;
        };
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load comments');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (es) {
        es.close();
        es = null;
      }
    };
  }, [postId, archived]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!author.trim() || !content.trim()) return;
    // spam defenses
    const now = Date.now();
    if (hp.trim()) {
      setError('Submission blocked.');
      return;
    }
    if (now - formShownAt < 3000) {
      setError('Please take a moment before submitting.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      const base = getApiBaseUrl().replace(/\/$/, '');
      const url = `${base}/api/v1/comments`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          author: author.trim(),
          content: content.trim(),
          website: website.trim() || undefined,
          // spam signals (best-effort; backend may ignore)
          meta: { shownAt: formShownAt, submittedAt: now },
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
    <section aria-label='Comments' className='space-y-6'>
      <h2 className='text-xl font-semibold'>Comments</h2>

      {loading && (
        <p className='text-sm text-muted-foreground'>Loading comments…</p>
      )}
      {error && <p className='text-sm text-red-600'>{error}</p>}

      {comments && comments.length > 0 ? (
        <ul className='space-y-3'>
          {comments.map((c, idx) => (
            <li key={c.id || idx} className='rounded-xl border bg-card/50 backdrop-blur-sm p-4'>
              <div className='mb-1 text-sm font-medium'>{c.author}</div>
              <div className='prose prose-sm dark:prose-invert max-w-none leading-6'>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {c.content}
                </ReactMarkdown>
              </div>
              {c.website && (
                <div className='mt-1 text-xs text-muted-foreground'>
                  <a href={c.website} target='_blank' rel='noreferrer' className='underline-offset-2 hover:underline'>
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

      <form onSubmit={onSubmit} className='mt-2 grid gap-4 rounded-2xl border bg-card/60 p-4 backdrop-blur-sm'>
        <div className='grid gap-1'>
          <label className='text-sm text-muted-foreground' htmlFor='c-author'>
            Name
          </label>
          <input
            id='c-author'
            className='rounded-md border bg-background px-3 py-2 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
            value={author}
            onChange={e => setAuthor(e.target.value)}
            required
          />
        </div>
        <div className='grid gap-1'>
          <label className='text-sm text-muted-foreground' htmlFor='c-website'>
            Website (optional)
          </label>
          <input
            id='c-website'
            className='rounded-md border bg-background px-3 py-2 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
            value={website}
            onChange={e => setWebsite(e.target.value)}
            placeholder='https://example.com'
          />
        </div>
        {/* Honeypot field - keep hidden from users */}
        <div className='hidden'>
          <label htmlFor='c-hp'>Do not fill</label>
          <input id='c-hp' value={hp} onChange={e=>setHp(e.target.value)} />
        </div>
        <div className='grid gap-1'>
          <div className='flex items-center justify-between'>
            <label className='text-sm text-muted-foreground' htmlFor='c-content'>
              Comment
            </label>
            <span className='text-xs text-muted-foreground'>Markdown supported: **bold**, *italic*, `code`, lists</span>
          </div>
          <textarea
            id='c-content'
            className='min-h-[140px] rounded-md border bg-background px-3 py-2 leading-6 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
            value={content}
            onChange={e => setContent(e.target.value)}
            required
          />
        </div>
        <div className='flex items-center gap-3'>
          <button
            type='submit'
            className='inline-flex items-center rounded-md bg-primary px-4 py-2 text-primary-foreground shadow hover:brightness-110 disabled:opacity-60'
            disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Post Comment'}
          </button>
          {archived && (
            <span className='text-xs text-muted-foreground'>
              This post has archived comments; new comments will show dynamically.
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
