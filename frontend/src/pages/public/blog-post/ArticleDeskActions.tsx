import { useEffect, useState } from 'react';
import { Ellipsis, NotebookPen, Sparkles } from 'lucide-react';
import {
  ensureAIMemoElement,
  isFabEnabled,
} from '@/components/features/memo/fab/hooks/useFabState';
import type { SelectedBlockEventPayload } from '@/components/features/content-selection';
import { useToast } from '@/components/ui/use-toast';
import { useFeatureFlags } from '@/stores/runtime/useFeatureFlagsStore';

interface ArticleDeskActionsProps {
  title: string;
  content: string;
  year: string;
  slug: string;
  language: string;
  compact?: boolean;
}

/** Route article context to the established memo/chat owners without duplicating sessions. */
export function ArticleDeskActions({
  title,
  content,
  year,
  slug,
  language,
  compact = false,
}: ArticleDeskActionsProps) {
  const [enabled, setEnabled] = useState(isFabEnabled);
  const [toolsOpen, setToolsOpen] = useState(false);
  const { toast } = useToast();
  const { flags } = useFeatureFlags();
  const korean = language === 'ko';

  useEffect(() => {
    const sync = () => setEnabled(isFabEnabled());
    const tools = (event: Event) => { if (event instanceof CustomEvent) setToolsOpen(event.detail?.open === true); };
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('fieldnotes:reader-tools-state', tools);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('fieldnotes:reader-tools-state', tools);
    };
  }, []);

  if (!enabled) return null;

  const askAboutArticle = () => {
    const detail: SelectedBlockEventPayload = {
      title,
      markdown: content.slice(0, 6000),
      url: window.location.href,
      post: { year, slug, title },
    };
    window.dispatchEvent(
      new CustomEvent('aiMemo:askSelectedBlock', { detail })
    );
  };

  const openMemo = () => {
    if (!ensureAIMemoElement()?.shadowRoot) {
      toast({
        title: korean
          ? '메모를 준비하고 있습니다. 잠시 후 다시 열어주세요.'
          : 'The notebook is loading. Please try again shortly.',
      });
      return;
    }
    window.dispatchEvent(
      new CustomEvent('aiMemo:windowCommand', {
        detail: {
          action: 'open',
          ...(window.matchMedia('(min-width: 851px)').matches ? { mode: 'docked' } : {}),
        },
      })
    );
  };

  return (
    <>
      {flags.aiEnabled && <button
        type='button'
        className='rd-rail-action'
        onClick={askAboutArticle}
      >
        <Sparkles aria-hidden='true' />
        {compact
          ? korean
            ? '질문'
            : 'Ask'
          : korean
            ? '이 글에 질문하기'
            : 'Ask about this note'}
      </button>}
      <button type='button' className='rd-rail-action' onClick={openMemo}>
        <NotebookPen aria-hidden='true' />
        {compact
          ? korean
            ? '메모'
            : 'Notes'
          : korean
            ? '메모 열기'
            : 'Open notebook'}
      </button>
      {compact && (
        <button
          type='button'
          className='rd-mobile-more'
          aria-label={language === 'ko' ? '더 많은 도구' : 'More tools'}
          aria-expanded={toolsOpen}
          aria-controls='fieldnotes-reader-tools'
          onClick={() =>
            window.dispatchEvent(new Event('fieldnotes:reader-tools'))
          }
        >
          <Ellipsis aria-hidden='true' />
        </button>
      )}
    </>
  );
}
