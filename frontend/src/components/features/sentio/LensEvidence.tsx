import { Loader2, RotateCcw, Square } from 'lucide-react';
import ChatMarkdown from '@/components/molecules/ChatMarkdown';
import type { CardExplorationState } from '@/components/features/sentio/hooks/useCardExploration';

export type LensEvidenceProps = {
  state?: CardExplorationState;
  available: boolean;
  onGenerate: () => void;
  onStop: () => void;
};

export default function LensEvidence({
  state,
  available,
  onGenerate,
  onStop,
}: LensEvidenceProps) {
  const body = (state?.draft ?? state?.turns.at(-1))?.body;
  const busy = state?.status === 'connecting' || state?.status === 'streaming';
  const retry = state?.status === 'error' || state?.status === 'stopped';
  return (
    <section
      className='sentio-evidence-analysis'
      aria-label='AI 근거 상세 분석'
      aria-busy={busy}
    >
      {body && <ChatMarkdown content={body} isStreaming={busy} />}
      {busy && (
        <div className='sentio-evidence-status' role='status'>
          <Loader2
            size={16}
            className='animate-spin motion-reduce:animate-none'
            aria-hidden='true'
          />
          <span>
            {body
              ? '근거를 설명하고 있어요'
              : '각 요점의 근거를 분석하고 있어요'}
          </span>
          <button
            type='button'
            className='sentio-evidence-toggle'
            onClick={onStop}
          >
            <Square size={12} aria-hidden='true' /> 중지
          </button>
        </div>
      )}
      {state?.status === 'error' && (
        <p role='alert' className='sentio-exploration-error'>
          {state.error}
        </p>
      )}
      {state?.status === 'stopped' && (
        <p role='status'>근거 분석을 중지했습니다.</p>
      )}
      {!available && !busy && !body && (
        <p>현재 AI 분석을 사용할 수 없습니다.</p>
      )}
      {(!state || retry) && !busy && (
        <button
          type='button'
          className='sentio-evidence-toggle'
          disabled={!available}
          onClick={onGenerate}
        >
          {retry && <RotateCcw size={14} aria-hidden='true' />}
          {retry ? '근거 분석 다시 시도' : '근거 자세히 분석'}
        </button>
      )}
    </section>
  );
}
