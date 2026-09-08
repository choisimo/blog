import { useEffect, useRef, useState } from 'react';
import { Bookmark, BookmarkCheck, Ellipsis, Focus, Loader2, MessageSquare, Printer, Search, Share2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsBookmarked } from '@/hooks/content/useBookmarks';
import { useFeatureFlags } from '@/stores/runtime/useFeatureFlagsStore';
import { summary, type SummaryResult } from '@/services/discovery/ai';
import { ArticleFindBar } from './ArticleFindBar';

interface ArticleReadingToolsProps {
  postId: string;
  title: string;
  content: string;
  onShare: () => void;
}

/** Local reading controls reuse bookmark storage and the established summary task. */
export function ArticleReadingTools({ postId, title, content, onShare }: ArticleReadingToolsProps) {
  const { bookmarked, toggleBookmark } = useIsBookmarked(postId);
  const { flags } = useFeatureFlags();
  const [bookmarkError, setBookmarkError] = useState('');
  const [findOpen, setFindOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [summaryState, setSummaryState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const findTrigger = useRef<HTMLButtonElement>(null);
  const request = useRef(0);
  const pending = useRef(false);
  useEffect(() => {
    request.current += 1;
    pending.current = false;
    setResult(null);
    setSummaryState('idle');
    return () => { request.current += 1; };
  }, [content, title]);
  const generate = async () => {
    if (pending.current || !flags.aiEnabled) return;
    pending.current = true;
    const epoch = ++request.current;
    setSummaryState('loading');
    try {
      const value = await summary({ paragraph: content, postTitle: title, strict: true });
      if (epoch !== request.current) return;
      setResult(value);
      setSummaryState('ready');
    } catch {
      if (epoch === request.current) setSummaryState('error');
    } finally {
      if (epoch === request.current) pending.current = false;
    }
  };
  const closeFind = () => { setFindOpen(false); findTrigger.current?.focus({ preventScroll: true }); };
  return <>
    <div className='rd-tools-right' role='group' aria-label='읽기 도구 모음'>
      <button type='button' className='rd-summary-trigger' aria-label='핵심 요약' disabled={!flags.aiEnabled} title={flags.aiEnabled ? '핵심 요약' : '현재 AI 요약을 사용할 수 없습니다'} onClick={() => {
        setSummaryOpen(true);
        if (summaryState === 'idle') void generate();
      }}><Sparkles aria-hidden='true' /><span>핵심 요약</span></button>
      <button type='button' aria-label={bookmarked ? '북마크 해제' : '글 북마크'} aria-pressed={bookmarked} title={bookmarked ? '북마크 해제' : '다시 읽기 위해 저장'} onClick={() => {
        const next = toggleBookmark();
        setBookmarkError(next === bookmarked ? '북마크를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.' : '');
      }}>{bookmarked ? <BookmarkCheck aria-hidden='true' /> : <Bookmark aria-hidden='true' />}</button>
      <button type='button' aria-label='글 공유' title='글 공유' onClick={onShare}><Share2 aria-hidden='true' /></button>
      <button ref={findTrigger} type='button' aria-label='본문 검색' title='본문 검색' aria-expanded={findOpen} onClick={() => setFindOpen(value => !value)}><Search aria-hidden='true' /></button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type='button' aria-label='더 많은 읽기 도구' title='더 많은 읽기 도구'><Ellipsis aria-hidden='true' /></button></DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='rd-reading-menu'>
          <DropdownMenuItem onSelect={() => document.getElementById('article-discussion')?.scrollIntoView({ block: 'start', behavior: 'instant' })}><MessageSquare aria-hidden='true' />댓글로 이동</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => window.dispatchEvent(new Event('fieldnotes:toggle-focus'))}><Focus aria-hidden='true' />집중해서 읽기</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => window.print()}><Printer aria-hidden='true' />인쇄하기</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    {bookmarkError && <p className='rd-tool-error' role='alert'>{bookmarkError}</p>}
    {findOpen && <ArticleFindBar content={content} onClose={closeFind} />}
    <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
      <DialogContent className='rd-summary-dialog'>
        <p className='fn-eyebrow'>READING NOTES</p>
        <DialogTitle>핵심 요약</DialogTitle>
        <DialogDescription>{title}</DialogDescription>
        {summaryState === 'loading' && <p role='status'><Loader2 className='motion-safe:animate-spin' aria-hidden='true' />요약을 준비하고 있습니다.</p>}
        {summaryState === 'error' && <div role='alert'><p>요약을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p><button type='button' className='ui-control' data-ui-variant='outline' onClick={() => void generate()}>다시 시도</button></div>}
        {summaryState === 'ready' && result && <div className='rd-summary-body'><p>{result.summary}</p>{!!result.keyPoints?.length && <ul>{result.keyPoints.map((point, index) => <li key={index}>{point}</li>)}</ul>}<p className='rd-summary-note'>AI가 작성한 요약입니다. 세부 내용은 본문과 함께 확인해 주세요.</p></div>}
      </DialogContent>
    </Dialog>
  </>;
}
