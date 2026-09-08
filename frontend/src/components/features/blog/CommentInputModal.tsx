import { useEffect, useId, useRef, useState, useCallback } from 'react';
import { Bold, Code, Eye, Globe2, Italic, Loader2, PenLine, Quote, Reply, Send, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import CommentMarkdown from './CommentMarkdown';

interface CommentInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    author: string;
    content: string;
    website: string;
  }) => Promise<void>;
  isTerminal: boolean;
  /** Distinguishes post/reply contexts without persisting unpublished text. */
  draftKey?: string;
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


function commentDraftSignature(author: string, content: string, website: string): string {
  return JSON.stringify([normalizeCommentSingleLine(author), normalizeCommentContent(content), normalizeCommentSingleLine(website)]);
}

export default function CommentInputModal({
  isOpen, onClose, onSubmit, isTerminal, draftKey = '', initialAuthor = '', initialContent = '',
  intent = 'comment', contextLabel, contextPreview, label = DEFAULT_COMMENT_MODAL_LABEL,
  title, cancelLabel, submitLabel, submittingLabel = DEFAULT_SUBMITTING_LABEL,
  authorLabel, authorPlaceholder, websiteShowLabel, websiteHideLabel,
  websitePlaceholder = DEFAULT_WEBSITE_PLACEHOLDER, contentLabel, contentPlaceholder,
  replyPlaceholder, quotePlaceholder, footerHint,
}: CommentInputModalProps) {
  const [author, setAuthor] = useState(() => normalizeCommentSingleLine(initialAuthor));
  const [content, setContent] = useState(() => normalizeCommentContent(initialContent));
  const [website, setWebsite] = useState('');
  const [showWebsiteField, setShowWebsiteField] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dismissHint, setDismissHint] = useState('');
  const [preview, setPreview] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const authorRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const keepWritingRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const sessionRef = useRef(0);
  const wasOpenRef = useRef(false);
  const mountedRef = useRef(false);
  const initialSignatureRef = useRef(commentDraftSignature(initialAuthor, initialContent, ''));
  const contextKeyRef = useRef(draftKey);
  const id = useId();
  const formId = `${id}-form`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const dirty = commentDraftSignature(author, content, website) !== initialSignatureRef.current;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; sessionRef.current += 1; };
  }, []);

  useEffect(() => {
    // A parent rerender (theme, author update, SSE) must not replace an open draft.
    if (isOpen && !wasOpenRef.current) {
      sessionRef.current += 1;
      submittingRef.current = false;
      const nextAuthor = normalizeCommentSingleLine(initialAuthor);
      const nextContent = normalizeCommentContent(initialContent);
      setAuthor(nextAuthor); setContent(nextContent); setWebsite('');
      setShowWebsiteField(false); setSubmitting(false); setError(null);
      setConfirmDiscard(false); setDismissHint(''); setPreview(false);
      initialSignatureRef.current = commentDraftSignature(nextAuthor, nextContent, '');
      contextKeyRef.current = draftKey;
    }
    if (!isOpen && wasOpenRef.current) sessionRef.current += 1;
    wasOpenRef.current = isOpen;
  }, [isOpen, initialAuthor, initialContent, draftKey]);

  useEffect(() => {
    if (confirmDiscard) keepWritingRef.current?.focus();
  }, [confirmDiscard]);

  useEffect(() => {
    if (!isOpen) return;
    let frame = 0;
    const viewport = window.visualViewport;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const panel = modalRef.current;
        if (!panel) return;
        panel.style.setProperty('--ui-visual-height', `${viewport?.height ?? window.innerHeight}px`);
        panel.style.setProperty('--ui-visual-top', `${viewport?.offsetTop ?? 0}px`);
      });
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [isOpen]);

  const requestClose = useCallback(() => {
    if (submittingRef.current) {
      setDismissHint('전송 결과를 확인하는 중입니다. 완료 또는 오류가 표시될 때까지 입력을 유지합니다.');
      return;
    }
    if (dirty) { setConfirmDiscard(true); return; }
    onClose();
  }, [dirty, onClose]);

  const submitComment = useCallback(async () => {
    const trimmedAuthor = normalizeCommentSingleLine(author);
    const trimmedContent = normalizeCommentContent(content);
    if (submittingRef.current || !trimmedAuthor || !trimmedContent || confirmDiscard) return;
    if (draftKey !== contextKeyRef.current) {
      setError('댓글의 대상이 변경되었습니다. 작성 내용을 복사한 뒤 창을 닫고 다시 열어 주세요.');
      return;
    }
    const session = sessionRef.current;
    submittingRef.current = true;
    setSubmitting(true); setError(null); setDismissHint('');
    try {
      // Preserve the existing public payload and safe-URL normalization.
      await onSubmit({ author: trimmedAuthor, content: trimmedContent, website: normalizeCommentWebsite(website) });
      if (!mountedRef.current || session !== sessionRef.current) return;
      initialSignatureRef.current = commentDraftSignature(trimmedAuthor, '', '');
      setContent(''); setWebsite(''); setShowWebsiteField(false);
      onClose();
    } catch (err) {
      if (mountedRef.current && session === sessionRef.current) setError(getErrorMessage(err));
    } finally {
      if (mountedRef.current && session === sessionRef.current) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  }, [author, content, website, confirmDiscard, draftKey, onSubmit, onClose]);

  const safeDialogLabel = normalizeCommentLabel(label, DEFAULT_COMMENT_MODAL_LABEL);
  const safeDialogTitle = normalizeOptionalCommentLabel(title);
  const safeModalTitle = safeDialogTitle || (intent === 'reply' ? '답글 작성' : intent === 'quote' ? '인용하여 댓글 작성' : '댓글 작성');
  const safeCancelLabel = normalizeCommentLabel(cancelLabel, isTerminal ? DEFAULT_TERMINAL_CANCEL_LABEL : DEFAULT_CANCEL_LABEL);
  const safeSubmitLabel = normalizeCommentLabel(submitLabel, isTerminal ? DEFAULT_TERMINAL_SUBMIT_LABEL : DEFAULT_SUBMIT_LABEL);
  const safeSubmittingLabel = normalizeCommentLabel(submittingLabel, DEFAULT_SUBMITTING_LABEL);
  const safeAuthorLabel = normalizeCommentLabel(authorLabel, isTerminal ? DEFAULT_TERMINAL_AUTHOR_LABEL : DEFAULT_AUTHOR_LABEL);
  const safeAuthorPlaceholder = normalizeCommentLabel(authorPlaceholder, isTerminal ? DEFAULT_TERMINAL_AUTHOR_PLACEHOLDER : DEFAULT_AUTHOR_PLACEHOLDER);
  const safeWebsiteShowLabel = normalizeCommentLabel(websiteShowLabel, isTerminal ? DEFAULT_TERMINAL_WEBSITE_SHOW_LABEL : DEFAULT_WEBSITE_SHOW_LABEL);
  const safeWebsiteHideLabel = normalizeCommentLabel(websiteHideLabel, isTerminal ? DEFAULT_TERMINAL_WEBSITE_HIDE_LABEL : DEFAULT_WEBSITE_HIDE_LABEL);
  const safeWebsitePlaceholder = normalizeCommentLabel(websitePlaceholder, DEFAULT_WEBSITE_PLACEHOLDER);
  const safeContentLabel = normalizeCommentLabel(contentLabel, isTerminal ? DEFAULT_TERMINAL_CONTENT_LABEL : DEFAULT_CONTENT_LABEL);
  const safeContentPlaceholder = isTerminal
    ? normalizeCommentPlaceholder(contentPlaceholder, DEFAULT_TERMINAL_CONTENT_PLACEHOLDER)
    : intent === 'reply' ? normalizeCommentLabel(replyPlaceholder, DEFAULT_REPLY_PLACEHOLDER)
    : intent === 'quote' ? normalizeCommentLabel(quotePlaceholder, DEFAULT_QUOTE_PLACEHOLDER)
    : normalizeCommentPlaceholder(contentPlaceholder, DEFAULT_COMMENT_PLACEHOLDER);
  const safeFooterHint = normalizeCommentLabel(footerHint, isTerminal ? DEFAULT_TERMINAL_FOOTER_HINT : DEFAULT_FOOTER_HINT);
  const safeContextLabel = normalizeOptionalCommentLabel(contextLabel);
  const safeContextPreview = normalizeCommentContent(contextPreview);
  const canSubmit = !submitting && !confirmDiscard && !!normalizeCommentSingleLine(author) && !!normalizeCommentContent(content);
  const ContextIcon = intent === 'quote' ? Quote : Reply;
  const format = (kind: 'bold' | 'italic' | 'quote' | 'code') => {
    const editor = contentRef.current;
    if (!editor || submitting || preview) return;
    const start = editor.selectionStart, end = editor.selectionEnd;
    const selected = content.slice(start, end);
    const marker = kind === 'bold' ? '**' : kind === 'italic' ? '*' : selected.includes('\n') ? '```\n' : '`';
    const formatted = kind === 'quote' ? selected.replace(/^/gm, '> ') : `${marker}${selected}${marker === '```\n' ? '\n```' : marker}`;
    const before = content.slice(0, start), after = content.slice(end);
    const block = kind === 'quote' || marker === '```\n';
    const leading = block && before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    const trailing = block && after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
    setContent(before + leading + formatted + trailing + after);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + leading.length + (kind === 'quote' ? 2 : marker.length), start + leading.length + formatted.length - (kind === 'quote' ? 0 : marker.length));
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) requestClose(); }}>
      <DialogContent
        ref={modalRef} hideClose className="ui-dialog ui-comment-dialog"
        data-terminal={isTerminal || undefined} aria-label={safeDialogLabel}
        aria-labelledby={undefined} title={safeDialogTitle}
        onOpenAutoFocus={event => {
          event.preventDefault();
          openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          (normalizeCommentSingleLine(initialAuthor) ? contentRef : authorRef).current?.focus();
        }}
        onCloseAutoFocus={event => {
          if (openerRef.current?.isConnected) { event.preventDefault(); openerRef.current.focus(); }
        }}
        onEscapeKeyDown={event => { event.preventDefault(); requestClose(); }}
        onPointerDownOutside={event => { event.preventDefault(); requestClose(); }}
        onInteractOutside={event => event.preventDefault()}
      >
        <header className="ui-comment-heading">
          <div>
            <p className="ui-eyebrow">DISCUSSION</p>
            <DialogTitle className="ui-comment-title">{safeModalTitle}</DialogTitle>
            <DialogDescription className="ui-comment-description">의견과 질문을 남겨 주세요. 이름과 댓글은 다른 방문자에게 공개됩니다.</DialogDescription>
          </div>
          <button type="button" className="ui-comment-close" onClick={requestClose} disabled={submitting} aria-label="댓글 작성 창 닫기"><X aria-hidden="true" size={20} /></button>
        </header>
        <form id={formId} className="ui-comment-form" onSubmit={event => { event.preventDefault(); void submitComment(); }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); void submitComment(); }
          }}>
          <div className="ui-comment-scroll">
            {(safeContextLabel || safeContextPreview) && <div className="ui-comment-context">
              <p><ContextIcon aria-hidden="true" size={16} /><strong>{safeContextLabel || '인용한 내용'}</strong></p>
              {safeContextPreview && <blockquote>{safeContextPreview}</blockquote>}
            </div>}
            {error && <div id={errorId} className="ui-inline-error" role="alert"><p>{error}</p><p>작성 내용은 유지되어 있습니다. 전송 결과를 확인한 뒤 다시 시도해 주세요.</p></div>}
            <fieldset disabled={submitting} className="ui-comment-fields">
              <div className="ui-comment-author-row">
                <div className="ui-comment-field"><label htmlFor={`${id}-author`}>{safeAuthorLabel}<span>필수</span></label>
                  <input id={`${id}-author`} ref={authorRef} value={author} onChange={event => setAuthor(event.target.value)}
                    placeholder={safeAuthorPlaceholder} autoComplete="nickname" required className="ui-input" />
                </div>
                <button type="button" className="ui-comment-website-toggle" aria-expanded={showWebsiteField} aria-controls={`${id}-website-area`}
                  onClick={() => setShowWebsiteField(value => !value)}><Globe2 size={16} aria-hidden="true" />{showWebsiteField ? safeWebsiteHideLabel : safeWebsiteShowLabel}</button>
              </div>
              <div id={`${id}-website-area`} hidden={!showWebsiteField} className="ui-comment-field">
                <label htmlFor={`${id}-website`}>{safeWebsiteShowLabel}</label>
                <input id={`${id}-website`} value={website} onChange={event => setWebsite(event.target.value)} type="text" inputMode="url"
                  autoComplete="url" placeholder={safeWebsitePlaceholder} className="ui-input" />
              </div>
              <div className="ui-comment-field ui-comment-content-field">
                <label htmlFor={`${id}-content`}>{safeContentLabel}<span>필수</span></label>
                <div className='fn-comment-format' role='group' aria-label='댓글 서식'>
                  {([{ kind: 'bold', label: '굵게', Icon: Bold }, { kind: 'italic', label: '기울임', Icon: Italic }, { kind: 'quote', label: '인용', Icon: Quote }, { kind: 'code', label: '코드', Icon: Code }] as const).map(({ kind, label: formatLabel, Icon }) => <button key={kind} type='button' aria-label={formatLabel} title={formatLabel} disabled={preview} onClick={() => format(kind)}><Icon aria-hidden='true' /></button>)}
                  <button type='button' className='fn-comment-preview-toggle' aria-label={preview ? '댓글 편집' : '댓글 미리보기'} aria-pressed={preview} onClick={() => { setPreview(value => !value); if (preview) requestAnimationFrame(() => contentRef.current?.focus()); }}>{preview ? <PenLine aria-hidden='true' /> : <Eye aria-hidden='true' />}<span>{preview ? '편집' : '미리보기'}</span></button>
                </div>
                {preview && <div className='fn-comment-preview' role='region' aria-label='댓글 미리보기'>{content.trim() ? <CommentMarkdown content={content} isTerminal={isTerminal} /> : <p>아직 작성한 내용이 없습니다.</p>}</div>}
                <textarea id={`${id}-content`} ref={contentRef} value={content} onChange={event => setContent(event.target.value)} required rows={8}
                  hidden={preview} className="ui-textarea ui-comment-textarea" placeholder={safeContentPlaceholder} aria-describedby={`${hintId}${error ? ` ${errorId}` : ''}`} />
                <div className="ui-comment-writing-help"><span id={hintId}>{safeFooterHint}</span><span>{Array.from(content).length.toLocaleString()}자</span></div>
              </div>
            </fieldset>
          </div>
          {confirmDiscard && <div className="ui-comment-discard" role="group" aria-label="작성 내용 폐기 확인">
            <div><strong>작성 중인 내용을 버릴까요?</strong><p>아직 게시되지 않았습니다. 닫으면 이 창의 입력은 사라집니다.</p></div>
            <div className="ui-actions"><button type="button" className="ui-control" data-ui-variant="outline" ref={keepWritingRef}
              onClick={() => { setConfirmDiscard(false); setPreview(false); requestAnimationFrame(() => contentRef.current?.focus()); }}>계속 작성</button>
              <button type="button" className="ui-control" data-ui-variant="destructive" onClick={() => { setConfirmDiscard(false); onClose(); }}>버리고 닫기</button></div>
          </div>}
          <footer className="ui-comment-footer">
            <p className="ui-comment-save-state" role="status" aria-live="polite">{submitting ? safeSubmittingLabel : dismissHint || '게시 전 · 이 창의 입력은 서버에 저장되지 않았습니다.'}</p>
            <div className="ui-actions"><button type="button" onClick={requestClose} disabled={submitting || confirmDiscard} className="ui-control" data-ui-variant="outline">{safeCancelLabel}</button>
              <button type="submit" disabled={!canSubmit} className="ui-control" data-ui-variant="default" aria-label={submitting ? safeSubmittingLabel : safeSubmitLabel}>
                {submitting ? <Loader2 size={16} aria-hidden="true" className="animate-spin" /> : <Send size={16} aria-hidden="true" />}{submitting ? safeSubmittingLabel : safeSubmitLabel}
              </button></div>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}
