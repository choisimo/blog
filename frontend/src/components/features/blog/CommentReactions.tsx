import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ALLOWED_EMOJIS,
  ReactionCount,
  ReactionEmoji,
  addReaction,
  removeReaction,
  getUserReactions,
  setUserReactions,
} from '@/services/reactions';

interface CommentReactionsProps {
  commentId: string;
  initialReactions?: ReactionCount[];
  isTerminal?: boolean;
  compact?: boolean;
}

export default function CommentReactions({
  commentId,
  initialReactions = [],
  isTerminal = false,
  compact = false,
}: CommentReactionsProps) {
  const [reactions, setReactions] = useState<ReactionCount[]>(initialReactions);
  const [userReactions, setUserReactionsState] = useState<Set<ReactionEmoji>>(() => 
    getUserReactions(commentId)
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Update reactions when initialReactions changes
  useEffect(() => {
    setReactions(initialReactions);
  }, [initialReactions]);

  const handleReaction = useCallback(async (emoji: ReactionEmoji) => {
    if (isLoading) return;
    
    const hasReacted = userReactions.has(emoji);
    setIsLoading(true);

    try {
      if (hasReacted) {
        // Remove reaction
        await removeReaction(commentId, emoji);
        
        // Update local state
        setReactions(prev => {
          const updated = prev.map(r => 
            r.emoji === emoji ? { ...r, count: Math.max(0, r.count - 1) } : r
          ).filter(r => r.count > 0);
          return updated;
        });
        
        const newUserReactions = new Set(userReactions);
        newUserReactions.delete(emoji);
        setUserReactionsState(newUserReactions);
        setUserReactions(commentId, newUserReactions);
      } else {
        // Add reaction
        await addReaction(commentId, emoji);
        
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
        setUserReactions(commentId, newUserReactions);
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    } finally {
      setIsLoading(false);
      setIsPickerOpen(false);
    }
  }, [commentId, userReactions, isLoading]);

  // Sort reactions by count
  const sortedReactions = [...reactions].sort((a, b) => b.count - a.count);

  return (
    <div 
      className={cn(
        "flex flex-wrap items-center gap-1.5",
        compact ? "mt-1.5" : "mt-2.5"
      )}
    >
      {/* Existing reactions */}
      {sortedReactions.map(({ emoji, count }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleReaction(emoji as ReactionEmoji)}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all",
            isTerminal
              ? cn(
                  "border font-mono",
                  userReactions.has(emoji as ReactionEmoji)
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-background/50 border-border hover:border-primary/30 hover:bg-primary/10 text-muted-foreground"
                )
              : cn(
                  "border",
                  userReactions.has(emoji as ReactionEmoji)
                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm"
                    : "bg-background/50 border-border/50 hover:border-primary/30 hover:bg-primary/5 text-muted-foreground"
                ),
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="text-sm">{emoji}</span>
          <span>{count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsPickerOpen(!isPickerOpen)}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-full transition-all text-xs",
            isTerminal
              ? "bg-background/50 border border-border text-muted-foreground hover:border-primary/30 hover:text-primary font-mono"
              : "bg-background/50 border border-border/50 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-primary",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
          title="Add reaction"
        >
          +
        </button>

        {/* Emoji picker dropdown */}
        {isPickerOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsPickerOpen(false)}
            />
            {/* Picker */}
            <div 
              className={cn(
                "absolute left-0 bottom-full mb-1 z-50 p-1.5 rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95 duration-100",
                isTerminal
                  ? "bg-[hsl(var(--terminal-code-bg))] border border-primary/30"
                  : "bg-card border border-border"
              )}
            >
              <div className="flex gap-1">
                {ALLOWED_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReaction(emoji)}
                    className={cn(
                      "w-8 h-8 rounded-md flex items-center justify-center text-lg transition-transform hover:scale-110",
                      isTerminal
                        ? "hover:bg-primary/20"
                        : "hover:bg-primary/10",
                      userReactions.has(emoji) && (
                        isTerminal
                          ? "bg-primary/30 ring-1 ring-primary/50"
                          : "bg-primary/20 ring-1 ring-primary/30"
                      )
                    )}
                    title={userReactions.has(emoji) ? "Remove reaction" : "Add reaction"}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
