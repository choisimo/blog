import * as React from 'react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Globe2, Loader2, Send, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommentInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    author: string;
    content: string;
    website: string;
  }) => Promise<void>;
  isTerminal: boolean;
  initialAuthor?: string;
}

export default function CommentInputModal({
  isOpen,
  onClose,
  onSubmit,
  isTerminal,
  initialAuthor = '',
}: CommentInputModalProps) {
  const [author, setAuthor] = useState(initialAuthor);
  const [content, setContent] = useState('');
  const [website, setWebsite] = useState('');
  const [showWebsiteField, setShowWebsiteField] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const authorRef = useRef<HTMLInputElement>(null);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        if (author.trim()) {
          contentRef.current?.focus();
        } else {
          authorRef.current?.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, author]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Handle viewport resize (for mobile keyboard)
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (modalRef.current) {
        // Use visualViewport if available for accurate mobile keyboard handling
        const vh = window.visualViewport?.height || window.innerHeight;
        modalRef.current.style.height = `${vh}px`;
      }
    };

    // Initial setup
    handleResize();

    // Listen to both resize and visualViewport changes
    window.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('resize', handleResize);
    };
  }, [isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !content.trim()) return;

    try {
      setSubmitting(true);
      setError(null);
      await onSubmit({
        author: author.trim(),
        content: content.trim(),
        website: website.trim(),
      });
      // Clear form on success
      setContent('');
      setWebsite('');
      setShowWebsiteField(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit comment');
    } finally {
      setSubmitting(false);
    }
  }, [author, content, website, onSubmit, onClose]);

  // Handle Ctrl/Cmd + Enter to submit
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (author.trim() && content.trim() && !submitting) {
        handleSubmit(e as any);
      }
    }
  }, [author, content, submitting, handleSubmit]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className={cn(
        "fixed inset-0 z-50 flex flex-col",
        isTerminal
          ? "bg-[hsl(var(--background))]"
          : "bg-background"
      )}
      style={{ height: '100dvh' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="comment-modal-title"
    >
      {/* Header - Vim/Nano style */}
      {/* Header - Vim/Nano style */}
      <header
        className={cn(
          "flex items-center justify-between px-4 py-2 shrink-0",
          isTerminal
            ? "bg-primary/20 border-b border-primary/30"
            : "bg-card border-b border-border"
        )}
      >
        <span
          id="comment-modal-title"
          className={cn(
            "text-sm font-bold tracking-wide",
            isTerminal
              ? "font-mono text-primary terminal-glow"
              : "text-foreground"
          )}
        >
          {isTerminal ? "-- INSERT --" : "New Comment"}
        </span>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
              isTerminal
                ? "font-mono border border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50"
                : "border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
            )}
          >
            {isTerminal ? ":q!" : "Cancel"}
          </button>
          <button
            type="submit"
            form="comment-form"
            disabled={submitting || !author.trim() || !content.trim()}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all disabled:opacity-50",
              isTerminal
                ? "font-mono border border-primary bg-primary/20 text-primary hover:bg-primary/30 disabled:hover:bg-primary/20"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {isTerminal ? ":wq" : "Submit"}
          </button>
        </div>
      </header>

      {/* Form Content */}
      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="flex-1 flex flex-col overflow-hidden"
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Error display */}
          {error && (
            <div
              className={cn(
                "px-3 py-2 rounded-lg text-sm",
                isTerminal
                  ? "bg-destructive/20 text-destructive border border-destructive/30 font-mono"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {isTerminal ? `// Error: ${error}` : error}
            </div>
          )}

          {/* Author field */}
          <div className="space-y-2">
            <label
              htmlFor="modal-author"
              className={cn(
                "block text-sm font-medium",
                isTerminal
                  ? "font-mono text-primary"
                  : "text-foreground"
              )}
            >
              {isTerminal ? "$ name:" : "Name"}
            </label>
            <input
              ref={authorRef}
              id="modal-author"
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder={isTerminal ? "your_username" : "Your name"}
              required
              className={cn(
                "w-full px-4 py-3 text-base outline-none transition-all",
                isTerminal
                  ? "rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50"
                  : "rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              )}
            />
          </div>

          {/* Website toggle & field */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowWebsiteField(!showWebsiteField)}
              className={cn(
                "inline-flex items-center gap-2 text-sm transition-colors",
                isTerminal
                  ? "font-mono text-muted-foreground hover:text-primary"
                  : "text-muted-foreground hover:text-primary"
              )}
            >
              <Globe2 className="h-4 w-4" />
              {showWebsiteField
                ? isTerminal ? "// hide website" : "Hide website"
                : isTerminal ? "// add website (optional)" : "Add website (optional)"
              }
            </button>
            
            {showWebsiteField && (
              <input
                id="modal-website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://example.com"
                className={cn(
                  "w-full px-4 py-3 text-base outline-none transition-all animate-in slide-in-from-top-2 duration-200",
                  isTerminal
                    ? "rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50"
                    : "rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                )}
              />
            )}
          </div>

          {/* Comment content */}
          <div className="space-y-2 flex-1">
            <label
              htmlFor="modal-content"
              className={cn(
                "block text-sm font-medium",
                isTerminal
                  ? "font-mono text-primary"
                  : "text-foreground"
              )}
            >
              {isTerminal ? "$ comment:" : "Comment"}
            </label>
            <div className="relative">
              <textarea
                ref={contentRef}
                id="modal-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={isTerminal
                  ? "// write your thoughts here...\n// markdown supported"
                  : "Share your thoughts...\nMarkdown is supported"
                }
                required
                rows={6}
                className={cn(
                  "w-full px-4 py-3 text-base leading-relaxed outline-none transition-all resize-none",
                  isTerminal
                    ? "rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50"
                    : "rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                )}
              />
              {/* Blinking cursor effect for terminal mode */}
              {isTerminal && !content && (
                <span className="absolute left-4 top-3 font-mono text-primary animate-pulse pointer-events-none">
                  _
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer - explanatory text */}
        <footer
          className={cn(
            "shrink-0 px-4 py-2 border-t",
            isTerminal
              ? "bg-[hsl(var(--terminal-code-bg))] border-border"
              : "bg-muted/30 border-border"
          )}
        >
          <span
            className={cn(
              "text-xs text-center block",
              isTerminal
                ? "font-mono text-muted-foreground"
                : "text-muted-foreground"
            )}
          >
            {isTerminal
              ? "[ESC to cancel, Ctrl+Enter to submit]"
              : "Styling with Markdown is supported."
            }
          </span>
        </footer>
      </form>
    </div>
  );
}
