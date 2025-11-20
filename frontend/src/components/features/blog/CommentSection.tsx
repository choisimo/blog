  import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Loader2, MessageCircle } from 'lucide-react';
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
  const [showWebsiteField, setShowWebsiteField] = useState(false);
  const websiteInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (website && !showWebsiteField) {
      setShowWebsiteField(true);
    }
  }, [website, showWebsiteField]);

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
                  String(
                    it.id ||
                      `${it.createdAt || ''}|${it.author || ''}|${(it.content || '').slice(0, 24)}`
                  );
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
      <div className='rounded-[28px] border border-border/60 bg-card/70 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#111725]/80 sm:p-6'>
        <div className='flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4 dark:border-white/10'>
          <div className='flex items-start gap-3'>
            <span className='rounded-2xl bg-primary/10 p-2 text-primary dark:bg-primary/20'>
              <MessageCircle className='h-5 w-5' />
            </span>
            <div>
              <h2 className='text-lg font-semibold text-foreground dark:text-white'>
                Comments
              </h2>
              <p className='text-sm text-muted-foreground dark:text-white/70'>
                Leave a short reflection or follow-up question.
              </p>
            </div>
          </div>
          {error && (
            <span className='rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-200'>
              {error}
            </span>
          )}
        </div>

        <div className='space-y-4 py-4'>
          {loading && (
            <p className='text-sm text-muted-foreground'>Loading comments…</p>
          )}

          {comments && comments.length > 0 && (
            <ul className='space-y-3'>
              {comments.map((c, idx) => (
                <li
                  key={c.id || idx}
                  className='rounded-2xl border border-border/50 bg-background/70 p-4 text-sm leading-relaxed shadow-sm dark:border-white/10 dark:bg-white/5'
                >
                  <div className='mb-1 flex items-center justify-between text-[13px] font-semibold text-foreground dark:text-white'>
                    <span>{c.author}</span>
                    {c.createdAt && (
                      <span className='text-xs font-normal text-muted-foreground dark:text-white/60'>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className='prose prose-sm dark:prose-invert max-w-none leading-6'>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {c.content}
                    </ReactMarkdown>
                  </div>
                  {c.website && (
                    <a
                      href={c.website}
                      target='_blank'
                      rel='noreferrer'
                      className='mt-2 inline-flex items-center text-xs text-primary hover:underline'
                    >
                      {c.website}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={onSubmit}
            className='grid gap-4 rounded-2xl border border-border/70 bg-background/60 p-4 shadow-inner dark:border-white/10 dark:bg-white/5 sm:p-5'
          >
            <div className='grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4'>
              <label className='grid gap-1 text-sm text-muted-foreground' htmlFor='c-author'>
                <span>Name</span>
                <input
                  id='c-author'
                  className='rounded-xl border border-border/60 bg-white/80 px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#101523] dark:text-white'
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  required
                />
              </label>
              <button
                type='button'
                onClick={() => {
                  setShowWebsiteField(prev => !prev);
                  if (!showWebsiteField) {
                    setTimeout(() => {
                      websiteInputRef.current?.focus();
                    }, 0);
                  }
                }}
                aria-expanded={showWebsiteField}
                className='inline-flex items-center justify-center rounded-2xl border border-dashed border-border/70 bg-transparent px-4 py-2 text-xs font-medium text-muted-foreground transition hover:border-primary hover:text-primary dark:border-white/20 dark:text-white/70'
              >
                <Globe2 className='mr-1.5 h-4 w-4' />
                {showWebsiteField ? 'Hide website' : 'Add website'}
              </button>
            </div>
            {showWebsiteField && (
              <label className='grid gap-1 text-sm text-muted-foreground transition-all' htmlFor='c-website'>
                <span className='sr-only'>Website (optional)</span>
                <input
                  id='c-website'
                  ref={websiteInputRef}
                  className='rounded-xl border border-border/60 bg-white/80 px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#101523] dark:text-white'
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder='https://example.com'
                />
              </label>
            )}
            {/* Honeypot field - keep hidden from users */}
            <div className='hidden'>
              <label htmlFor='c-hp'>Do not fill</label>
              <input id='c-hp' value={hp} onChange={e => setHp(e.target.value)} />
            </div>
            <label className='grid gap-2 text-sm text-muted-foreground' htmlFor='c-content'>
              <span>Comment</span>
              <div className='relative'>
                <textarea
                  id='c-content'
                  className='peer min-h-[140px] w-full rounded-2xl border border-border/60 bg-white/80 px-3 py-3 text-sm leading-6 shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#0d1220] dark:text-white'
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  required
                />
                <span className='pointer-events-none absolute inset-x-3 top-2 text-xs text-muted-foreground/70 transition-opacity peer-focus:opacity-0 dark:text-white/50'>
                  Markdown supported: **bold**, *italic*, `code`
                </span>
              </div>
            </label>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <button
                type='submit'
                className='inline-flex items-center justify-center rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-110 disabled:opacity-60'
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Sending…
                  </>
                ) : (
                  'Post Comment'
                )}
              </button>
              {archived && (
                <span className='text-xs text-muted-foreground dark:text-white/60'>
                  Archived comments are shown above; new ones will appear live.
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
