import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Globe2, Loader2, MessageCircle, PenLine, Send, Sparkles, User } from 'lucide-react';
import { getApiBaseUrl } from '@/utils/apiBase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import CommentInputModal from './CommentInputModal';
import CommentReactions from './CommentReactions';
import { streamChatEvents } from '@/services/chat';
import { fetchReactionsBatch, ReactionCount } from '@/services/reactions';

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

  // Reactions state: map of commentId -> reactions
  const [reactionsMap, setReactionsMap] = useState<Record<string, ReactionCount[]>>({});

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedAuthor, setSavedAuthor] = useState('');
  const formShownAt = useRef<number>(Date.now());

  // AI Discussion mode state
  const [aiDiscussionEnabled, setAiDiscussionEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem('comment.aiDiscussion') === 'true';
    } catch {
      return false;
    }
  });
  const [aiResponding, setAiResponding] = useState(false);
  const [aiStreamingText, setAiStreamingText] = useState('');

  // Fetch reactions when comments change
  useEffect(() => {
    if (!comments || comments.length === 0) return;
    
    const commentIds = comments
      .map(c => c.id)
      .filter((id): id is string => !!id);
    
    if (commentIds.length === 0) return;

    fetchReactionsBatch(commentIds)
      .then(reactions => setReactionsMap(reactions))
      .catch(err => console.warn('Failed to fetch reactions:', err));
  }, [comments]);

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

  // Toggle AI discussion mode
  const handleToggleAiDiscussion = useCallback(() => {
    setAiDiscussionEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('comment.aiDiscussion', String(next));
      } catch {}
      return next;
    });
  }, []);

  // AI response error state
  const [aiError, setAiError] = useState<string | null>(null);

  // Generate AI response to a user comment
  const generateAiResponse = useCallback(async (userComment: string, userName: string) => {
    if (!aiDiscussionEnabled) return;
    
    setAiResponding(true);
    setAiStreamingText('');
    setAiError(null);
    
    const pageTitle = typeof document !== 'undefined' ? document.title : '';
    const pageUrl = typeof window !== 'undefined' ? window.location.href : '';
    
    // Build context from recent comments
    const recentComments = (comments || []).slice(-5).map(c => 
      `${c.author}: ${c.content}`
    ).join('\n');
    
    const prompt = `당신은 블로그 글에서 독자들과 토론하는 친근한 AI 어시스턴트예요. 
현재 페이지: ${pageTitle}
URL: ${pageUrl}

최근 댓글들:
${recentComments}

방금 ${userName}님이 남긴 댓글:
"${userComment}"

${userName}님의 댓글에 대해 짧고 통찰력 있게 응답해주세요. 
- 2-3문장으로 간결하게
- 글의 내용과 연결지어 생각을 확장하거나 흥미로운 질문을 던져주세요
- 존댓말을 사용하고 친근하게 대해주세요`;

    // Create abort controller with 45-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      let fullText = '';
      for await (const ev of streamChatEvents({ 
        text: prompt,
        useArticleContext: true,
        signal: controller.signal,
      })) {
        if (ev.type === 'text') {
          fullText += ev.text;
          setAiStreamingText(fullText);
        }
      }
      
      // Add AI comment to the list
      if (fullText.trim()) {
        const now = new Date().toISOString();
        const tempId = `ai-${Date.now()}`;
        
        // Optimistically add to local state first
        const aiComment: CommentItem = {
          id: tempId,
          postId,
          author: 'AI Assistant',
          content: fullText.trim(),
          website: null,
          createdAt: now,
        };
        setComments(prev => [...(prev || []), aiComment]);
        
        // Persist to D1 database
        try {
          const base = getApiBaseUrl().replace(/\/$/, '');
          const url = `${base}/api/v1/comments`;
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postId,
              author: 'AI Assistant',
              content: fullText.trim(),
            }),
          });
          
          if (resp.ok) {
            const respData = (await resp.json()) as any;
            const persistedId = respData?.id ?? respData?.data?.id;
            // Update local state with persisted ID
            if (persistedId) {
              setComments(prev => 
                (prev || []).map(c => 
                  c.id === tempId ? { ...c, id: persistedId } : c
                )
              );
            }
          } else {
            console.warn('Failed to persist AI comment:', resp.status);
          }
        } catch (persistErr) {
          console.warn('Failed to persist AI comment:', persistErr);
          // Comment still exists in local state - graceful degradation
        }
      }
    } catch (err) {
      const error = err as Error;
      console.error('AI response error:', error);
      
      // Set user-facing error message
      if (error.name === 'AbortError') {
        setAiError('AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setAiError('AI 응답을 생성하지 못했습니다.');
      }
    } finally {
      clearTimeout(timeoutId);
      setAiResponding(false);
      setAiStreamingText('');
    }
  }, [aiDiscussionEnabled, comments, postId]);

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

    // Optimistic append with deduplication
    setComments(prev => {
      const existing = prev || [];
      // Check if comment with this ID already exists (from SSE race condition)
      if (id && existing.some(c => c.id === id)) {
        return existing;
      }
      return [
        ...existing,
        {
          id,
          postId,
          author: data.author,
          content: data.content,
          website: data.website || null,
          createdAt: new Date().toISOString(),
        },
      ];
    });

    // Save author name for next comment
    setSavedAuthor(data.author);
    // Reset form shown time for next submission
    formShownAt.current = Date.now();

    // Trigger AI response if enabled
    if (aiDiscussionEnabled) {
      // Small delay to ensure user comment is visible first
      setTimeout(() => {
        generateAiResponse(data.content, data.author);
      }, 500);
    }
  }, [postId, aiDiscussionEnabled, generateAiResponse]);

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
          <div className="flex items-center gap-2">
            {/* AI Discussion Toggle */}
            <button
              type="button"
              onClick={handleToggleAiDiscussion}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                isTerminal
                  ? aiDiscussionEnabled
                    ? "bg-primary/20 text-primary border border-primary/30 font-mono"
                    : "bg-muted/50 text-muted-foreground border border-border font-mono hover:border-primary/50"
                  : aiDiscussionEnabled
                    ? "bg-gradient-to-r from-violet-500/20 to-purple-500/20 text-violet-600 dark:text-violet-400 border border-violet-500/30"
                    : "bg-muted/50 text-muted-foreground border border-border/50 hover:border-violet-500/30 hover:text-violet-600 dark:hover:text-violet-400"
              )}
              title={aiDiscussionEnabled ? "AI 토론 모드 끄기" : "AI 토론 모드 켜기"}
            >
              <Bot className={cn(
                "h-3.5 w-3.5",
                aiDiscussionEnabled && "animate-pulse"
              )} />
              {isTerminal 
                ? aiDiscussionEnabled ? "AI:ON" : "AI:OFF"
                : aiDiscussionEnabled ? "AI 토론" : "AI 토론"
              }
              {aiDiscussionEnabled && (
                <Sparkles className="h-3 w-3" />
              )}
            </button>
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
              {comments.map((c, idx) => {
                const isAiComment = c.author === 'AI Assistant' || c.id?.startsWith('ai-');
                return (
                <li
                  key={c.id || idx}
                  className={cn(
                    "text-sm leading-relaxed transition-colors",
                    isTerminal
                      ? cn(
                          "pl-4 py-3 hover:bg-primary/5 relative before:absolute before:left-[-9px] before:top-[18px] before:w-2 before:h-2 before:rounded-full before:border-2 before:border-background",
                          isAiComment 
                            ? "before:bg-violet-500 bg-violet-500/5" 
                            : "before:bg-primary/50"
                        )
                      : cn(
                          "p-4 rounded-2xl border shadow-sm mb-3",
                          isAiComment
                            ? "border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-500/5 dark:from-violet-500/10 dark:to-purple-500/10"
                            : "border-border/30 bg-background/60 hover:bg-background/80 dark:border-white/5 dark:bg-white/5 dark:hover:bg-white/8"
                        )
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
                        <span className={cn(
                          "font-semibold",
                          isAiComment ? "text-violet-500" : "text-primary"
                        )}>
                          {isAiComment ? (
                            <span className="inline-flex items-center gap-1">
                              <Bot className="h-3 w-3" />
                              AI@assistant
                            </span>
                          ) : (
                            `${c.author}@visitor`
                          )}
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
                      {/* Comment Reactions */}
                      {c.id && (
                        <div className="pl-0 sm:pl-4">
                          <CommentReactions
                            commentId={c.id}
                            initialReactions={reactionsMap[c.id] || []}
                            isTerminal={isTerminal}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Standard mode: Card style */
                    <>
                      <div className='mb-2.5 flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <span className={cn(
                            "flex items-center justify-center rounded-full w-7 h-7",
                            isAiComment
                              ? "bg-gradient-to-br from-violet-500/20 to-purple-500/20"
                              : "bg-gradient-to-br from-primary/20 to-primary/10"
                          )}>
                            {isAiComment ? (
                              <Bot className="h-3.5 w-3.5 text-violet-500" />
                            ) : (
                              <User className="h-3.5 w-3.5 text-primary" />
                            )}
                          </span>
                          <span className={cn(
                            "font-semibold text-[13px]",
                            isAiComment
                              ? "text-violet-600 dark:text-violet-400"
                              : "text-foreground dark:text-white"
                          )}>
                            {c.author}
                            {isAiComment && (
                              <Sparkles className="inline h-3 w-3 ml-1 text-violet-500" />
                            )}
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
                      {/* Comment Reactions */}
                      {c.id && (
                        <CommentReactions
                          commentId={c.id}
                          initialReactions={reactionsMap[c.id] || []}
                          isTerminal={isTerminal}
                        />
                      )}
                    </>
                  )}
                </li>
              );})}
            </ul>
          )}

          {/* AI Streaming Response */}
          {aiResponding && aiStreamingText && (
            <div
              className={cn(
                "text-sm leading-relaxed animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
                isTerminal
                  ? "pl-4 py-3 ml-2 border-l-2 border-violet-500/50 bg-violet-500/5"
                  : "p-4 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-purple-500/5 dark:from-violet-500/10 dark:to-purple-500/10"
              )}
            >
              {isTerminal ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs">
                    <span className="text-muted-foreground">[typing...]</span>
                    <span className="text-violet-500 font-semibold inline-flex items-center gap-1">
                      <Bot className="h-3 w-3 animate-pulse" />
                      AI@assistant
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
                      {aiStreamingText}
                    </ReactMarkdown>
                    <span className="inline-block w-2 h-4 bg-violet-500 animate-pulse ml-0.5" />
                  </div>
                </div>
              ) : (
                <>
                  <div className='mb-2.5 flex items-center gap-2'>
                    <span className="flex items-center justify-center rounded-full w-7 h-7 bg-gradient-to-br from-violet-500/20 to-purple-500/20">
                      <Bot className="h-3.5 w-3.5 text-violet-500 animate-pulse" />
                    </span>
                    <span className="font-semibold text-[13px] text-violet-600 dark:text-violet-400">
                      AI Assistant
                      <Sparkles className="inline h-3 w-3 ml-1 text-violet-500 animate-pulse" />
                    </span>
                    <Loader2 className="h-3 w-3 animate-spin text-violet-500 ml-auto" />
                  </div>
                  <div className="prose prose-sm max-w-none leading-relaxed dark:prose-invert prose-p:text-foreground/90 dark:prose-p:text-white/85">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {aiStreamingText}
                    </ReactMarkdown>
                    <span className="inline-block w-2 h-4 bg-violet-500 animate-pulse ml-0.5 align-middle" />
                  </div>
                </>
              )}
            </div>
          )}

          {/* AI Responding Indicator (before text starts) */}
          {aiResponding && !aiStreamingText && (
            <div
              className={cn(
                "flex items-center gap-2 py-3",
                isTerminal
                  ? "pl-4 ml-2 border-l-2 border-violet-500/50 font-mono"
                  : "px-4"
              )}
            >
              <Bot className="h-4 w-4 text-violet-500 animate-pulse" />
              <span className="text-sm text-violet-600 dark:text-violet-400">
                {isTerminal ? "$ AI thinking..." : "AI가 생각하는 중..."}
              </span>
              <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
            </div>
          )}

          {/* AI Error Message */}
          {aiError && !aiResponding && (
            <div
              className={cn(
                "flex items-center gap-2 py-3 px-4 rounded-lg text-sm",
                isTerminal
                  ? "bg-destructive/10 border border-destructive/30 text-destructive font-mono"
                  : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400"
              )}
            >
              <Bot className="h-4 w-4 shrink-0" />
              <span className="flex-1">{aiError}</span>
              <button
                type="button"
                onClick={() => setAiError(null)}
                className="text-xs underline hover:no-underline opacity-70 hover:opacity-100"
              >
                {isTerminal ? "dismiss" : "닫기"}
              </button>
            </div>
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
