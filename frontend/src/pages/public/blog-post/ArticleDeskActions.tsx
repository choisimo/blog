import { Ellipsis, Layers, Map, NotebookPen, Sparkles } from 'lucide-react';
import { ensureAIMemoElement } from '@/components/features/memo/fab/hooks/useFabState';
import { Link } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  const { toast } = useToast();
  const { flags } = useFeatureFlags();
  const korean = language === 'ko';

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
          ...(window.matchMedia('(min-width: 851px)').matches
            ? { mode: 'docked' }
            : {}),
        },
      })
    );
  };

  return (
    <>
      {flags.aiEnabled && (
        <button
          type='button'
          className={
            compact
              ? 'rd-rail-action mobile-action-bar__button'
              : 'rd-rail-action'
          }
          data-primary='true'
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
        </button>
      )}
      <button
        type='button'
        className={
          compact
            ? 'rd-rail-action mobile-action-bar__button'
            : 'rd-rail-action'
        }
        onClick={openMemo}
      >
        <NotebookPen aria-hidden='true' />
        {compact
          ? korean
            ? '메모'
            : 'Notes'
          : korean
            ? '메모 열기'
            : 'Open notebook'}
      </button>
      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              className='rd-mobile-more'
              aria-label={korean ? '더 많은 도구' : 'More tools'}
            >
              <Ellipsis aria-hidden='true' />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' side='top'>
            <DropdownMenuItem
              onSelect={() =>
                window.dispatchEvent(new Event('visitedposts:open'))
              }
            >
              <Layers aria-hidden='true' />
              {korean ? '방문 기록' : 'Visited notes'}
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to='/insight'>
                <Map aria-hidden='true' />
                {korean ? '인사이트' : 'Insight'}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <>
          <button
            type='button'
            className='rd-rail-action'
            onClick={() => window.dispatchEvent(new Event('visitedposts:open'))}
          >
            <Layers aria-hidden='true' />
            {korean ? '방문 기록' : 'Visited notes'}
          </button>
          <Link className='rd-rail-action' to='/insight'>
            <Map aria-hidden='true' />
            {korean ? '인사이트' : 'Insight'}
          </Link>
        </>
      )}
    </>
  );
}
