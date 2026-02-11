import * as React from 'react';
import { useCallback, useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
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
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update reactions when initialReactions changes
  useEffect(() => {
    setReactions(initialReactions);
  }, [initialReactions]);

  // Handle click outside to close picker
  useEffect(() => {
    if (!isPickerOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
    }
  }, [commentId, userReactions, isLoading]);

  // Sort reactions by count
  const sortedReactions = [...reactions].sort((a, b) => b.count - a.count);
  const hasReactions = sortedReactions.length > 0;

  // Shared: Emoji picker content
  const renderEmojiPicker = (variant: 'terminal' | 'default') => (
    <div 
      className={cn(
        "flex items-center gap-1",
        variant === 'terminal' ? "px-1" : "gap-0.5"
      )}
    >
      {ALLOWED_EMOJIS.map(emoji => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleReaction(emoji)}
          disabled={isLoading}
          className={cn(
            "flex-shrink-0 rounded flex items-center justify-center transition-all",
            variant === 'terminal' ? [
              "text-lg border",
              isMobile ? "w-9 h-9" : "w-7 h-7",
              userReactions.has(emoji)
                ? "bg-primary/30 border-primary/50 scale-105"
                : "bg-transparent border-transparent hover:bg-primary/20 hover:border-primary/30",
            ] : [
              "text-base",
              isMobile ? "w-9 h-9" : "w-7 h-7",
              userReactions.has(emoji) 
                ? "bg-primary/20 ring-1 ring-primary/30 scale-105" 
                : "hover:scale-110 hover:bg-primary/10",
            ],
            isLoading && "opacity-50 cursor-not-allowed"
          )}
          title={userReactions.has(emoji) ? "Remove reaction" : "Add reaction"}
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
        className={cn(
          "relative inline-flex items-center gap-1.5",
          compact ? "mt-1.5" : "mt-2"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Existing reactions - always visible if present */}
        {sortedReactions.map(({ emoji, count }) => (
          <button
            key={emoji}
            type="button"
            onClick={() => handleReaction(emoji as ReactionEmoji)}
            disabled={isLoading}
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono transition-all border",
              userReactions.has(emoji as ReactionEmoji)
                ? "bg-primary/20 border-primary/40 text-primary"
                : "bg-black/50 border-primary/20 hover:border-primary/40 hover:bg-primary/10 text-muted-foreground",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="text-sm">{emoji}</span>
            <span>{count}</span>
          </button>
        ))}

        {/* Add reaction trigger - subtle when idle */}
        <button
          type="button"
          onClick={() => setIsPickerOpen(!isPickerOpen)}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center justify-center rounded transition-all text-xs font-mono",
            isMobile ? "w-7 h-7" : "w-6 h-6",
            // Subtle by default, more visible on hover/open
            isPickerOpen || isHovered
              ? "bg-primary/20 border border-primary/40 text-primary opacity-100"
              : hasReactions
                ? "bg-transparent border border-transparent text-muted-foreground/50 hover:text-primary hover:border-primary/30 opacity-70 hover:opacity-100"
                : "bg-transparent border border-dashed border-primary/20 text-muted-foreground/40 hover:text-primary hover:border-primary/40 opacity-60 hover:opacity-100",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
          title={isPickerOpen ? "Close" : "Add reaction"}
        >
          {isPickerOpen ? "×" : "+"}
        </button>

        {/* Floating emoji picker - appears on hover/click */}
        <div 
          className={cn(
            "absolute left-0 bottom-full mb-1.5 z-[var(--z-popover)]",
            "rounded-md border border-primary/30 bg-[rgba(0,0,0,0.95)] backdrop-blur-sm",
            "shadow-[0_0_12px_rgba(var(--primary-rgb),0.15)]",
            "transition-all duration-200 ease-out origin-bottom-left",
            isPickerOpen
              ? "opacity-100 visible scale-100 translate-y-0"
              : "opacity-0 invisible scale-95 translate-y-1 pointer-events-none"
          )}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="p-1.5">
            {renderEmojiPicker('terminal')}
          </div>
        </div>
      </div>
    );
  }

  // Default theme: Hover-to-Reveal with pill-style picker
  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative inline-flex flex-wrap items-center gap-1.5",
        compact ? "mt-1.5" : "mt-2"
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Existing reactions - always visible */}
      {sortedReactions.map(({ emoji, count }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleReaction(emoji as ReactionEmoji)}
          disabled={isLoading}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border",
            userReactions.has(emoji as ReactionEmoji)
              ? "bg-primary/10 border-primary/30 text-primary shadow-sm"
              : "bg-background/50 border-border/50 hover:border-primary/30 hover:bg-primary/5 text-muted-foreground",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className="text-sm">{emoji}</span>
          <span>{count}</span>
        </button>
      ))}

      {/* Add reaction trigger - subtle icon */}
      <button
        type="button"
        onClick={() => setIsPickerOpen(!isPickerOpen)}
        disabled={isLoading}
        className={cn(
          "inline-flex items-center justify-center rounded-full transition-all text-xs",
          isMobile ? "w-7 h-7" : "w-6 h-6",
          isPickerOpen || isHovered
            ? "bg-primary/10 border border-primary/30 text-primary opacity-100"
            : hasReactions
              ? "bg-transparent border border-transparent text-muted-foreground/40 hover:text-primary opacity-60 hover:opacity-100"
              : "bg-background/30 border border-dashed border-border/40 text-muted-foreground/30 hover:text-primary hover:border-primary/30 opacity-50 hover:opacity-100",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
        title="Add reaction"
      >
        +
      </button>

      {/* Floating emoji picker - pill style */}
      <div 
        className={cn(
          "absolute left-0 bottom-full mb-1.5 z-[var(--z-popover)]",
          "rounded-xl border border-border bg-card/95 backdrop-blur-sm shadow-lg",
          "transition-all duration-200 ease-out origin-bottom-left",
          isPickerOpen
            ? "opacity-100 visible scale-100 translate-y-0"
            : "opacity-0 invisible scale-95 translate-y-1 pointer-events-none"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="p-1.5">
          {renderEmojiPicker('default')}
        </div>
      </div>

      {/* Mobile backdrop */}
      {isMobile && isPickerOpen && (
        <div 
          className="fixed inset-0 z-[var(--z-floating-content)]"
          onClick={() => setIsPickerOpen(false)}
        />
      )}
    </div>
  );
}
