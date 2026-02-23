import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { quiz, QuizQuestion, QuizResult } from '@/services/ai';
import { BookOpen, Loader2, CheckCircle, XCircle, RotateCcw, ChevronRight } from 'lucide-react';

interface QuizPanelProps {
  content: string;
  postTitle?: string;
}

type QuizState = 'idle' | 'loading' | 'active' | 'complete';

interface AnswerState {
  value: string;
  submitted: boolean;
  correct: boolean;
}

function isCorrectAnswer(question: QuizQuestion, userAnswer: string): boolean {
  const normalized = userAnswer.trim().toLowerCase();
  const correct = question.answer.trim().toLowerCase();
  if (normalized === correct) return true;
  // For multiple_choice, exact match (after normalization)
  if (question.type === 'multiple_choice') return normalized === correct;
  // For fill_blank: partial match allowed
  if (question.type === 'fill_blank') {
    return correct.includes(normalized) || normalized.includes(correct.slice(0, Math.min(correct.length, 20)));
  }
  return false;
}

export function QuizPanel({ content, postTitle }: QuizPanelProps) {
  const { isTerminal } = useTheme();
  const [state, setState] = useState<QuizState>('idle');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Only render if content has fenced code blocks
  const hasCodeBlocks = /```[\s\S]*?```/.test(content);
  if (!hasCodeBlocks) return null;

  const handleStart = useCallback(async () => {
    setState('loading');
    setError(null);
    setAnswers([]);
    setCurrentIndex(0);
    setCurrentAnswer('');

    try {
      const result: QuizResult = await quiz({ paragraph: content, postTitle });
      if (result.quiz.length === 0) throw new Error('No questions generated');
      setQuestions(result.quiz);
      setState('active');
    } catch (err) {
      console.error('Quiz failed:', err);
      setError('퀴즈를 불러오는 데 실패했습니다. 다시 시도해주세요.');
      setState('idle');
    }
  }, [content, postTitle]);

  const handleSubmitAnswer = useCallback(() => {
    const question = questions[currentIndex];
    const correct = isCorrectAnswer(question, currentAnswer);
    const newAnswers = [
      ...answers,
      { value: currentAnswer, submitted: true, correct },
    ];
    setAnswers(newAnswers);
  }, [questions, currentIndex, currentAnswer, answers]);

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= questions.length) {
      setState('complete');
    } else {
      setCurrentIndex(i => i + 1);
      setCurrentAnswer('');
    }
  }, [currentIndex, questions.length]);

  const handleRetry = useCallback(() => {
    setState('idle');
    setQuestions([]);
    setAnswers([]);
    setCurrentIndex(0);
    setCurrentAnswer('');
    setError(null);
  }, []);

  const currentQuestion = questions[currentIndex];
  const currentAnswerState = answers[currentIndex];
  const correctCount = answers.filter(a => a.correct).length;

  return (
    <div
      data-testid="quiz-panel"
      className={cn(
        'my-8 max-w-4xl mx-auto rounded-2xl border shadow-sm overflow-hidden',
        isTerminal
          ? 'bg-[hsl(var(--terminal-code-bg))] border-primary/20'
          : 'bg-card/80 backdrop-blur-sm border-border/60'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-3 px-6 py-4 border-b',
          isTerminal
            ? 'border-primary/10 bg-primary/5'
            : 'border-border/40 bg-muted/30'
        )}
      >
        <div
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-xl',
            isTerminal ? 'bg-primary/20' : 'bg-primary/10'
          )}
        >
          <BookOpen className={cn('h-4 w-4', isTerminal ? 'text-primary' : 'text-primary')} />
        </div>
        <div>
          <h3 className={cn('font-semibold text-sm', isTerminal && 'font-mono text-primary')}>
            {isTerminal ? '$ quiz --interactive' : 'AI 코드 퀴즈'}
          </h3>
          <p className={cn('text-xs text-muted-foreground', isTerminal && 'font-mono')}>
            이 글의 코드를 기반으로 생성된 퀴즈
          </p>
        </div>
        {state === 'active' && (
          <span className='ml-auto text-xs text-muted-foreground'>
            {currentIndex + 1} / {questions.length}
          </span>
        )}
      </div>

      {/* Content */}
      <div className='px-6 py-6'>
        {/* Idle state */}
        {state === 'idle' && (
          <div className='flex flex-col items-center py-4 gap-4'>
            <p className={cn('text-sm text-center text-muted-foreground max-w-sm', isTerminal && 'font-mono')}>
              이 글의 코드 예제를 학습했나요? AI가 맞춤형 퀴즈를 출제합니다.
            </p>
            {error && (
              <p className='text-sm text-destructive text-center'>{error}</p>
            )}
            <button
              type='button'
              data-testid='quiz-start'
              onClick={handleStart}
              className={cn(
                'flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all',
                'hover:scale-[1.02] active:scale-[0.98]',
                isTerminal
                  ? 'bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              )}
            >
              <BookOpen className='h-4 w-4' />
              퀴즈 시작하기
            </button>
          </div>
        )}

        {/* Loading state */}
        {state === 'loading' && (
          <div className={cn('flex items-center justify-center gap-3 py-8', isTerminal ? 'text-primary' : 'text-muted-foreground')}>
            <Loader2 className='h-5 w-5 animate-spin' />
            <span className={cn('text-sm', isTerminal && 'font-mono')}>퀴즈 생성 중...</span>
          </div>
        )}

        {/* Active state — question */}
        {state === 'active' && currentQuestion && (
          <div
            data-testid='quiz-question'
            className='space-y-5 animate-in fade-in-0 slide-in-from-bottom-2 duration-300'
          >
            {/* Question */}
            <div
              className={cn(
                'rounded-xl px-4 py-4 border',
                isTerminal
                  ? 'bg-primary/5 border-primary/20'
                  : 'bg-muted/40 border-border/50'
              )}
            >
              <p className={cn('text-sm font-medium leading-relaxed', isTerminal && 'font-mono text-foreground/90')}>
                {currentQuestion.question}
              </p>
            </div>

            {/* Answer input */}
            {!currentAnswerState?.submitted && (
              <>
                {currentQuestion.type === 'multiple_choice' && currentQuestion.options ? (
                  <div className='space-y-2'>
                    {currentQuestion.options.map((option, i) => (
                      <button
                        key={i}
                        type='button'
                        onClick={() => setCurrentAnswer(option)}
                        className={cn(
                          'w-full text-left px-4 py-3 rounded-xl border text-sm transition-all',
                          'hover:scale-[1.005] active:scale-[0.998]',
                          currentAnswer === option
                            ? isTerminal
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-primary/10 border-primary text-primary font-medium'
                            : isTerminal
                              ? 'bg-primary/5 border-primary/20 text-foreground/80 hover:bg-primary/10'
                              : 'bg-background border-border/50 text-foreground/80 hover:bg-muted/50'
                        )}
                      >
                        <span className={cn('font-mono text-xs mr-3 opacity-50')}>
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={currentAnswer}
                    onChange={e => setCurrentAnswer(e.target.value)}
                    placeholder={
                      currentQuestion.type === 'fill_blank'
                        ? '답을 입력하세요...'
                        : '코드를 작성하거나 설명을 입력하세요...'
                    }
                    rows={currentQuestion.type === 'fill_blank' ? 2 : 5}
                    className={cn(
                      'w-full rounded-xl border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50',
                      isTerminal
                        ? 'bg-[hsl(var(--terminal-code-bg))] border-primary/20 text-foreground font-mono'
                        : 'bg-background border-border/50'
                    )}
                  />
                )}
                <button
                  type='button'
                  onClick={handleSubmitAnswer}
                  disabled={!currentAnswer.trim()}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                    isTerminal
                      ? 'bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  확인
                  <ChevronRight className='h-4 w-4' />
                </button>
              </>
            )}

            {/* Feedback */}
            {currentAnswerState?.submitted && (
              <div
                data-testid='quiz-feedback'
                className={cn(
                  'rounded-xl px-4 py-4 border space-y-3 animate-in fade-in-0 duration-200',
                  currentAnswerState.correct
                    ? isTerminal
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/40'
                    : isTerminal
                      ? 'bg-red-500/10 border-red-500/30'
                      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/40'
                )}
              >
                <div className='flex items-center gap-2'>
                  {currentAnswerState.correct ? (
                    <CheckCircle className={cn('h-4 w-4', isTerminal ? 'text-emerald-400' : 'text-green-600 dark:text-green-400')} />
                  ) : (
                    <XCircle className={cn('h-4 w-4', isTerminal ? 'text-red-400' : 'text-red-600 dark:text-red-400')} />
                  )}
                  <span className={cn(
                    'text-sm font-medium',
                    currentAnswerState.correct
                      ? isTerminal ? 'text-emerald-400' : 'text-green-700 dark:text-green-300'
                      : isTerminal ? 'text-red-400' : 'text-red-700 dark:text-red-300'
                  )}>
                    {currentAnswerState.correct ? '정답입니다!' : '틀렸습니다.'}
                  </span>
                </div>
                {!currentAnswerState.correct && (
                  <p className={cn('text-sm', isTerminal && 'font-mono')}>
                    <span className='font-medium'>정답: </span>
                    {currentQuestion.answer}
                  </p>
                )}
                {currentQuestion.explanation && (
                  <p className={cn('text-xs text-muted-foreground leading-relaxed', isTerminal && 'font-mono')}>
                    {currentQuestion.explanation}
                  </p>
                )}
                <button
                  type='button'
                  onClick={handleNext}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all mt-2',
                    isTerminal
                      ? 'bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  {currentIndex + 1 >= questions.length ? '결과 보기' : '다음 문제'}
                  <ChevronRight className='h-4 w-4' />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Complete state */}
        {state === 'complete' && (
          <div className='flex flex-col items-center py-4 gap-4 animate-in fade-in-0 duration-300'>
            <div className={cn(
              'flex items-center justify-center w-16 h-16 rounded-2xl mb-2',
              isTerminal ? 'bg-primary/10' : 'bg-primary/10'
            )}>
              <BookOpen className={cn('h-8 w-8', isTerminal ? 'text-primary' : 'text-primary')} />
            </div>
            <div className='text-center space-y-1'>
              <p className={cn('text-2xl font-bold', isTerminal && 'font-mono text-primary')}>
                {correctCount} / {questions.length} 정답
              </p>
              <p className={cn('text-sm text-muted-foreground', isTerminal && 'font-mono')}>
                {correctCount === questions.length
                  ? '완벽합니다! 모든 문제를 맞혔어요 🎉'
                  : correctCount >= questions.length * 0.7
                    ? '잘 했습니다! 조금만 더 복습해보세요.'
                    : '다시 한번 읽어보고 도전해보세요!'}
              </p>
            </div>
            <button
              type='button'
              onClick={handleRetry}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all mt-2',
                'hover:scale-[1.02] active:scale-[0.98]',
                isTerminal
                  ? 'bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
              )}
            >
              <RotateCcw className='h-4 w-4' />
              다시 도전하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizPanel;
