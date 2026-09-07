import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { Check, Copy, Table2 } from 'lucide-react';

import { writeTextToClipboard } from '@/lib/markdown/clipboard';
import {
  serializeMarkdownTableRows,
  serializeRenderedMarkdownTable as serializeRenderedMarkdownTableCore,
} from '@/lib/markdown/tableText';
import { cn } from '@/lib/utils';

interface MarkdownTableProps {
  children?: ReactNode;
  variant?: 'article' | 'chat';
  isTerminal?: boolean;
}

type CopyState = 'idle' | 'copied' | 'failed';

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  if (!isValidElement(node)) return '';
  return nodeText((node as ReactElement<{ children?: ReactNode }>).props.children);
}

function rowsFromChildren(node: ReactNode): string[][] {
  const rows: string[][] = [];
  const visit = (child: ReactNode) => {
    if (!isValidElement(child)) return;
    const element = child as ReactElement<{ children?: ReactNode }>;
    if (element.type === 'tr') {
      rows.push(
        Children.toArray(element.props.children)
          .filter((cell) => isValidElement(cell))
          .map((cell) => nodeText(cell)),
      );
      return;
    }
    Children.forEach(element.props.children, visit);
  };
  Children.forEach(node, visit);
  return rows;
}

function serializeMarkdownTable(children: ReactNode): string {
  return serializeMarkdownTableRows(rowsFromChildren(children));
}

function serializeRenderedMarkdownTable(
  table: HTMLTableElement | null,
): string {
  return serializeRenderedMarkdownTableCore(table);
}

export function MarkdownTable({
  children,
  variant = 'article',
  isTerminal = false,
}: MarkdownTableProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<number | null>(null);
  const copyRequestRef = useRef(0);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const isChat = variant === 'chat';
  const viewportRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;
    const table = tableRef.current;
    if (!viewport || !table) return;
    const measure = () => setOverflowing(viewport.scrollWidth > viewport.clientWidth + 1);
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(viewport);
    observer?.observe(table);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [children]);

  useEffect(() => {
    copyRequestRef.current += 1;
    setCopyState('idle');
  }, [children]);

  useEffect(
    () => () => {
      copyRequestRef.current += 1;
      if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    },
    [],
  );

  const copyTable = useCallback(async () => {
    const renderedSource = serializeRenderedMarkdownTable(tableRef.current);
    const source = renderedSource || serializeMarkdownTable(children);
    const request = ++copyRequestRef.current;
    const copied = Boolean(source) && (await writeTextToClipboard(source));
    if (request !== copyRequestRef.current) return;
    setCopyState(copied ? 'copied' : 'failed');
    if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setCopyState('idle');
      resetTimer.current = null;
    }, 2000);
  }, [children]);

  const copyLabel =
    copyState === 'copied'
      ? '표 복사 완료'
      : copyState === 'failed'
        ? '표 복사 실패'
        : '표를 탭 구분 텍스트로 복사';

  return (
    <div
      data-markdown-table={variant}
      className={cn(
        isChat
          ? 'my-4 overflow-hidden rounded-lg border'
          : 'article-table-shell my-9 overflow-hidden rounded-2xl border border-border/70 bg-card/80 shadow-sm',
        isChat &&
          (isTerminal
            ? 'border-border bg-[hsl(var(--terminal-code-bg))]'
            : 'border-border/60 bg-muted/20'),
      )}
    >
      <div
        className={cn(
          'article-table-toolbar flex items-center justify-between gap-3 border-b px-3 py-2 text-xs font-medium',
          isChat &&
            (isTerminal
              ? 'border-border text-primary/70'
              : 'border-border/60 text-muted-foreground'),
          !isChat && 'border-border/70 text-muted-foreground',
        )}
      >
        <span className='inline-flex items-center gap-2'>
          <Table2 className='h-3.5 w-3.5' aria-hidden='true' />
          <span className={isTerminal ? 'font-mono uppercase tracking-wide' : ''}>
            표
          </span>
        </span>
        <button
          type='button'
          onClick={() => {
            void copyTable();
          }}
          aria-label={copyLabel}
          title={copyLabel}
          className='inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        >
          {copyState === 'copied' ? (
            <Check className='h-3.5 w-3.5' aria-hidden='true' />
          ) : (
            <Copy className='h-3.5 w-3.5' aria-hidden='true' />
          )}
          <span>{copyState === 'copied' ? '복사됨' : '복사'}</span>
        </button>
      </div>
      <div
        ref={viewportRef}
        role='region'
        aria-label={overflowing ? '표 내용. 가로로 스크롤할 수 있습니다.' : '표 내용'}
        tabIndex={0}
        className='article-table-scroll ui-scroll-region overflow-x-auto overscroll-x-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
      >
        <table
          ref={tableRef}
          className={cn(
            isChat
              ? 'w-full min-w-max text-left text-sm'
              : 'min-w-full divide-y divide-border',
            isTerminal && 'font-mono text-xs',
          )}
        >
          {children}
        </table>
      </div>
      {overflowing && !isChat && <div className='article-table-hint'>좌우로 스크롤하면 표의 나머지 열을 볼 수 있습니다.</div>}
      <span className='sr-only' aria-live='polite'>
        {copyState === 'copied'
          ? '표를 복사했습니다.'
          : copyState === 'failed'
            ? '표를 복사하지 못했습니다.'
            : ''}
      </span>
    </div>
  );
}
