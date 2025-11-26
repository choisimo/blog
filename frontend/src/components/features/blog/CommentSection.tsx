import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Loader2, MessageCircle, PenLine, Send, User } from 'lucide-react';
import { getApiBaseUrl } from '@/utils/apiBase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import CommentInputModal from './CommentInputModal';

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

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedAuthor, setSavedAuthor] = useState('');
  const formShownAt = useRef<number>(Date.now());

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

  // Comment submission handler for the modal
  const handleCommentSubmit = useCallback(async (data: {
    author: string;
    content: string;
    website: string;
  }) => {
    const now = Date.now();
    // Spam defense: minimum time before submission
    if (now - formShownAt.current < 3000) {
      throw new Error('Please take a moment before submitting.');
    }

    const base = getApiBaseUrl().replace(/\/$/, '');
    const url = `${base}/api/v1/comments`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId,
        author: data.author,
        content: data.content,
        website: data.website || undefined,
        meta: { shownAt: formShownAt.current, submittedAt: now },
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
        author: data.author,
        content: data.content,
        website: data.website || null,
        createdAt: new Date().toISOString(),
      },
    ]);

    // Save author name for next comment
    setSavedAuthor(data.author);
    // Reset form shown time for next submission
    formShownAt.current = Date.now();
  }, [postId]);

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
            <ul className={cn(
              "space-y-0",
              isTerminal && "border-l-2 border-primary/30 ml-2"
            )}>
              {comments.map((c, idx) => (
                <li
                  key={c.id || idx}
                  className={cn(
                    "text-sm leading-relaxed transition-colors",
                    isTerminal
                      ? "pl-4 py-3 hover:bg-primary/5 relative before:absolute before:left-[-9px] before:top-[18px] before:w-2 before:h-2 before:rounded-full before:bg-primary/50 before:border-2 before:border-background"
                      : "p-4 rounded-2xl border border-border/30 bg-background/60 shadow-sm hover:bg-background/80 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/8 mb-3"
                  )}
                >
                  {/* Terminal mode: Git log style */}
                  {isTerminal ? (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
                        <span className="text-muted-foreground">
                          [{c.createdAt 
                            ? new Date(c.createdAt).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : 'unknown'}]
                        </span>
                        <span className="text-primary font-semibold">
                          {c.author}@visitor
                        </span>
                        <span className="text-muted-foreground">:~$</span>
                      </div>
                      <div className="font-mono text-foreground pl-0 sm:pl-4">
                        <ReactMarkdown 
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => <span className="inline">{children}</span>,
                          }}
                        >
                          {c.content}
                        </ReactMarkdown>
                      </div>
                      {c.website && (
                        <a
                          href={c.website}
                          target='_blank'
                          rel='noreferrer'
                          className="inline-flex items-center gap-1 text-xs font-mono text-primary/70 hover:text-primary hover:underline pl-0 sm:pl-4"
                        >
                          <Globe2 className="h-3 w-3" />
                          {c.website}
                        </a>
                      )}
                    </div>
                  ) : (
                    /* Standard mode: Card style */
                    <>
                      <div className='mb-2.5 flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <span className="flex items-center justify-center rounded-full w-7 h-7 bg-gradient-to-br from-primary/20 to-primary/10">
                            <User className="h-3.5 w-3.5 text-primary" />
                          </span>
                          <span className="font-semibold text-foreground dark:text-white text-[13px]">
                            {c.author}
                          </span>
                        </div>
                        {c.createdAt && (
                          <span className="text-xs font-normal text-muted-foreground/70 dark:text-white/50">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="prose prose-sm max-w-none leading-relaxed dark:prose-invert prose-p:text-foreground/90 dark:prose-p:text-white/85">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {c.content}
                        </ReactMarkdown>
                      </div>
                      {c.website && (
                        <a
                          href={c.website}
                          target='_blank'
                          rel='noreferrer'
                          className="mt-2.5 inline-flex items-center gap-1 text-xs text-primary/80 hover:text-primary hover:underline"
                        >
                          <Globe2 className="h-3 w-3" />
                          {c.website}
                        </a>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Comment Form Trigger */}
          <div
            className={cn(
              "p-4 sm:p-5",
              isTerminal
                ? "rounded-lg border border-border bg-background/30"
                : "rounded-2xl border border-border/40 bg-gradient-to-br from-background/60 to-background/40 shadow-inner dark:border-white/10 dark:from-white/5 dark:to-transparent"
            )}
          >
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-all",
                isTerminal
                  ? "rounded-lg border border-dashed border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-muted-foreground hover:border-primary hover:text-primary group"
                  : "rounded-xl border border-dashed border-border/50 bg-background/50 text-muted-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground group"
              )}
            >
              <PenLine className={cn(
                "h-5 w-5 shrink-0 transition-colors",
                isTerminal
                  ? "group-hover:text-primary"
                  : "group-hover:text-primary"
              )} />
              <span className="flex-1">
                {isTerminal 
                  ? ">_ Write a comment..." 
                  : "Write a comment..."}
              </span>
              <span className={cn(
                "text-xs px-2 py-1 rounded transition-colors hidden sm:inline-block",
                isTerminal
                  ? "bg-primary/10 text-primary/70 group-hover:bg-primary/20"
                  : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}>
                {isTerminal ? "INSERT" : "Click to write"}
              </span>
            </button>

            {archived && (
              <p className={cn(
                "mt-3 text-xs text-center",
                isTerminal
                  ? "font-mono text-muted-foreground"
                  : "text-muted-foreground dark:text-white/50"
              )}>
                {isTerminal 
                  ? "// archived comments shown; new ones appear live"
                  : "Archived comments are shown above; new ones will appear live."}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Comment Input Modal */}
      <CommentInputModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCommentSubmit}
        isTerminal={isTerminal}
        initialAuthor={savedAuthor}
      />
    </section>
  );
}
