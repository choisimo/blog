import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Loader2, MessageCircle, Send, User } from 'lucide-react';
import { getApiBaseUrl } from '@/utils/apiBase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

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
  const { isTerminal } = useTheme();
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
      <div className={cn(
        "p-5 sm:p-6 shadow-sm backdrop-blur-sm transition-colors",
        isTerminal
          ? "rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))]"
          : "rounded-[28px] border border-border/40 bg-card/80 dark:border-white/10 dark:bg-[#111725]/80"
      )}>
        {/* Header */}
        <div className={cn(
          "flex flex-wrap items-start justify-between gap-3 pb-4",
          isTerminal
            ? "border-b border-border"
            : "border-b border-border/40 dark:border-white/10"
        )}>
          <div className='flex items-start gap-3'>
            <span className={cn(
              "p-2.5 rounded-xl",
              isTerminal
                ? "bg-primary/20 text-primary"
                : "bg-gradient-to-br from-primary/15 to-primary/5 text-primary dark:from-primary/20 dark:to-primary/10"
            )}>
              <MessageCircle className={cn(
                "h-5 w-5",
                isTerminal && "terminal-glow"
              )} />
            </span>
            <div>
              <h2 className={cn(
                "text-lg font-semibold",
                isTerminal
                  ? "font-mono text-primary terminal-glow"
                  : "text-foreground dark:text-white"
              )}>
                {isTerminal ? ">_ Comments" : "Comments"}
              </h2>
              <p className={cn(
                "text-sm",
                isTerminal
                  ? "font-mono text-muted-foreground"
                  : "text-muted-foreground dark:text-white/60"
              )}>
                {isTerminal 
                  ? "// Leave a short reflection or follow-up question"
                  : "Leave a short reflection or follow-up question"}
              </p>
            </div>
          </div>
          {error && (
            <span className={cn(
              "rounded-full px-3 py-1 text-xs font-medium",
              isTerminal
                ? "bg-destructive/20 text-destructive border border-destructive/30"
                : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-200"
            )}>
              {error}
            </span>
          )}
        </div>

        {/* Comments List */}
        <div className='space-y-4 py-5'>
          {loading && (
            <div className={cn(
              "flex items-center gap-2 py-4",
              isTerminal && "font-mono"
            )}>
              <Loader2 className={cn(
                "h-4 w-4 animate-spin",
                isTerminal && "text-primary"
              )} />
              <span className="text-sm text-muted-foreground">
                {isTerminal ? "$ loading comments..." : "Loading comments..."}
              </span>
            </div>
          )}

          {comments && comments.length > 0 && (
            <ul className='space-y-3'>
              {comments.map((c, idx) => (
                <li
                  key={c.id || idx}
                  className={cn(
                    "p-4 text-sm leading-relaxed transition-colors",
                    isTerminal
                      ? "rounded-lg border border-border bg-background/50 hover:border-primary/30"
                      : "rounded-2xl border border-border/30 bg-background/60 shadow-sm hover:bg-background/80 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/8"
                  )}
                >
                  <div className='mb-2.5 flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <span className={cn(
                        "flex items-center justify-center rounded-full w-7 h-7",
                        isTerminal
                          ? "bg-primary/20 text-primary"
                          : "bg-gradient-to-br from-primary/20 to-primary/10"
                      )}>
                        <User className={cn(
                          "h-3.5 w-3.5",
                          isTerminal ? "text-primary" : "text-primary"
                        )} />
                      </span>
                      <span className={cn(
                        "font-semibold",
                        isTerminal
                          ? "font-mono text-primary text-sm"
                          : "text-foreground dark:text-white text-[13px]"
                      )}>
                        {c.author}
                      </span>
                    </div>
                    {c.createdAt && (
                      <span className={cn(
                        "text-xs font-normal",
                        isTerminal
                          ? "font-mono text-muted-foreground"
                          : "text-muted-foreground/70 dark:text-white/50"
                      )}>
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className={cn(
                    "prose prose-sm max-w-none leading-relaxed",
                    isTerminal
                      ? "font-mono text-foreground prose-p:text-foreground prose-strong:text-primary"
                      : "dark:prose-invert prose-p:text-foreground/90 dark:prose-p:text-white/85"
                  )}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {c.content}
                    </ReactMarkdown>
                  </div>
                  {c.website && (
                    <a
                      href={c.website}
                      target='_blank'
                      rel='noreferrer'
                      className={cn(
                        "mt-2.5 inline-flex items-center gap-1 text-xs hover:underline",
                        isTerminal
                          ? "text-primary hover:text-primary/80"
                          : "text-primary/80 hover:text-primary"
                      )}
                    >
                      <Globe2 className="h-3 w-3" />
                      {c.website}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Comment Form */}
          <form
            onSubmit={onSubmit}
            className={cn(
              "grid gap-4 p-4 sm:p-5",
              isTerminal
                ? "rounded-lg border border-border bg-background/30"
                : "rounded-2xl border border-border/40 bg-gradient-to-br from-background/60 to-background/40 shadow-inner dark:border-white/10 dark:from-white/5 dark:to-transparent"
            )}
          >
            <div className='grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4'>
              <label className='grid gap-1.5' htmlFor='c-author'>
                <span className={cn(
                  "text-sm font-medium",
                  isTerminal
                    ? "font-mono text-primary"
                    : "text-foreground/80 dark:text-white/80"
                )}>
                  {isTerminal ? "$ name:" : "Name"}
                </span>
                <input
                  id='c-author'
                  className={cn(
                    "px-3.5 py-2.5 text-sm outline-none transition-all",
                    isTerminal
                      ? "rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50"
                      : "rounded-xl border border-border/50 bg-white/80 text-foreground shadow-sm placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#101523] dark:text-white"
                  )}
                  value={author}
                  onChange={e => setAuthor(e.target.value)}
                  placeholder={isTerminal ? "your_name" : "Your name"}
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
                className={cn(
                  "inline-flex items-center justify-center px-4 py-2.5 text-xs font-medium transition-all self-end",
                  isTerminal
                    ? "rounded-lg border border-dashed border-border bg-transparent font-mono text-muted-foreground hover:border-primary hover:text-primary"
                    : "rounded-xl border border-dashed border-border/50 bg-transparent text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-primary dark:border-white/20 dark:text-white/60"
                )}
              >
                <Globe2 className='mr-1.5 h-4 w-4' />
                {showWebsiteField ? 'Hide website' : 'Add website'}
              </button>
            </div>
            {showWebsiteField && (
              <label className='grid gap-1.5 animate-in slide-in-from-top-2 duration-200' htmlFor='c-website'>
                <span className={cn(
                  "text-sm font-medium",
                  isTerminal
                    ? "font-mono text-primary"
                    : "text-foreground/80 dark:text-white/80"
                )}>
                  {isTerminal ? "$ website:" : "Website"}
                </span>
                <input
                  id='c-website'
                  ref={websiteInputRef}
                  className={cn(
                    "px-3.5 py-2.5 text-sm outline-none transition-all",
                    isTerminal
                      ? "rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50"
                      : "rounded-xl border border-border/50 bg-white/80 text-foreground shadow-sm placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#101523] dark:text-white"
                  )}
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
            <label className='grid gap-2' htmlFor='c-content'>
              <span className={cn(
                "text-sm font-medium",
                isTerminal
                  ? "font-mono text-primary"
                  : "text-foreground/80 dark:text-white/80"
              )}>
                {isTerminal ? "$ comment:" : "Comment"}
              </span>
              <div className='relative'>
                <textarea
                  id='c-content'
                  className={cn(
                    "peer min-h-[120px] w-full px-3.5 py-3 text-sm leading-relaxed outline-none transition-all resize-none",
                    isTerminal
                      ? "rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50"
                      : "rounded-2xl border border-border/50 bg-white/80 text-foreground shadow-sm placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-[#0d1220] dark:text-white"
                  )}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={isTerminal ? "// write your thoughts..." : "Share your thoughts..."}
                  required
                />
                <span className={cn(
                  "pointer-events-none absolute right-3 bottom-3 text-[10px] transition-opacity peer-focus:opacity-0",
                  isTerminal
                    ? "font-mono text-muted-foreground/50"
                    : "text-muted-foreground/50 dark:text-white/30"
                )}>
                  Markdown supported
                </span>
              </div>
            </label>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <button
                type='submit'
                className={cn(
                  "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold transition-all disabled:opacity-60",
                  isTerminal
                    ? "rounded-lg border border-primary bg-primary/20 font-mono text-primary hover:bg-primary/30 disabled:hover:bg-primary/20"
                    : "rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] dark:shadow-primary/15"
                )}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    {isTerminal ? "$ sending..." : "Sending..."}
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {isTerminal ? "$ submit" : "Post Comment"}
                  </>
                )}
              </button>
              {archived && (
                <span className={cn(
                  "text-xs",
                  isTerminal
                    ? "font-mono text-muted-foreground"
                    : "text-muted-foreground dark:text-white/50"
                )}>
                  {isTerminal 
                    ? "// archived comments shown; new ones appear live"
                    : "Archived comments are shown above; new ones will appear live."}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
