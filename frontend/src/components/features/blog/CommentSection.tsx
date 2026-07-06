import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  Globe2,
  Loader2,
  MessageCircle,
  PenLine,
  Quote,
  Radio,
  Reply,
  Sparkles,
  User,
  Users,
} from 'lucide-react';
import { getApiBaseUrl } from '@/utils/network/apiBase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import CommentInputModal from './CommentInputModal';
import CommentReactions from './CommentReactions';
import { streamChatEvents } from '@/services/chat';
import { getCachedAdvancedVisitorId } from '@/services/session/fingerprint';
import { getRAGContextForChat } from '@/services/discovery/rag';
import { useFeatureFlags } from '@/stores/runtime/useFeatureFlagsStore';
import {
  mergeCommentItems,
  normalizeCommentPostId,
  type CommentItem,
  type CommentListResponse,
  useCommentsFeed,
} from './commentFeed';
import {
  fetchReactionsBatch,
  type ReactionCount,
} from '@/services/engagement/reactions';

const AI_AUTHOR_NAME = 'AI Assistant';

type ComposerMode = 'comment' | 'reply' | 'quote';

type ComposerContext = {
  mode: ComposerMode;
  target?: CommentItem;
};

type CommentSectionProps = {
  postId: string;
  label?: string;
  title?: string;
  replyLabel?: string;
  quoteLabel?: string;
  askAiLabel?: string;
  dismissLabel?: string;
  joinLabel?: string;
  joinActionLabel?: string;
  aiAutoOnLabel?: string;
  aiAutoOffLabel?: string;
};

const DEFAULT_COMPOSER_CONTEXT: ComposerContext = { mode: 'comment' };
const DISCUSSION_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const DISCUSSION_CONTROL_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const DISCUSSION_MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g;
const DISCUSSION_ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const DISCUSSION_WHITESPACE_PATTERN = /\s+/g;
const DISCUSSION_ENCODED_CONTROL_PATTERN = /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const DEFAULT_DISCUSSION_LABEL = 'Discussion';
const DEFAULT_REPLY_LABEL = 'Reply';
const DEFAULT_QUOTE_LABEL = 'Quote';
const DEFAULT_ASK_AI_LABEL = 'Ask AI';
const DEFAULT_DISMISS_LABEL = '닫기';
const DEFAULT_TERMINAL_DISMISS_LABEL = 'dismiss';
const DEFAULT_JOIN_LABEL = '토론에 참여하기';
const DEFAULT_TERMINAL_JOIN_LABEL = '>_ add to discussion...';
const DEFAULT_JOIN_ACTION_LABEL = 'Post';
const DEFAULT_TERMINAL_JOIN_ACTION_LABEL = 'INSERT';
const DEFAULT_AI_AUTO_ON_LABEL = 'AI Auto';
const DEFAULT_AI_AUTO_OFF_LABEL = 'AI Off';

function normalizeDiscussionLine(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(DISCUSSION_ANSI_ESCAPE_PATTERN, ' ')
    .replace(DISCUSSION_CONTROL_PATTERN, ' ')
    .replace(DISCUSSION_WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalDiscussionLine(value: unknown): string | undefined {
  return normalizeDiscussionLine(value) || undefined;
}

function normalizeDiscussionMarkdown(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(DISCUSSION_ANSI_ESCAPE_PATTERN, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(DISCUSSION_MULTILINE_CONTROL_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function isAiComment(comment: CommentItem): boolean {
  return (
    comment.author === AI_AUTHOR_NAME || Boolean(comment.id?.startsWith('ai-'))
  );
}

function formatDiscussionDate(value?: string | null): string {
  if (!value) return 'unknown';

  try {
    return new Date(value).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'unknown';
  }
}

function buildQuoteDraft(comment?: CommentItem): string {
  if (!comment?.content) return '';

  const normalized = normalizeDiscussionMarkdown(comment.content)
    .replace(/\s+/g, ' ')
    .trim();
  const excerpt =
    normalized.length > 280
      ? `${normalized.slice(0, 280).trim()}...`
      : normalized;

  return `> ${normalizeDiscussionLine(comment.author, 'Anonymous')}: ${excerpt}\n\n`;
}

function getComposerContextLabel(context: ComposerContext): string | undefined {
  if (!context.target) return undefined;
  const author = normalizeDiscussionLine(context.target.author, 'Anonymous');
  if (context.mode === 'reply')
    return `${author}에게 답글 작성 중`;
  if (context.mode === 'quote') return `${author}의 메시지 인용`;
  return undefined;
}

function getComposerContextPreview(
  context: ComposerContext
): string | undefined {
  const content = normalizeDiscussionMarkdown(context.target?.content)
    .replace(/\s+/g, ' ')
    .trim();
  if (!content) return undefined;
  return content.length > 160 ? `${content.slice(0, 160).trim()}...` : content;
}

export function normalizeCommentWebsiteUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (
    DISCUSSION_CONTROL_TEST_PATTERN.test(trimmed) ||
    DISCUSSION_ENCODED_CONTROL_PATTERN.test(trimmed) ||
    /\s/.test(trimmed)
  ) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export default function CommentSection({
  postId,
  label = DEFAULT_DISCUSSION_LABEL,
  title,
  replyLabel = DEFAULT_REPLY_LABEL,
  quoteLabel = DEFAULT_QUOTE_LABEL,
  askAiLabel = DEFAULT_ASK_AI_LABEL,
  dismissLabel,
  joinLabel,
  joinActionLabel,
  aiAutoOnLabel = DEFAULT_AI_AUTO_ON_LABEL,
  aiAutoOffLabel = DEFAULT_AI_AUTO_OFF_LABEL,
}: CommentSectionProps) {
  const { isTerminal } = useTheme();
  const { flags: featureFlags } = useFeatureFlags();
  const safePostId = normalizeCommentPostId(postId);
  const safeSectionLabel = normalizeDiscussionLine(label, DEFAULT_DISCUSSION_LABEL);
  const safeSectionTitle = normalizeOptionalDiscussionLine(title);
  const safeReplyLabel = normalizeDiscussionLine(replyLabel, DEFAULT_REPLY_LABEL);
  const safeQuoteLabel = normalizeDiscussionLine(quoteLabel, DEFAULT_QUOTE_LABEL);
  const safeAskAiLabel = normalizeDiscussionLine(askAiLabel, DEFAULT_ASK_AI_LABEL);
  const safeDismissLabel = normalizeDiscussionLine(
    dismissLabel,
    isTerminal ? DEFAULT_TERMINAL_DISMISS_LABEL : DEFAULT_DISMISS_LABEL
  );
  const safeJoinLabel = normalizeDiscussionLine(
    joinLabel,
    isTerminal ? DEFAULT_TERMINAL_JOIN_LABEL : DEFAULT_JOIN_LABEL
  );
  const safeJoinActionLabel = normalizeDiscussionLine(
    joinActionLabel,
    isTerminal ? DEFAULT_TERMINAL_JOIN_ACTION_LABEL : DEFAULT_JOIN_ACTION_LABEL
  );
  const safeAiAutoOnLabel = normalizeDiscussionLine(aiAutoOnLabel, DEFAULT_AI_AUTO_ON_LABEL);
  const safeAiAutoOffLabel = normalizeDiscussionLine(aiAutoOffLabel, DEFAULT_AI_AUTO_OFF_LABEL);
  const { comments, setComments, loading, error, hasArchived } =
    useCommentsFeed(safePostId ?? '');

  const commentList = useMemo(() => comments || [], [comments]);
  const commentIds = useMemo(
    () =>
      Array.from(
        new Set(
          commentList
            .map(comment => comment.id)
            .filter((id): id is string => Boolean(id))
        )
      ),
    [commentList]
  );
  const commentIdsKey = commentIds.join(',');

  const discussionCounts = useMemo(() => {
    const ai = commentList.filter(isAiComment).length;
    return {
      total: commentList.length,
      ai,
      human: commentList.length - ai,
    };
  }, [commentList]);

  const [reactionsByCommentId, setReactionsByCommentId] = useState<
    Record<string, ReactionCount[]>
  >({});

  useEffect(() => {
    let cancelled = false;

    if (commentIds.length === 0) {
      setReactionsByCommentId({});
      return () => {
        cancelled = true;
      };
    }

    void fetchReactionsBatch(commentIds).then(next => {
      if (!cancelled) {
        setReactionsByCommentId(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [commentIds, commentIdsKey]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [composerContext, setComposerContext] = useState<ComposerContext>(
    DEFAULT_COMPOSER_CONTEXT
  );
  const [savedAuthor, setSavedAuthor] = useState('');
  const formShownAt = useRef<number>(Date.now());

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
  const [aiError, setAiError] = useState<string | null>(null);

  const handleToggleAiDiscussion = useCallback(() => {
    setAiDiscussionEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('comment.aiDiscussion', String(next));
      } catch {
        void 0;
      }
      return next;
    });
  }, []);

  const openComposer = useCallback((context: ComposerContext) => {
    formShownAt.current = Date.now();
    setComposerContext(context);
    setIsModalOpen(true);
  }, []);

  const closeComposer = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const composerInitialContent =
    composerContext.mode === 'quote'
      ? buildQuoteDraft(composerContext.target)
      : '';
  const composerContextLabel = getComposerContextLabel(composerContext);
  const composerContextPreview = getComposerContextPreview(composerContext);

  const generateAiResponse = useCallback(
    async (
      userComment: string,
      userName: string,
      options: { force?: boolean } = {}
    ) => {
      if (!options.force && !aiDiscussionEnabled) return;
      if (aiResponding) return;
      if (!safePostId) {
        setAiError('댓글을 저장할 게시글을 확인하지 못했습니다.');
        return;
      }

      setAiResponding(true);
      setAiStreamingText('');
      setAiError(null);

      const pageTitle = typeof document !== 'undefined' ? document.title : '';
      const pageUrl = typeof window !== 'undefined' ? window.location.href : '';

      const recentComments = (comments || [])
        .slice(-5)
        .map(
          c =>
            `${normalizeDiscussionLine(c.author, 'Anonymous')}: ${normalizeDiscussionMarkdown(c.content)}`
        )
        .join('\n');

      const safeUserComment = normalizeDiscussionMarkdown(userComment);
      const safeUserName = normalizeDiscussionLine(userName, 'Anonymous');
      const ragContextPromise = getRAGContextForChat(safeUserComment, 2000, 8000);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      try {
        const ragContext = await ragContextPromise;

        const prompt = `당신은 블로그 글에서 독자들과 토론하는 친근한 AI 어시스턴트예요.
현재 페이지: ${pageTitle}
URL: ${pageUrl}

${ragContext ? `[관련 블로그 지식]\n${ragContext}\n\n` : ''}최근 댓글들:
${recentComments}

방금 ${safeUserName}님이 남긴 댓글:
"${safeUserComment}"

${ragContext ? '위의 관련 지식을 참고하여 ' : ''}${safeUserName}님의 댓글에 대해 짧고 통찰력 있게 응답해주세요.
- 2-3문장으로 간결하게
- 글의 내용과 연결지어 생각을 확장하거나 흥미로운 질문을 던져주세요
- 존댓말을 사용하고 친근하게 대해주세요`;

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

        const safeAiText = normalizeDiscussionMarkdown(fullText);
        if (safeAiText) {
          try {
            const base = getApiBaseUrl().replace(/\/$/, '');
            const url = `${base}/api/v1/comments`;
            const resp = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                postId: safePostId,
                author: AI_AUTHOR_NAME,
                content: safeAiText,
              }),
            });

            if (resp.ok) {
              const respData = (await resp.json()) as CommentListResponse;
              const persistedId = respData?.id ?? respData?.data?.id;
              const createdAt = new Date().toISOString();
              setComments(prev =>
                mergeCommentItems(prev, [
                  {
                    id: persistedId,
                    postId: safePostId,
                    author: AI_AUTHOR_NAME,
                    content: safeAiText,
                    website: null,
                    createdAt,
                  },
                ])
              );
            } else {
              throw new Error(`HTTP ${resp.status}`);
            }
          } catch (persistErr) {
            console.warn('Failed to persist AI comment:', persistErr);
            setAiError('AI 응답은 생성되었지만 댓글로 저장하지 못했습니다.');
          }
        }
      } catch (err) {
        const caught = err as Error;
        console.error('AI response error:', caught);

        if (caught.name === 'AbortError') {
          setAiError(
            'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.'
          );
        } else {
          setAiError('AI 응답을 생성하지 못했습니다.');
        }
      } finally {
        clearTimeout(timeoutId);
        setAiResponding(false);
        setAiStreamingText('');
      }
    },
    [aiDiscussionEnabled, aiResponding, comments, safePostId, setComments]
  );

  const handleAskAi = useCallback(
    (comment: CommentItem) => {
      if (!featureFlags.aiEnabled || aiResponding) return;
      void generateAiResponse(comment.content, comment.author, { force: true });
    },
    [aiResponding, featureFlags.aiEnabled, generateAiResponse]
  );

  const handleCommentSubmit = useCallback(
    async (data: { author: string; content: string; website: string }) => {
      const now = Date.now();
      if (now - formShownAt.current < 3000) {
        throw new Error('Please take a moment before submitting.');
      }
      if (!safePostId) {
        throw new Error('Invalid post id.');
      }

      const safeAuthor = normalizeDiscussionLine(data.author);
      const safeContent = normalizeDiscussionMarkdown(data.content);
      if (!safeAuthor || !safeContent) {
        throw new Error('Invalid comment content.');
      }
      const website = normalizeCommentWebsiteUrl(data.website);
      const base = getApiBaseUrl().replace(/\/$/, '');
      const url = `${base}/api/v1/comments`;
      const deviceFp = getCachedAdvancedVisitorId() || '';
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(deviceFp ? { 'X-Device-Fingerprint': deviceFp } : {}),
        },
        body: JSON.stringify({
          postId: safePostId,
          author: safeAuthor,
          content: safeContent,
          website: website || undefined,
          meta: { shownAt: formShownAt.current, submittedAt: now },
        }),
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const respData = (await resp.json()) as CommentListResponse;
      const id = (respData?.id ?? respData?.data?.id) as string | undefined;

      setComments(prev => {
        const existing = prev || [];
        if (id && existing.some(c => c.id === id)) {
          return existing;
        }
        return mergeCommentItems(existing, [
          {
            id,
            postId: safePostId,
            author: safeAuthor,
            content: safeContent,
            website,
            createdAt: new Date().toISOString(),
          },
        ]);
      });

      setSavedAuthor(safeAuthor);
      setComposerContext(DEFAULT_COMPOSER_CONTEXT);
      formShownAt.current = Date.now();

      if (aiDiscussionEnabled && featureFlags.aiEnabled) {
        setTimeout(() => {
          void generateAiResponse(safeContent, safeAuthor);
        }, 500);
      }
    },
    [
      safePostId,
      aiDiscussionEnabled,
      featureFlags.aiEnabled,
      generateAiResponse,
      setComments,
    ]
  );

  const streamStatusLabel = error
    ? isTerminal
      ? 'STREAM:ERR'
      : '실시간 오류'
    : loading
      ? isTerminal
        ? 'SYNC...'
        : '동기화 중'
      : isTerminal
        ? 'STREAM:ON'
        : '실시간 ON';

  const actionButtonClass = cn(
    'inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-[background-color,border-color,color,transform,opacity] duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
    isTerminal
      ? 'border border-primary/20 bg-transparent font-mono text-muted-foreground hover:border-primary/50 hover:bg-primary/10 hover:text-primary'
      : 'border border-border/60 bg-background/70 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
  );

  return (
    <section
      aria-label={safeSectionLabel}
      title={safeSectionTitle}
      className='space-y-6'
    >
      <div
        className={cn(
          'rounded-lg border p-4 shadow-sm backdrop-blur-sm transition-colors sm:p-5',
          isTerminal
            ? 'border-border bg-[hsl(var(--terminal-code-bg))]'
            : 'border-border/60 bg-card/90 dark:border-white/10 dark:bg-[#111725]/80'
        )}
      >
        <div
          className={cn(
            'flex flex-wrap items-start justify-between gap-4 pb-4',
            isTerminal
              ? 'border-b border-border'
              : 'border-b border-border/50 dark:border-white/10'
          )}
        >
          <div className='flex min-w-0 items-start gap-3'>
            <span
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                isTerminal
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-primary/15 bg-primary/10 text-primary'
              )}
            >
              <MessageCircle
                aria-hidden='true'
                className={cn('h-5 w-5', isTerminal && 'terminal-glow')}
              />
            </span>
            <div className='min-w-0'>
              <h2
                className={cn(
                  'text-lg font-semibold tracking-normal',
                  isTerminal
                    ? 'font-mono text-primary terminal-glow'
                    : 'text-foreground dark:text-white'
                )}
              >
                {isTerminal ? '>_ Discussion' : 'Discussion'}
              </h2>
              <p
                className={cn(
                  'mt-1 max-w-2xl text-sm leading-relaxed',
                  isTerminal
                    ? 'font-mono text-muted-foreground'
                    : 'text-muted-foreground dark:text-white/60'
                )}
              >
                {isTerminal
                  ? '// saved thread for humans, agents, and follow-up context'
                  : '질문, 보충, 반박, AI 응답이 저장되는 글 하단 토론장'}
              </p>
            </div>
          </div>

          <div className='flex flex-wrap items-center justify-start gap-2 sm:justify-end'>
            <span
              className={cn(
                'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
                isTerminal
                  ? 'border-primary/25 bg-primary/10 font-mono text-primary'
                  : 'border-border/70 bg-background/70 text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white'
              )}
            >
              <Users aria-hidden='true' className='h-3.5 w-3.5' />
              {isTerminal
                ? `ALL:${discussionCounts.total}`
                : `전체 ${discussionCounts.total}`}
            </span>
            <span
              className={cn(
                'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
                isTerminal
                  ? 'border-primary/20 bg-background/30 font-mono text-muted-foreground'
                  : 'border-border/60 bg-background/60 text-muted-foreground dark:border-white/10 dark:bg-white/5'
              )}
            >
              <User aria-hidden='true' className='h-3.5 w-3.5' />
              {isTerminal
                ? `H:${discussionCounts.human}`
                : `사람 ${discussionCounts.human}`}
            </span>
            <span
              className={cn(
                'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
                isTerminal
                  ? 'border-violet-400/30 bg-violet-400/10 font-mono text-violet-300'
                  : 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300'
              )}
            >
              <Bot aria-hidden='true' className='h-3.5 w-3.5' />
              {isTerminal
                ? `AI:${discussionCounts.ai}`
                : `AI ${discussionCounts.ai}`}
            </span>
            <span
              className={cn(
                'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
                error
                  ? 'border-destructive/30 bg-destructive/10 text-destructive'
                  : isTerminal
                    ? 'border-primary/20 bg-background/30 font-mono text-muted-foreground'
                    : 'border-border/60 bg-background/60 text-muted-foreground dark:border-white/10 dark:bg-white/5'
              )}
            >
              <Radio aria-hidden='true' className={cn('h-3.5 w-3.5', !error && 'text-primary')} />
              {streamStatusLabel}
            </span>

            {featureFlags.aiEnabled && (
              <button
                type='button'
                onClick={handleToggleAiDiscussion}
                aria-pressed={aiDiscussionEnabled}
                aria-label={aiDiscussionEnabled ? safeAiAutoOnLabel : safeAiAutoOffLabel}
                className={cn(
                  'inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-[background-color,border-color,color,transform] duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.98]',
                  isTerminal
                    ? aiDiscussionEnabled
                      ? 'border-primary/40 bg-primary/20 font-mono text-primary'
                      : 'border-border bg-muted/40 font-mono text-muted-foreground hover:border-primary/50 hover:text-primary'
                    : aiDiscussionEnabled
                      ? 'border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300'
                      : 'border-border/60 bg-muted/50 text-muted-foreground hover:border-violet-500/30 hover:text-violet-700 dark:hover:text-violet-300'
                )}
                title={
                  aiDiscussionEnabled
                    ? '댓글 작성 후 AI 자동 응답 끄기'
                    : '댓글 작성 후 AI 자동 응답 켜기'
                }
              >
                <Bot
                  aria-hidden='true'
                  className={cn(
                    'h-3.5 w-3.5',
                    aiDiscussionEnabled && 'animate-pulse'
                  )}
                />
                {isTerminal
                  ? aiDiscussionEnabled
                    ? 'AUTO:ON'
                    : 'AUTO:OFF'
                  : aiDiscussionEnabled
                    ? safeAiAutoOnLabel
                    : safeAiAutoOffLabel}
                {aiDiscussionEnabled && <Sparkles aria-hidden='true' className='h-3 w-3' />}
              </button>
            )}
          </div>
        </div>

        <div className='space-y-4 py-5'>
          {loading && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-4',
                isTerminal
                  ? 'border-primary/20 bg-background/20 font-mono'
                  : 'border-border/50 bg-background/50'
              )}
            >
              <Loader2
                aria-hidden='true'
                className={cn(
                  'h-4 w-4 animate-spin',
                  isTerminal && 'text-primary'
                )}
              />
              <span className='text-sm text-muted-foreground'>
                {isTerminal
                  ? '$ loading discussion...'
                  : '토론을 불러오는 중...'}
              </span>
            </div>
          )}

          {!loading && commentList.length === 0 && (
            <div
              className={cn(
                'rounded-lg border border-dashed px-4 py-6 text-sm',
                isTerminal
                  ? 'border-primary/20 bg-background/20 font-mono text-muted-foreground'
                  : 'border-border/60 bg-background/50 text-muted-foreground'
              )}
            >
              {isTerminal
                ? '$ no messages yet. start the thread.'
                : '아직 메시지가 없습니다. 첫 질문이나 보충을 남겨보세요.'}
            </div>
          )}

          {commentList.length > 0 && (
            <ul
              className={cn(
                'space-y-2.5',
                isTerminal && 'ml-2 border-l-2 border-primary/25'
              )}
            >
              {commentList.map((comment, idx) => {
                const aiComment = isAiComment(comment);
                const commentKey =
                  comment.id || `${comment.createdAt || ''}-${idx}`;
                const website = normalizeCommentWebsiteUrl(comment.website);
                const safeAuthor = normalizeDiscussionLine(comment.author, 'Anonymous');
                const safeContent = normalizeDiscussionMarkdown(comment.content);
                const safeRoleLabel = aiComment ? 'AI Agent' : '사람';
                const safeTerminalRoleLabel = aiComment ? 'agent' : 'human';

                return (
                  <li
                    key={commentKey}
                    aria-label={`${safeRoleLabel}: ${safeAuthor}`}
                    className={cn(
                      'group text-sm leading-relaxed transition-colors',
                      isTerminal
                        ? cn(
                            'relative py-3 pl-4 before:absolute before:left-[-9px] before:top-5 before:h-2 before:w-2 before:rounded-full before:border-2 before:border-background hover:bg-primary/5',
                            aiComment
                              ? 'bg-violet-500/5 before:bg-violet-400'
                              : 'before:bg-primary/60'
                          )
                        : cn(
                            'rounded-lg border p-3 shadow-sm sm:p-4',
                            aiComment
                              ? 'border-violet-500/20 bg-violet-500/[0.04] dark:bg-violet-500/10'
                              : 'border-border/50 bg-background/70 hover:bg-background/90 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.08]'
                          )
                    )}
                  >
                    <div className='flex gap-3'>
                      {!isTerminal && (
                        <span
                          className={cn(
                            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                            aiComment
                              ? 'border-violet-500/20 bg-violet-500/10'
                              : 'border-primary/15 bg-primary/10'
                          )}
                        >
                          {aiComment ? (
                            <Bot aria-hidden='true' className='h-4 w-4 text-violet-600 dark:text-violet-300' />
                          ) : (
                            <User aria-hidden='true' className='h-4 w-4 text-primary' />
                          )}
                        </span>
                      )}

                      <div className='min-w-0 flex-1'>
                        <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                          <span
                            className={cn(
                              'font-semibold',
                              isTerminal
                                ? cn(
                                    'font-mono',
                                    aiComment
                                      ? 'text-violet-300'
                                      : 'text-primary'
                                  )
                                : aiComment
                                  ? 'text-violet-700 dark:text-violet-300'
                                  : 'text-foreground dark:text-white'
                            )}
                          >
                            {isTerminal
                              ? aiComment
                                ? 'AI@assistant'
                                : `${safeAuthor}@visitor`
                              : safeAuthor}
                          </span>

                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                              isTerminal
                                ? aiComment
                                  ? 'border-violet-400/30 bg-violet-400/10 font-mono text-violet-300'
                                  : 'border-primary/20 bg-primary/10 font-mono text-primary'
                                : aiComment
                                  ? 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                                  : 'border-border/70 bg-muted/50 text-muted-foreground'
                            )}
                          >
                            {isTerminal
                              ? aiComment
                                ? safeTerminalRoleLabel
                                : safeTerminalRoleLabel
                              : aiComment
                                ? safeRoleLabel
                                : safeRoleLabel}
                          </span>

                          {aiComment && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                isTerminal
                                  ? 'border-violet-400/25 bg-background/30 font-mono text-violet-200'
                                  : 'border-violet-500/15 bg-background/60 text-violet-700/80 dark:text-violet-200/80'
                              )}
                          >
                              <Sparkles aria-hidden='true' className='h-3 w-3' />
                              {isTerminal ? 'auto' : '자동 응답'}
                            </span>
                          )}

                          <span
                            className={cn(
                              'text-xs',
                              isTerminal
                                ? 'font-mono text-muted-foreground'
                                : 'text-muted-foreground/80 dark:text-white/50'
                            )}
                          >
                            {formatDiscussionDate(comment.createdAt)} · #
                            {idx + 1}
                          </span>
                        </div>

                        <div
                          className={cn(
                            'mt-2 max-w-none break-words leading-relaxed',
                            isTerminal
                              ? 'font-mono text-foreground'
                              : 'prose prose-sm dark:prose-invert prose-p:my-2 prose-p:text-foreground/90 dark:prose-p:text-white/85'
                          )}
                        >
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={
                              isTerminal
                                ? {
                                    p: ({ children }) => (
                                      <span className='inline'>{children}</span>
                                    ),
                                  }
                                : undefined
                            }
                          >
                            {safeContent}
                          </ReactMarkdown>
                        </div>

                        {website && (
                          <a
                            href={website}
                            target='_blank'
                            rel='noreferrer'
                            className={cn(
                              'mt-2 inline-flex items-center gap-1 text-xs hover:underline',
                              isTerminal
                                ? 'font-mono text-primary/70 hover:text-primary'
                                : 'text-primary/80 hover:text-primary'
                            )}
                          >
                            <Globe2 aria-hidden='true' className='h-3 w-3' />
                            {website}
                          </a>
                        )}

                        <div className='mt-3 flex flex-wrap items-center gap-1.5'>
                          <button
                            type='button'
                            className={actionButtonClass}
                            onClick={() =>
                              openComposer({ mode: 'reply', target: comment })
                            }
                            aria-label={`${safeReplyLabel}: ${safeAuthor}`}
                            title={safeReplyLabel}
                          >
                            <Reply aria-hidden='true' className='h-3.5 w-3.5' />
                            {safeReplyLabel}
                          </button>
                          <button
                            type='button'
                            className={actionButtonClass}
                            onClick={() =>
                              openComposer({ mode: 'quote', target: comment })
                            }
                            aria-label={`${safeQuoteLabel}: ${safeAuthor}`}
                            title={safeQuoteLabel}
                          >
                            <Quote aria-hidden='true' className='h-3.5 w-3.5' />
                            {safeQuoteLabel}
                          </button>
                          {featureFlags.aiEnabled && (
                            <button
                              type='button'
                              className={actionButtonClass}
                              onClick={() => handleAskAi(comment)}
                              disabled={aiResponding}
                              aria-label={`${safeAskAiLabel}: ${safeAuthor}`}
                              title={safeAskAiLabel}
                            >
                              <Sparkles aria-hidden='true' className='h-3.5 w-3.5' />
                              {safeAskAiLabel}
                            </button>
                          )}
                          {comment.id && (
                            <CommentReactions
                              commentId={comment.id}
                              initialReactions={
                                reactionsByCommentId[comment.id] || []
                              }
                              isTerminal={isTerminal}
                              compact
                              labelledTrigger
                              className='!mt-0'
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {aiResponding && aiStreamingText && (
            <div
              className={cn(
                'rounded-lg border p-3 text-sm leading-relaxed shadow-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-300 sm:p-4',
                isTerminal
                  ? 'ml-2 border-violet-400/30 bg-violet-500/5 pl-4 font-mono'
                  : 'border-violet-500/20 bg-violet-500/[0.04] dark:bg-violet-500/10'
              )}
            >
              <div className='mb-2 flex flex-wrap items-center gap-2'>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 font-semibold',
                    isTerminal
                      ? 'text-violet-300'
                      : 'text-violet-700 dark:text-violet-300'
                  )}
                >
                  <Bot aria-hidden='true' className='h-4 w-4 animate-pulse' />
                  {isTerminal ? 'AI@assistant' : AI_AUTHOR_NAME}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    isTerminal
                      ? 'border-violet-400/30 bg-violet-400/10 text-violet-300'
                      : 'border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-300'
                  )}
                >
                  streaming
                </span>
                <Loader2 aria-hidden='true' className='h-3.5 w-3.5 animate-spin text-violet-500' />
              </div>
              <div
                className={cn(
                  'prose prose-sm max-w-none break-words leading-relaxed dark:prose-invert prose-p:my-2 prose-p:text-foreground/90 dark:prose-p:text-white/85',
                  isTerminal && 'font-mono'
                )}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {normalizeDiscussionMarkdown(aiStreamingText)}
                </ReactMarkdown>
                <span aria-hidden='true' className='ml-0.5 inline-block h-4 w-2 animate-pulse bg-violet-500 align-middle' />
              </div>
            </div>
          )}

          {aiResponding && !aiStreamingText && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-3 text-sm',
                isTerminal
                  ? 'ml-2 border-violet-400/30 bg-violet-500/5 font-mono text-violet-300'
                  : 'border-violet-500/20 bg-violet-500/[0.04] text-violet-700 dark:text-violet-300'
              )}
            >
              <Bot aria-hidden='true' className='h-4 w-4 animate-pulse' />
              <span>
                {isTerminal ? '$ AI thinking...' : 'AI가 생각하는 중...'}
              </span>
              <Loader2 aria-hidden='true' className='h-3.5 w-3.5 animate-spin' />
            </div>
          )}

          {aiError && !aiResponding && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-lg border px-4 py-3 text-sm',
                isTerminal
                  ? 'border-destructive/30 bg-destructive/10 font-mono text-destructive'
                  : 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400'
              )}
            >
              <Bot aria-hidden='true' className='h-4 w-4 shrink-0' />
              <span className='flex-1'>{normalizeDiscussionLine(aiError)}</span>
              <button
                type='button'
                onClick={() => setAiError(null)}
                aria-label={safeDismissLabel}
                className='text-xs underline opacity-70 hover:opacity-100 hover:no-underline'
              >
                {safeDismissLabel}
              </button>
            </div>
          )}

          <div
            className={cn(
              'rounded-lg border p-3 sm:p-4',
              isTerminal
                ? 'border-border bg-background/30'
                : 'border-border/50 bg-background/60 dark:border-white/10 dark:bg-white/5'
            )}
          >
            <button
              type='button'
              onClick={() => openComposer(DEFAULT_COMPOSER_CONTEXT)}
              aria-label={safeJoinLabel}
              className={cn(
                'group flex w-full items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-left transition-[background-color,border-color,color,transform] duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 active:scale-[0.99]',
                isTerminal
                  ? 'border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-muted-foreground hover:border-primary hover:text-primary'
                  : 'border-border/60 bg-background/70 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground'
              )}
            >
              <PenLine aria-hidden='true' className='h-5 w-5 shrink-0 transition-colors group-hover:text-primary' />
              <span className='min-w-0 flex-1'>
                {safeJoinLabel}
              </span>
              <span
                className={cn(
                  'hidden rounded-md px-2 py-1 text-xs transition-colors sm:inline-block',
                  isTerminal
                    ? 'bg-primary/10 text-primary/70 group-hover:bg-primary/20'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                )}
              >
                {safeJoinActionLabel}
              </span>
            </button>

            {hasArchived && (
              <p
                className={cn(
                  'mt-3 text-center text-xs',
                  isTerminal
                    ? 'font-mono text-muted-foreground'
                    : 'text-muted-foreground dark:text-white/50'
                )}
              >
                {isTerminal
                  ? '// archived messages shown; new ones appear live'
                  : 'Archived discussion messages are shown above; new ones will appear live.'}
              </p>
            )}
          </div>
        </div>
      </div>

      <CommentInputModal
        isOpen={isModalOpen}
        onClose={closeComposer}
        onSubmit={handleCommentSubmit}
        isTerminal={isTerminal}
        initialAuthor={savedAuthor}
        initialContent={composerInitialContent}
        intent={composerContext.mode}
        contextLabel={composerContextLabel}
        contextPreview={composerContextPreview}
      />
    </section>
  );
}
