import { isStructuredResponseText } from '@blog/shared/runtime/structured-response';
import { memo } from 'react';
import ChatMarkdown from '@/components/molecules/ChatMarkdown';

type ReadingSummaryProps = { summary?: string; points?: readonly string[] };

/** Render service text through the existing Markdown policy, never raw HTML. */
export default memo(function ReadingSummary({
  summary,
  points = [],
}: ReadingSummaryProps) {
  summary = isStructuredResponseText(summary) ? undefined : summary;
  const items = points.filter(
    (point): point is string => typeof point === 'string' && !!point.trim() && !isStructuredResponseText(point)
  );
  return (
    <div className='sentio-reading-summary'>
      {summary?.trim() && (
        <section className='sentio-summary-overview' aria-label='요약 본문'>
          <ChatMarkdown content={summary} />
        </section>
      )}
      {!!items.length && (
        <section className='sentio-summary-points' aria-label='핵심 포인트'>
          <div className='sentio-summary-section-heading'>
            <h3>핵심 포인트</h3>
            <span>{items.length}가지</span>
          </div>
          <ol>
            {items.map((point, index) => (
              <li key={`${index}-${point}`}>
                <span
                  className='sentio-summary-point-number'
                  aria-hidden='true'
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className='sentio-summary-point-text'>
                  <ChatMarkdown content={point} />
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
      {!summary?.trim() && !items.length && (
        <p className='sentio-summary-empty'>표시할 요약 내용이 없습니다.</p>
      )}
    </div>
  );
});
