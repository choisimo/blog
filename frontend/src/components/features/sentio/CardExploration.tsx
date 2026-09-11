import { useId, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  RotateCcw,
  Square,
} from 'lucide-react';
import ChatMarkdown from '@/components/molecules/ChatMarkdown';
import type { CardExplorationState } from './hooks/useCardExploration';

export type CardExplorationProps = {
  state?: CardExplorationState;
  questions: string[];
  available: boolean;
  onExplore: (question: string) => void;
  onStop: () => void;
  onBack: () => void;
  onReset: () => void;
  composer?: { value: string; onChange: (value: string) => void };
};

export function CardExplorationBody({
  state,
}: {
  state: CardExplorationState;
}) {
  const turn = state.draft ?? state.turns.at(-1);
  const busy = state.status === 'connecting' || state.status === 'streaming';
  if (!turn) return null;
  return (
    <div className='sentio-exploration-body' aria-busy={busy}>
      <p className='sentio-exploration-question'>{turn.question}</p>
      {turn.body ? (
        <ChatMarkdown content={turn.body} isStreaming={busy} />
      ) : (
        <div className='sentio-exploration-pending'>
          <p>선택한 질문을 바탕으로 설명을 준비하고 있어요.</p>
          <span />
          <span />
          <span />
        </div>
      )}
      {state.status === 'error' && (
        <p className='sentio-exploration-error' role='alert'>
          {state.error}
        </p>
      )}
    </div>
  );
}

export default function CardExploration({
  state,
  questions,
  available,
  onExplore,
  onStop,
  onBack,
  onReset,
  composer,
}: CardExplorationProps) {
  const [localQuestion, setLocalQuestion] = useState('');
  const question = composer?.value ?? localQuestion;
  const setQuestion = composer?.onChange ?? setLocalQuestion;
  const inputId = useId();
  const busy = state?.status === 'connecting' || state?.status === 'streaming';
  const current = state?.draft ?? state?.turns.at(-1);
  const choices = current?.questions.length ? current.questions : questions;
  const status = busy
    ? state?.status === 'connecting'
      ? 'AI 에이전트 연결 중'
      : '답변을 작성하고 있어요'
    : state?.status === 'error'
      ? '연결 오류'
      : state?.status === 'stopped'
        ? '생성을 중지했어요'
        : '';
  return (
    <div className='sentio-exploration-controls'>
      {(status || state) && (
        <div className='sentio-exploration-toolbar'>
          <span className='sentio-exploration-status' role='status'>
            {busy && (
              <Loader2
                aria-hidden='true'
                size={14}
                className='animate-spin motion-reduce:animate-none'
              />
            )}
            {status}
          </span>
          {state && (
            <div className='sentio-exploration-history'>
              <button
                type='button'
                onClick={onBack}
                aria-label='이전 내용으로 돌아가기'
                title='이전 내용'
              >
                <ArrowLeft aria-hidden='true' size={16} />
              </button>
              <button
                type='button'
                onClick={onReset}
                aria-label='처음 카드로 돌아가기'
                title='처음 카드'
              >
                <RotateCcw aria-hidden='true' size={16} />
              </button>
            </div>
          )}
          {busy && (
            <button
              type='button'
              onClick={onStop}
              className='sentio-exploration-stop'
            >
              <Square aria-hidden='true' size={12} />
              중지
            </button>
          )}
        </div>
      )}
      {(state?.status === 'error' || state?.status === 'stopped') &&
        current && (
          <button
            type='button'
            className='sentio-exploration-choice'
            disabled={!available}
            onClick={() => onExplore(current.question)}
          >
            같은 질문으로 다시 시도
            <RotateCcw aria-hidden='true' size={14} />
          </button>
        )}
      {!busy && (
        <div className='sentio-exploration-choices'>
          {choices.slice(0, 3).map(choice => (
            <button
              type='button'
              className='sentio-exploration-choice'
              key={choice}
              disabled={!available}
              onClick={() => onExplore(choice)}
            >
              <span>{choice}</span>
              <ArrowUpRight aria-hidden='true' size={14} />
            </button>
          ))}
        </div>
      )}
      <form
        className='sentio-exploration-form'
        onSubmit={event => {
          event.preventDefault();
          if (question.trim() && !busy && available) {
            onExplore(question.trim());
            setQuestion('');
          }
        }}
      >
        <label htmlFor={inputId} className='sr-only'>
          이 카드에 이어서 질문하기
        </label>
        <input
          id={inputId}
          value={question}
          maxLength={500}
          onChange={event => setQuestion(event.target.value)}
          placeholder='궁금한 방향을 직접 물어보세요'
          disabled={busy || !available}
        />
        <button
          type='submit'
          disabled={!question.trim() || busy || !available}
          aria-label='질문 보내기'
        >
          <ArrowUpRight aria-hidden='true' size={18} />
        </button>
      </form>
    </div>
  );
}
