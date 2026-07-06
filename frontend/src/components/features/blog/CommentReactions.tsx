import { useCallback, useEffect, useState, useRef } from 'react';
import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/ui/use-mobile';
import {
  ALLOWED_EMOJIS,
  ReactionCount,
  ReactionEmoji,
  addReaction,
  removeReaction,
  getUserReactions,
  setUserReactions,
} from '@/services/engagement/reactions';

interface CommentReactionsProps {
  commentId: string;
  initialReactions?: ReactionCount[];
  isTerminal?: boolean;
  compact?: boolean;
  labelledTrigger?: boolean;
  className?: string;
  label?: string;
  title?: string;
  addReactionLabel?: string;
  removeReactionLabel?: string;
  closePickerLabel?: string;
  reactLabel?: string;
  pickerLabel?: string;
}

const allowedEmojiSet = new Set<ReactionEmoji>(ALLOWED_EMOJIS);
const unsafeCommentIdPattern = /[\u0000-\u001F\u007F/\\]/;
const REACTION_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const REACTION_ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const REACTION_WHITESPACE_PATTERN = /\s+/g;
const DEFAULT_REACTIONS_LABEL = 'Comment reactions';
const DEFAULT_ADD_REACTION_LABEL = 'Add reaction';
const DEFAULT_REMOVE_REACTION_LABEL = 'Remove reaction';
const DEFAULT_CLOSE_PICKER_LABEL = 'Close reactions';
const DEFAULT_REACT_LABEL = 'React';
const DEFAULT_PICKER_LABEL = 'Choose reaction';

function normalizeReactionText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(REACTION_ANSI_ESCAPE_PATTERN, ' ')
    .replace(REACTION_CONTROL_PATTERN, ' ')
    .replace(REACTION_WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalReactionText(value: unknown): string | undefined {
  return normalizeReactionText(value) || undefined;
}

function normalizeCommentReactionId(commentId: string): string | null {
  const trimmed = commentId.trim();

  if (!trimmed || unsafeCommentIdPattern.test(trimmed)) return null;

  try {
    const decoded = decodeURIComponent(trimmed);
    return unsafeCommentIdPattern.test(decoded) ? null : trimmed;
  } catch {
    return null;
  }
}

function normalizeReactionCounts(
  reactionCounts: ReactionCount[]
): ReactionCount[] {
  const normalized = new Map<ReactionEmoji, number>();

  for (const reaction of reactionCounts) {
    if (!allowedEmojiSet.has(reaction.emoji)) continue;

    const count = Number.isFinite(reaction.count)
      ? Math.floor(reaction.count)
      : 0;

    if (count <= 0) continue;

    normalized.set(reaction.emoji, (normalized.get(reaction.emoji) ?? 0) + count);
  }

  return Array.from(normalized, ([emoji, count]) => ({ emoji, count }));
}

export default function CommentReactions({
  commentId,
  initialReactions = [],
  isTerminal = false,
  compact = false,
  labelledTrigger = false,
  className,
  label = DEFAULT_REACTIONS_LABEL,
  title,
  addReactionLabel = DEFAULT_ADD_REACTION_LABEL,
  removeReactionLabel = DEFAULT_REMOVE_REACTION_LABEL,
  closePickerLabel = DEFAULT_CLOSE_PICKER_LABEL,
  reactLabel = DEFAULT_REACT_LABEL,
  pickerLabel = DEFAULT_PICKER_LABEL,
}: CommentReactionsProps) {
  const safeCommentId = normalizeCommentReactionId(commentId);
  const [reactions, setReactions] = useState<ReactionCount[]>(() =>
    normalizeReactionCounts(initialReactions)
  );
  const [userReactions, setUserReactionsState] = useState<Set<ReactionEmoji>>(
    () =>
      safeCommentId
        ? getUserReactions(safeCommentId)
        : new Set<ReactionEmoji>()
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(false);
  const safeLabel = normalizeReactionText(label, DEFAULT_REACTIONS_LABEL);
  const safeTitle = normalizeOptionalReactionText(title);
  const safeAddReactionLabel = normalizeReactionText(
    addReactionLabel,
    DEFAULT_ADD_REACTION_LABEL
  );
  const safeRemoveReactionLabel = normalizeReactionText(
    removeReactionLabel,
    DEFAULT_REMOVE_REACTION_LABEL
  );
  const safeClosePickerLabel = normalizeReactionText(
    closePickerLabel,
    DEFAULT_CLOSE_PICKER_LABEL
  );
  const safeReactLabel = normalizeReactionText(reactLabel, DEFAULT_REACT_LABEL);
  const safePickerLabel = normalizeReactionText(pickerLabel, DEFAULT_PICKER_LABEL);

  // Update reactions when initialReactions changes
  useEffect(() => {
    setReactions(normalizeReactionCounts(initialReactions));
  }, [initialReactions]);

  // Handle click outside to close picker
  useEffect(() => {
    if (!isPickerOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPickerOpen]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Delay closing to allow moving to picker
    closeTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
      if (!isMobile) {
        setIsPickerOpen(false);
      }
    }, 150);
  }, [isMobile]);

  const handleReaction = useCallback(
    async (emoji: ReactionEmoji) => {
      if (loadingRef.current || !safeCommentId || !allowedEmojiSet.has(emoji))
        return;

      const hasReacted = userReactions.has(emoji);
      loadingRef.current = true;
      setIsLoading(true);

      try {
        if (hasReacted) {
          // Remove reaction
          await removeReaction(safeCommentId, emoji);

          // Update local state
          setReactions(prev => {
            const updated = prev
              .map(r =>
                r.emoji === emoji
                  ? { ...r, count: Math.max(0, r.count - 1) }
                  : r
              )
              .filter(r => r.count > 0);
            return updated;
          });

          const newUserReactions = new Set(userReactions);
          newUserReactions.delete(emoji);
          setUserReactionsState(newUserReactions);
          setUserReactions(safeCommentId, newUserReactions);
        } else {
          // Add reaction
          await addReaction(safeCommentId, emoji);

          // Update local state
          setReactions(prev => {
            const existing = prev.find(r => r.emoji === emoji);
            if (existing) {
              return prev.map(r =>
                r.emoji === emoji ? { ...r, count: r.count + 1 } : r
              );
            }
            return [...prev, { emoji, count: 1 }];
          });

          const newUserReactions = new Set(userReactions);
          newUserReactions.add(emoji);
          setUserReactionsState(newUserReactions);
          setUserReactions(safeCommentId, newUserReactions);
        }
      } catch (err) {
        console.error('Failed to toggle reaction:', err);
      } finally {
        loadingRef.current = false;
        setIsLoading(false);
      }
    },
    [safeCommentId, userReactions]
  );

  // Sort reactions by count
  const sortedReactions = [...reactions].sort((a, b) => b.count - a.count);
  const hasReactions = sortedReactions.length > 0;

  // Shared: Emoji picker content
  const renderEmojiPicker = (variant: 'terminal' | 'default') => (
    <div
      role='group'
      aria-label={safePickerLabel}
      className={cn(
        'flex items-center gap-1',
        variant === 'terminal' ? 'px-1' : 'gap-0.5'
      )}
    >
      {ALLOWED_EMOJIS.map(emoji => (
        <button
          key={emoji}
          type='button'
          onClick={() => handleReaction(emoji)}
          disabled={isLoading || !safeCommentId}
          aria-label={`${userReactions.has(emoji) ? safeRemoveReactionLabel : safeAddReactionLabel}: ${emoji}`}
          aria-pressed={userReactions.has(emoji)}
          className={cn(
            'flex-shrink-0 rounded flex items-center justify-center transition-all',
            variant === 'terminal'
              ? [
                  'text-lg border',
                  isMobile ? 'w-9 h-9' : 'w-7 h-7',
                  userReactions.has(emoji)
                    ? 'bg-primary/30 border-primary/50 scale-105'
                    : 'bg-transparent border-transparent hover:bg-primary/20 hover:border-primary/30',
                ]
              : [
                  'text-base',
                  isMobile ? 'w-9 h-9' : 'w-7 h-7',
                  userReactions.has(emoji)
                    ? 'bg-primary/20 ring-1 ring-primary/30 scale-105'
                    : 'hover:scale-110 hover:bg-primary/10',
                ],
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
          title={userReactions.has(emoji) ? safeRemoveReactionLabel : safeAddReactionLabel}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  // Terminal theme: Hover-to-Reveal with minimal footprint
  if (isTerminal) {
    return (
      <div
        ref={containerRef}
        role='group'
        aria-label={safeLabel}
        title={safeTitle}
        className={cn(
          'relative inline-flex items-center gap-1.5',
          compact ? 'mt-1.5' : 'mt-2',
          className
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Existing reactions - always visible if present */}
        {sortedReactions.map(({ emoji, count }) => (
          <button
            key={emoji}
            type='button'
            onClick={() => handleReaction(emoji as ReactionEmoji)}
            disabled={isLoading || !safeCommentId}
            aria-label={`${userReactions.has(emoji as ReactionEmoji) ? safeRemoveReactionLabel : safeAddReactionLabel}: ${emoji}`}
            aria-pressed={userReactions.has(emoji as ReactionEmoji)}
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono transition-all border',
              userReactions.has(emoji as ReactionEmoji)
                ? 'bg-primary/20 border-primary/40 text-primary'
                : 'bg-black/50 border-primary/20 hover:border-primary/40 hover:bg-primary/10 text-muted-foreground',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className='text-sm'>{emoji}</span>
            <span>{count}</span>
          </button>
        ))}

        {/* Add reaction trigger - subtle when idle */}
        <button
          type='button'
          onClick={() => setIsPickerOpen(!isPickerOpen)}
          disabled={isLoading || !safeCommentId}
          aria-label={isPickerOpen ? safeClosePickerLabel : safeAddReactionLabel}
          aria-expanded={isPickerOpen}
          className={cn(
            'inline-flex items-center justify-center rounded transition-all text-xs font-mono',
            labelledTrigger
              ? 'min-h-10 px-3'
              : isMobile
                ? 'w-7 h-7'
                : 'w-6 h-6',
            // Subtle by default, more visible on hover/open
            isPickerOpen || isHovered
              ? 'bg-primary/20 border border-primary/40 text-primary opacity-100'
              : hasReactions
                ? labelledTrigger
                  ? 'bg-transparent border border-border text-muted-foreground hover:text-primary hover:border-primary/30 opacity-100'
                  : 'bg-transparent border border-transparent text-muted-foreground/50 hover:text-primary hover:border-primary/30 opacity-70 hover:opacity-100'
                : labelledTrigger
                  ? 'bg-transparent border border-primary/20 text-muted-foreground hover:text-primary hover:border-primary/40 opacity-100'
                  : 'bg-transparent border border-dashed border-primary/20 text-muted-foreground/40 hover:text-primary hover:border-primary/40 opacity-60 hover:opacity-100',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
          title={isPickerOpen ? safeClosePickerLabel : safeAddReactionLabel}
        >
          {labelledTrigger && <SmilePlus aria-hidden='true' className='h-3.5 w-3.5' />}
          {isPickerOpen
            ? labelledTrigger
              ? safeClosePickerLabel
              : '×'
            : labelledTrigger
              ? safeReactLabel
              : '+'}
        </button>

        {/* Floating emoji picker - appears on hover/click */}
        <div
          className={cn(
            'absolute left-0 bottom-full mb-1.5 z-[var(--z-popover)]',
            'rounded-md border border-primary/30 bg-[rgba(0,0,0,0.95)] backdrop-blur-sm',
            'shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)]',
            'transition-all duration-200 ease-out origin-bottom-left',
            isPickerOpen
              ? 'opacity-100 visible scale-100 translate-y-0'
              : 'opacity-0 invisible scale-95 translate-y-1 pointer-events-none'
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className='p-1.5'>{renderEmojiPicker('terminal')}</div>
        </div>
      </div>
    );
  }

  // Default theme: Hover-to-Reveal with pill-style picker
  return (
    <div
      ref={containerRef}
      role='group'
      aria-label={safeLabel}
      title={safeTitle}
      className={cn(
        'relative inline-flex flex-wrap items-center gap-1.5',
        compact ? 'mt-1.5' : 'mt-2',
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Existing reactions - always visible */}
      {sortedReactions.map(({ emoji, count }) => (
        <button
          key={emoji}
          type='button'
          onClick={() => handleReaction(emoji as ReactionEmoji)}
          disabled={isLoading || !safeCommentId}
          aria-label={`${userReactions.has(emoji as ReactionEmoji) ? safeRemoveReactionLabel : safeAddReactionLabel}: ${emoji}`}
          aria-pressed={userReactions.has(emoji as ReactionEmoji)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border',
            userReactions.has(emoji as ReactionEmoji)
              ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
              : 'bg-background/50 border-border/50 hover:border-primary/30 hover:bg-primary/5 text-muted-foreground',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className='text-sm'>{emoji}</span>
          <span>{count}</span>
        </button>
      ))}

      {/* Add reaction trigger - subtle icon */}
      <button
        type='button'
        onClick={() => setIsPickerOpen(!isPickerOpen)}
        disabled={isLoading || !safeCommentId}
        aria-label={isPickerOpen ? safeClosePickerLabel : safeAddReactionLabel}
        aria-expanded={isPickerOpen}
        className={cn(
          'inline-flex items-center justify-center transition-all text-xs',
          labelledTrigger
            ? 'min-h-10 rounded-md px-3 font-medium'
            : 'rounded-full',
          !labelledTrigger && (isMobile ? 'w-7 h-7' : 'w-6 h-6'),
          isPickerOpen || isHovered
            ? 'bg-primary/10 border border-primary/30 text-primary opacity-100'
            : hasReactions
              ? labelledTrigger
                ? 'bg-background/70 border border-border/60 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground opacity-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                : 'bg-transparent border border-transparent text-muted-foreground/40 hover:text-primary opacity-60 hover:opacity-100'
              : labelledTrigger
                ? 'bg-background/70 border border-border/60 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground opacity-100 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10'
                : 'bg-background/30 border border-dashed border-border/40 text-muted-foreground/30 hover:text-primary hover:border-primary/30 opacity-50 hover:opacity-100',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
        title={isPickerOpen ? safeClosePickerLabel : safeAddReactionLabel}
      >
        {labelledTrigger && <SmilePlus aria-hidden='true' className='h-3.5 w-3.5' />}
        {labelledTrigger ? safeReactLabel : '+'}
      </button>

      {/* Floating emoji picker - pill style */}
      <div
        className={cn(
          'absolute left-0 bottom-full mb-1.5 z-[var(--z-popover)]',
          'rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-lg',
          'transition-all duration-200 ease-out origin-bottom-left',
          isPickerOpen
            ? 'opacity-100 visible scale-100 translate-y-0'
            : 'opacity-0 invisible scale-95 translate-y-1 pointer-events-none'
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className='p-1.5'>{renderEmojiPicker('default')}</div>
      </div>

      {/* Mobile backdrop */}
      {isMobile && isPickerOpen && (
        <div
          className='fixed inset-0 z-[var(--z-floating-content)]'
          onClick={() => setIsPickerOpen(false)}
        />
      )}
    </div>
  );
}
