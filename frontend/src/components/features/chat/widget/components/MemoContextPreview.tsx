import ChatMarkdown from '@/components/molecules/ChatMarkdown';
import type { MemoContext } from '../hooks/useMemoContext';

export function MemoContextPreview({
  memo,
  enabled,
  onToggle,
}: {
  memo: MemoContext;
  enabled: boolean;
  onToggle: () => void;
}) {
  if (!memo.content.trim()) return null;
  return (
    <section
      className='mt-2 min-w-0 rounded-lg border border-border bg-muted/30'
      aria-label='현재 메모 문맥'
    >
      <div className='flex min-h-11 items-center justify-between gap-2 px-3'>
        <div className='min-w-0 text-xs'>
          <strong className='block truncate'>{memo.title}</strong>
          <span className='text-muted-foreground'>
            {enabled
              ? 'AI에게 함께 전달 · 작성 내용 실시간 반영'
              : 'AI에게 전달하지 않음'}
          </span>
        </div>
        <button
          type='button'
          aria-pressed={enabled}
          onClick={onToggle}
          className='min-h-11 shrink-0 rounded px-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring'
        >
          {enabled ? '메모 연결 해제' : '메모 연결'}
        </button>
      </div>
      {enabled && (
        <div className='max-h-28 overflow-auto overscroll-contain border-t border-border px-3 py-2 text-xs [overflow-wrap:anywhere]'>
          <ChatMarkdown content={memo.content} />
          {memo.truncated && (
            <p className='text-muted-foreground'>
              앞부분 6,000자까지 함께 전달합니다.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
