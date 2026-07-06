import { useEffect, useRef, useState, useCallback } from 'react';
import { Globe2, Loader2, Quote, Reply, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/ui/use-mobile';

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
  initialContent?: string;
  intent?: 'comment' | 'reply' | 'quote';
  contextLabel?: string;
  contextPreview?: string;
  label?: string;
  title?: string;
  cancelLabel?: string;
  submitLabel?: string;
  submittingLabel?: string;
  authorLabel?: string;
  authorPlaceholder?: string;
  websiteShowLabel?: string;
  websiteHideLabel?: string;
  websitePlaceholder?: string;
  contentLabel?: string;
  contentPlaceholder?: string;
  replyPlaceholder?: string;
  quotePlaceholder?: string;
  footerHint?: string;
}

const COMMENT_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const COMMENT_SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COMMENT_MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]+/g;
const COMMENT_ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const DEFAULT_COMMENT_MODAL_LABEL = 'Comment editor';
const DEFAULT_CANCEL_LABEL = 'Cancel';
const DEFAULT_TERMINAL_CANCEL_LABEL = ':q!';
const DEFAULT_SUBMIT_LABEL = 'Post';
const DEFAULT_TERMINAL_SUBMIT_LABEL = ':wq';
const DEFAULT_SUBMITTING_LABEL = 'Submitting';
const DEFAULT_AUTHOR_LABEL = 'Name';
const DEFAULT_TERMINAL_AUTHOR_LABEL = '$ name:';
const DEFAULT_AUTHOR_PLACEHOLDER = 'Your name';
const DEFAULT_TERMINAL_AUTHOR_PLACEHOLDER = 'your_username';
const DEFAULT_WEBSITE_SHOW_LABEL = 'Add website (optional)';
const DEFAULT_TERMINAL_WEBSITE_SHOW_LABEL = '// add website (optional)';
const DEFAULT_WEBSITE_HIDE_LABEL = 'Hide website';
const DEFAULT_TERMINAL_WEBSITE_HIDE_LABEL = '// hide website';
const DEFAULT_WEBSITE_PLACEHOLDER = 'https://example.com';
const DEFAULT_CONTENT_LABEL = 'Comment';
const DEFAULT_TERMINAL_CONTENT_LABEL = '$ comment:';
const DEFAULT_COMMENT_PLACEHOLDER = 'Share your thoughts...';
const DEFAULT_REPLY_PLACEHOLDER = 'Write a reply...';
const DEFAULT_QUOTE_PLACEHOLDER = 'Add your response below the quote...';
const DEFAULT_TERMINAL_CONTENT_PLACEHOLDER =
  '// write your thoughts here...\n// markdown supported';
const DEFAULT_FOOTER_HINT = 'Styling with Markdown is supported.';
const DEFAULT_TERMINAL_FOOTER_HINT = '[ESC to cancel, Ctrl+Enter to submit]';

function normalizeCommentSingleLine(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(COMMENT_ANSI_ESCAPE_PATTERN, ' ')
    .replace(COMMENT_SINGLE_LINE_CONTROL_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeCommentContent(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(COMMENT_ANSI_ESCAPE_PATTERN, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(COMMENT_MULTILINE_CONTROL_PATTERN, ' ')
    .trim();
}

function normalizeCommentLabel(value: unknown, fallback: string): string {
  return normalizeCommentSingleLine(value) || fallback;
}

function normalizeOptionalCommentLabel(value: unknown): string | undefined {
  return normalizeCommentSingleLine(value) || undefined;
}

function normalizeCommentPlaceholder(value: unknown, fallback: string): string {
  return normalizeCommentContent(value) || fallback;
}

function normalizeCommentWebsite(value: unknown): string {
  const website = normalizeCommentSingleLine(value);
  if (!website) return '';

  try {
    const decoded = decodeURIComponent(website);
    const parsed = new URL(website);
    if (
      COMMENT_CONTROL_PATTERN.test(decoded) ||
      parsed.username ||
      parsed.password ||
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    ) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

function getErrorMessage(error: unknown): string {
  return normalizeCommentSingleLine(error instanceof Error ? error.message : '')
    || 'Failed to submit comment';
}

export default function CommentInputModal({
  isOpen,
  onClose,
  onSubmit,
  isTerminal,
  initialAuthor = '',
  initialContent = '',
  intent = 'comment',
  contextLabel,
  contextPreview,
  label = DEFAULT_COMMENT_MODAL_LABEL,
  title,
  cancelLabel,
  submitLabel,
  submittingLabel = DEFAULT_SUBMITTING_LABEL,
  authorLabel,
  authorPlaceholder,
  websiteShowLabel,
  websiteHideLabel,
  websitePlaceholder = DEFAULT_WEBSITE_PLACEHOLDER,
  contentLabel,
  contentPlaceholder,
  replyPlaceholder,
  quotePlaceholder,
  footerHint,
}: CommentInputModalProps) {
  const [author, setAuthor] = useState(() => normalizeCommentSingleLine(initialAuthor));
  const [content, setContent] = useState('');
  const [website, setWebsite] = useState('');
  const [showWebsiteField, setShowWebsiteField] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMobile = useIsMobile();
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const authorRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setAuthor(normalizeCommentSingleLine(initialAuthor));
      setContent(normalizeCommentContent(initialContent));
      setError(null);
    }
  }, [isOpen, initialAuthor, initialContent]);

  // Focus management - only run when modal opens, not on every author change
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        // Use initialAuthor to determine focus, not the live author state
        if (initialAuthor?.trim()) {
          contentRef.current?.focus();
        } else {
          authorRef.current?.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen, initialAuthor]);

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
    if (!isOpen || !isMobile) return;

    const handleResize = () => {
      if (modalRef.current) {
        // Use visualViewport if available for accurate mobile keyboard handling
        const vh = window.visualViewport?.height || window.innerHeight;
        modalRef.current.style.height = `${vh}px`;

        // Scroll the focused element into view when keyboard opens
        const activeEl = document.activeElement;
        if (
          activeEl &&
          (activeEl === authorRef.current || activeEl === contentRef.current)
        ) {
          setTimeout(() => {
            activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 100);
        }
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
  }, [isOpen, isMobile]);

  const submitComment = useCallback(async () => {
    const trimmedAuthor = normalizeCommentSingleLine(author);
    const trimmedContent = normalizeCommentContent(content);
    const safeWebsite = normalizeCommentWebsite(website);

    if (submittingRef.current || !trimmedAuthor || !trimmedContent) return;

    try {
      submittingRef.current = true;
      setSubmitting(true);
      setError(null);
      await onSubmit({
        author: trimmedAuthor,
        content: trimmedContent,
        website: safeWebsite,
      });
      // Clear form on success
      setContent('');
      setWebsite('');
      setShowWebsiteField(false);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [author, content, website, onSubmit, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await submitComment();
    },
    [submitComment]
  );

  // Handle Ctrl/Cmd + Enter to submit
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (
          normalizeCommentSingleLine(author) &&
          normalizeCommentContent(content) &&
          !submitting
        ) {
          void submitComment();
        }
      }
    },
    [author, content, submitting, submitComment]
  );

  if (!isOpen) return null;

  const modalTitle = isTerminal
    ? '-- INSERT --'
    : intent === 'reply'
      ? 'Reply'
      : intent === 'quote'
        ? 'Quote'
        : 'Add to discussion';
  const safeDialogLabel = normalizeCommentLabel(label, DEFAULT_COMMENT_MODAL_LABEL);
  const safeDialogTitle = normalizeOptionalCommentLabel(title);
  const safeModalTitle = normalizeCommentLabel(modalTitle, 'Add to discussion');
  const safeCancelLabel = normalizeCommentLabel(
    cancelLabel,
    isTerminal ? DEFAULT_TERMINAL_CANCEL_LABEL : DEFAULT_CANCEL_LABEL
  );
  const safeSubmitLabel = normalizeCommentLabel(
    submitLabel,
    isTerminal ? DEFAULT_TERMINAL_SUBMIT_LABEL : DEFAULT_SUBMIT_LABEL
  );
  const safeSubmittingLabel = normalizeCommentLabel(submittingLabel, DEFAULT_SUBMITTING_LABEL);
  const safeAuthorLabel = normalizeCommentLabel(
    authorLabel,
    isTerminal ? DEFAULT_TERMINAL_AUTHOR_LABEL : DEFAULT_AUTHOR_LABEL
  );
  const safeAuthorPlaceholder = normalizeCommentLabel(
    authorPlaceholder,
    isTerminal ? DEFAULT_TERMINAL_AUTHOR_PLACEHOLDER : DEFAULT_AUTHOR_PLACEHOLDER
  );
  const safeWebsiteShowLabel = normalizeCommentLabel(
    websiteShowLabel,
    isTerminal ? DEFAULT_TERMINAL_WEBSITE_SHOW_LABEL : DEFAULT_WEBSITE_SHOW_LABEL
  );
  const safeWebsiteHideLabel = normalizeCommentLabel(
    websiteHideLabel,
    isTerminal ? DEFAULT_TERMINAL_WEBSITE_HIDE_LABEL : DEFAULT_WEBSITE_HIDE_LABEL
  );
  const safeWebsitePlaceholder = normalizeCommentLabel(
    websitePlaceholder,
    DEFAULT_WEBSITE_PLACEHOLDER
  );
  const safeContentLabel = normalizeCommentLabel(
    contentLabel,
    isTerminal ? DEFAULT_TERMINAL_CONTENT_LABEL : DEFAULT_CONTENT_LABEL
  );
  const safeContentPlaceholder = isTerminal
    ? normalizeCommentPlaceholder(contentPlaceholder, DEFAULT_TERMINAL_CONTENT_PLACEHOLDER)
    : intent === 'reply'
      ? normalizeCommentLabel(replyPlaceholder, DEFAULT_REPLY_PLACEHOLDER)
      : intent === 'quote'
        ? normalizeCommentLabel(quotePlaceholder, DEFAULT_QUOTE_PLACEHOLDER)
        : normalizeCommentLabel(contentPlaceholder, DEFAULT_COMMENT_PLACEHOLDER);
  const safeFooterHint = normalizeCommentLabel(
    footerHint,
    isTerminal ? DEFAULT_TERMINAL_FOOTER_HINT : DEFAULT_FOOTER_HINT
  );
  const safeContextLabel = normalizeOptionalCommentLabel(contextLabel);
  const safeContextPreview = normalizeCommentContent(contextPreview);
  const ContextIcon = intent === 'quote' ? Quote : Reply;
  const canSubmit =
    !submitting &&
    !!normalizeCommentSingleLine(author) &&
    !!normalizeCommentContent(content);

  // PC: Center popup with dimmed background
  // Mobile: Full screen modal
  return (
    <div
      className={cn(
        'fixed inset-0 z-[var(--z-modal-overlay)] flex',
        // PC: center alignment with dimmed overlay
        !isMobile && 'items-center justify-center bg-black/50 backdrop-blur-sm',
        // Mobile: full screen with background (prevents black screen issue)
        isMobile && 'flex-col bg-background'
      )}
      role='dialog'
      aria-modal='true'
      aria-labelledby='comment-modal-title'
      aria-label={safeDialogLabel}
      title={safeDialogTitle}
      onClick={
        !isMobile
          ? e => {
              if (e.target === e.currentTarget) onClose();
            }
          : undefined
      }
    >
      <div
        ref={modalRef}
        className={cn(
          'flex flex-col overflow-hidden',
          // PC styles: centered dialog
          !isMobile && [
            'w-full max-w-xl rounded-2xl shadow-2xl',
            isTerminal
              ? 'border border-primary/30 bg-[hsl(var(--background))]'
              : 'border border-border bg-background',
          ],
          // Mobile styles: full screen
          isMobile && [
            'w-full',
            isTerminal ? 'bg-[hsl(var(--background))]' : 'bg-background',
          ]
        )}
        style={isMobile ? { height: '100dvh' } : { maxHeight: '85vh' }}
      >
        {/* Header - Vim/Nano style */}
        <header
          className={cn(
            'flex items-center justify-between px-4 py-3 shrink-0',
            isTerminal
              ? 'bg-primary/20 border-b border-primary/30'
              : 'bg-card border-b border-border',
            // PC: rounded top corners
            !isMobile && 'rounded-t-2xl'
          )}
        >
          <span
            id='comment-modal-title'
            className={cn(
              'text-sm font-bold tracking-wide',
              isTerminal
                ? 'font-mono text-primary terminal-glow'
                : 'text-foreground'
            )}
          >
            {safeModalTitle}
          </span>

          {/* Action Buttons */}
          <div className='flex items-center gap-2'>
            <button
              type='button'
              onClick={onClose}
              disabled={submitting}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                isTerminal
                  ? 'font-mono border border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-50'
                  : 'border border-border text-muted-foreground hover:bg-muted disabled:opacity-50'
              )}
              aria-label={safeCancelLabel}
            >
              {safeCancelLabel}
            </button>
            <button
              type='submit'
              form='comment-form'
              disabled={!canSubmit}
              aria-label={submitting ? safeSubmittingLabel : safeSubmitLabel}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all disabled:opacity-50',
                isTerminal
                  ? 'font-mono border border-primary bg-primary/20 text-primary hover:bg-primary/30 disabled:hover:bg-primary/20'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {submitting ? (
                <Loader2 aria-hidden='true' className='h-3.5 w-3.5 animate-spin' />
              ) : (
                <Send aria-hidden='true' className='h-3.5 w-3.5' />
              )}
              {submitting ? safeSubmittingLabel : safeSubmitLabel}
            </button>
          </div>
        </header>

        {/* Form Content */}
        <form
          id='comment-form'
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          className='flex-1 flex flex-col overflow-hidden'
        >
          <div className='flex-1 overflow-y-auto p-4 space-y-4'>
            {/* Error display */}
            {error && (
              <div
                className={cn(
                  'px-3 py-2 rounded-lg text-sm',
                  isTerminal
                    ? 'bg-destructive/20 text-destructive border border-destructive/30 font-mono'
                    : 'bg-destructive/10 text-destructive'
                )}
              >
                {isTerminal ? `// Error: ${error}` : error}
              </div>
            )}

            {safeContextLabel && (
              <div
                className={cn(
                  'rounded-lg border px-3 py-2 text-sm',
                  isTerminal
                    ? 'border-primary/25 bg-primary/10 font-mono text-primary'
                    : 'border-primary/20 bg-primary/5 text-foreground'
                )}
              >
                <div className='flex items-center gap-2 font-medium'>
                  <ContextIcon aria-hidden='true' className='h-4 w-4 shrink-0' />
                  <span>{safeContextLabel}</span>
                </div>
                {safeContextPreview && (
                  <p
                    className={cn(
                      'mt-1 break-words text-xs leading-relaxed',
                      isTerminal
                        ? 'text-muted-foreground'
                        : 'text-muted-foreground'
                    )}
                  >
                    {safeContextPreview}
                  </p>
                )}
              </div>
            )}

            {/* Author field */}
            <div className='space-y-2'>
              <label
                htmlFor='modal-author'
                className={cn(
                  'block text-sm font-medium',
                  isTerminal ? 'font-mono text-primary' : 'text-foreground'
                )}
              >
                {safeAuthorLabel}
              </label>
              <input
                ref={authorRef}
                id='modal-author'
                type='text'
                value={author}
                onChange={e => setAuthor(e.target.value)}
                placeholder={safeAuthorPlaceholder}
                required
                className={cn(
                  'w-full px-4 py-3 text-base outline-none transition-all',
                  isTerminal
                    ? 'rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50'
                    : 'rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
                )}
                aria-label={safeAuthorLabel}
              />
            </div>

            {/* Website toggle & field */}
            <div className='space-y-2'>
              <button
                type='button'
                onClick={() => setShowWebsiteField(!showWebsiteField)}
                className={cn(
                  'inline-flex items-center gap-2 text-sm transition-colors',
                  isTerminal
                    ? 'font-mono text-muted-foreground hover:text-primary'
                    : 'text-muted-foreground hover:text-primary'
                )}
                aria-label={showWebsiteField ? safeWebsiteHideLabel : safeWebsiteShowLabel}
                aria-expanded={showWebsiteField}
              >
                <Globe2 aria-hidden='true' className='h-4 w-4' />
                {showWebsiteField
                  ? safeWebsiteHideLabel
                  : safeWebsiteShowLabel}
              </button>

              {showWebsiteField && (
                <input
                  id='modal-website'
                  type='url'
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder={safeWebsitePlaceholder}
                  aria-label={safeWebsiteShowLabel}
                  className={cn(
                    'w-full px-4 py-3 text-base outline-none transition-all animate-in slide-in-from-top-2 duration-200',
                    isTerminal
                      ? 'rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50'
                      : 'rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
                  )}
                />
              )}
            </div>

            {/* Comment content */}
            <div className='space-y-2 flex-1'>
              <label
                htmlFor='modal-content'
                className={cn(
                  'block text-sm font-medium',
                  isTerminal ? 'font-mono text-primary' : 'text-foreground'
                )}
              >
                {safeContentLabel}
              </label>
              <div className='relative'>
                <textarea
                  ref={contentRef}
                  id='modal-content'
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={safeContentPlaceholder}
                  aria-label={safeContentLabel}
                  required
                  rows={6}
                  className={cn(
                    'w-full px-4 py-3 text-base leading-relaxed outline-none transition-all resize-none',
                    isTerminal
                      ? 'rounded-lg border border-border bg-[hsl(var(--terminal-code-bg))] font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/50'
                      : 'rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
                  )}
                />
                {/* Blinking cursor effect for terminal mode */}
                {isTerminal && !content && (
                  <span className='absolute left-4 top-3 font-mono text-primary animate-pulse pointer-events-none'>
                    _
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer - explanatory text */}
          <footer
            className={cn(
              'shrink-0 px-4 py-2 border-t',
              isTerminal
                ? 'bg-[hsl(var(--terminal-code-bg))] border-border'
                : 'bg-muted/30 border-border',
              // PC: rounded bottom corners
              !isMobile && 'rounded-b-2xl',
              // Mobile: safe area padding
              isMobile && 'pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))]'
            )}
          >
            <span
              className={cn(
                'text-xs text-center block',
                isTerminal
                  ? 'font-mono text-muted-foreground'
                  : 'text-muted-foreground'
              )}
            >
              {safeFooterHint}
            </span>
          </footer>
        </form>
      </div>
    </div>
  );
}
