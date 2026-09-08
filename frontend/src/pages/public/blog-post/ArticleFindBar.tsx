import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { findArticleRanges } from '@/utils/content/articleSearch';

const ALL_HITS = 'fieldnotes-search';
const CURRENT_HIT = 'fieldnotes-search-current';

export function ArticleFindBar({ onClose, content }: { onClose: () => void; content: string }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<{ ranges: Range[]; limited: boolean }>({ ranges: [], limited: false });
  const [index, setIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const nativeHighlights = typeof Highlight !== 'undefined' && typeof CSS !== 'undefined' && !!CSS.highlights;

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const boundary = document.querySelector<HTMLElement>('[data-reading-content]');
    if (!boundary) return;
    const collect = (preserveIndex = false) => {
      const root = boundary.querySelector<HTMLElement>('.article-flow');
      const next = root ? findArticleRanges(root, query) : { ranges: [], limited: false };
      setMatches(next);
      setIndex(current => preserveIndex ? Math.min(current, Math.max(0, next.ranges.length - 1)) : 0);
    };
    collect();
    const observer = new MutationObserver(() => collect(true));
    observer.observe(boundary, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [query, content]);
  useEffect(() => {
    if (!nativeHighlights) return;
    CSS.highlights.set(ALL_HITS, new Highlight(...matches.ranges));
    return () => { CSS.highlights.delete(ALL_HITS); CSS.highlights.delete(CURRENT_HIT); };
  }, [matches, nativeHighlights]);
  useEffect(() => {
    const range = matches.ranges[index];
    if (!range || !range.startContainer.isConnected) {
      if (nativeHighlights) CSS.highlights.delete(CURRENT_HIT);
      else window.getSelection()?.removeAllRanges();
      return;
    }
    if (nativeHighlights) {
      const current = new Highlight(range);
      current.priority = 1;
      CSS.highlights.set(CURRENT_HIT, current);
    } else {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    const parent = range.startContainer.parentElement;
    // Reveal a match in a collapsed code region through its existing control.
    const card = parent?.closest('.article-code-card');
    card?.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click();
    const rectangle = range.getBoundingClientRect();
    const header = document.querySelector('.ui-header')?.getBoundingClientRect().bottom || 76;
    window.scrollTo({ top: Math.max(0, window.scrollY + rectangle.top - header - 100), behavior: 'instant' });
  }, [index, matches, nativeHighlights]);
  useEffect(() => () => {
    if (!nativeHighlights) window.getSelection()?.removeAllRanges();
  }, [nativeHighlights]);
  const step = (direction: number) => {
    if (matches.ranges.length) setIndex(value => (value + direction + matches.ranges.length) % matches.ranges.length);
  };
  return createPortal(<section className='rd-findbar' aria-label='본문 검색' onKeyDown={event => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    if (event.key === 'Enter' && event.target === input.current) { event.preventDefault(); step(event.shiftKey ? -1 : 1); }
  }}>
    <input ref={input} aria-label='본문 검색어' type='search' value={query} onChange={event => setQuery(event.target.value)} placeholder='본문에서 찾기' />
    <output aria-live='polite' aria-label='검색 결과'>{matches.ranges.length ? `${index + 1}/${matches.ranges.length}${matches.limited ? '+' : ''}` : query.trim() ? '결과 없음' : '0/0'}</output>
    <button type='button' aria-label='이전 검색 결과' disabled={!matches.ranges.length} onClick={() => step(-1)}><ChevronUp aria-hidden='true' /></button>
    <button type='button' aria-label='다음 검색 결과' disabled={!matches.ranges.length} onClick={() => step(1)}><ChevronDown aria-hidden='true' /></button>
    <button type='button' aria-label='본문 검색 닫기' onClick={onClose}><X aria-hidden='true' /></button>
    <span className='sr-only' aria-live='polite'>{matches.ranges[index]?.startContainer.parentElement?.textContent?.slice(0, 200)}</span>
  </section>, document.body);
}
