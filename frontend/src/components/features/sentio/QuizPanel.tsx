import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { quiz, QuizQuestion } from "@/services/discovery/ai";
import {
  BookOpen,
  Loader2,
  CheckCircle,
  XCircle,
  RotateCcw,
  ChevronRight,
  Zap,
} from "lucide-react";
import CodeIDE from "@/components/features/sentio/CodeIDE";
import QuizRichContent from "@/components/features/sentio/QuizRichContent";

interface QuizPanelProps {
  content: string;
  postTitle?: string;
  postTags?: string[];
}

type QuizState = "idle" | "loading" | "active" | "complete";

interface AnswerState {
  value: string;
  submitted: boolean;
  correct: boolean;
}

// Max batches to pre-fetch (2 questions each = up to 10 questions total)
const MAX_BATCHES = 5;
const QUESTIONS_PER_BATCH = 2;
const STUDY_MODE_TAG_TRIGGERS = [
  "study",
  "학습",
  "algorithm",
  "알고리즘",
  "problem-solving",
  "problem_solving",
  "coding-test",
  "코딩테스트",
  "data-structure",
  "자료구조",
];

function normalizePostTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((tag) => (typeof tag === "string" ? tag.trim().toLowerCase() : ""))
    .filter(Boolean)
    .slice(0, 24);
}

function hasStudyModeTag(tags: string[]): boolean {
  return tags.some((tag) =>
    STUDY_MODE_TAG_TRIGGERS.some((trigger) => tag.includes(trigger)),
  );
}

function isCorrectAnswer(question: QuizQuestion, userAnswer: string): boolean {
  const normalized = userAnswer.trim().toLowerCase();
  const correct = question.answer.trim().toLowerCase();
  if (normalized === correct) return true;
  if (question.type === "multiple_choice") return normalized === correct;
  if (question.type === "fill_blank") {
    // Accept if user answer contains the key tokens
    const correctTokens = correct.split(/\s+/).filter((t) => t.length > 2);
    const matchCount = correctTokens.filter((t) =>
      normalized.includes(t),
    ).length;
    return matchCount >= Math.ceil(correctTokens.length * 0.6);
  }
  // For transform/explain: partial credit — if answer contains 60%+ of correct tokens
  const tokens = correct.split(/\s+/).filter((t) => t.length > 2);
  if (tokens.length === 0) return false;
  const matched = tokens.filter((t) => normalized.includes(t)).length;
  return matched / tokens.length >= 0.5;
}

export function QuizPanel({ content, postTitle, postTags }: QuizPanelProps) {
  const { isTerminal } = useTheme();
  const [state, setState] = useState<QuizState>("idle");
  // All loaded questions so far
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  // Whether the next batch is currently being fetched
  const [isFetchingNext, setIsFetchingNext] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerState[]>([]);
  const [wrongQuestions, setWrongQuestions] = useState<QuizQuestion[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Track how many batches we've requested (to avoid double-fetching)
  const batchFetchedRef = useRef(0);
  const isFetchingRef = useRef(false);
  // Pre-generated questions: populated silently after page load
  const preGeneratedRef = useRef<QuizQuestion[]>([]);

  const normalizedPostTags = normalizePostTags(postTags);

  // Trigger conditions: fenced code blocks OR learning-oriented tags
  const hasCodeBlocks = /```[\s\S]*?```/.test(content);
  const hasStudyTagTrigger = hasStudyModeTag(normalizedPostTags);
  const shouldEnableQuiz = hasCodeBlocks || hasStudyTagTrigger;

  // Study mode can be manually toggled; study-like tags auto-enable it by default
  const [studyMode, setStudyMode] = useState<boolean>(() => hasStudyTagTrigger);
  const questionsPerBatch = studyMode ? 3 : QUESTIONS_PER_BATCH;
  const maxBatches = studyMode ? 6 : MAX_BATCHES;

  useEffect(() => {
    if (hasStudyTagTrigger) {
      setStudyMode(true);
    }
  }, [hasStudyTagTrigger]);

  // Pre-generate quiz silently after page load so 'Start' is instant
  useEffect(() => {
    if (!shouldEnableQuiz) return;
    // Don't pre-gen if already in progress or already have data
    if (isFetchingRef.current || preGeneratedRef.current.length > 0) return;

    const timer = setTimeout(async () => {
      if (isFetchingRef.current || preGeneratedRef.current.length > 0) return;
      isFetchingRef.current = true;
      try {
        const result = await quiz({
          paragraph: content,
          postTitle,
          batchIndex: 0,
          previousQuestions: [],
          quizCount: questionsPerBatch,
          studyMode,
          postTags: normalizedPostTags,
        });
        if (result.quiz.length > 0) {
          preGeneratedRef.current = result.quiz;
        }
      } catch {
        // Silent fail — user will generate on demand when clicking start
      } finally {
        isFetchingRef.current = false;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    shouldEnableQuiz,
    content,
    postTitle,
    questionsPerBatch,
    studyMode,
    normalizedPostTags,
  ]);
  // Fetch a batch of questions
  const fetchBatch = useCallback(
    async (batchIndex: number, allQuestions: QuizQuestion[]) => {
      if (isFetchingRef.current) return;
      if (batchIndex >= maxBatches) return;
      isFetchingRef.current = true;
      setIsFetchingNext(true);

      try {
        const previousQs = allQuestions.map((q) => q.question);
        const result = await quiz({
          paragraph: content,
          postTitle,
          batchIndex,
          previousQuestions: previousQs,
          quizCount: questionsPerBatch,
          studyMode,
          postTags: normalizedPostTags,
          wrongQuestions: wrongQuestions.map((q) => q.question),
        });
        if (result.quiz.length > 0) {
          setQuestions((prev) => {
            const updated = [...prev, ...result.quiz];
            batchFetchedRef.current = batchIndex + 1;
            return updated;
          });
        }
      } catch (err) {
        console.error(`Quiz batch ${batchIndex} failed:`, err);
      } finally {
        isFetchingRef.current = false;
        setIsFetchingNext(false);
      }
    },
    [
      content,
      postTitle,
      maxBatches,
      questionsPerBatch,
      studyMode,
      normalizedPostTags,
      wrongQuestions,
    ],
  );

  const handleStart = useCallback(async () => {
    setState("loading");
    setError(null);
    setAnswers([]);
    setWrongQuestions([]);
    setCurrentIndex(0);
    setCurrentAnswer("");
    setQuestions([]);
    batchFetchedRef.current = 0;
    isFetchingRef.current = false;

    // Use pre-generated questions if already available — instant UX
    if (preGeneratedRef.current.length > 0) {
      const preGenerated = preGeneratedRef.current;
      preGeneratedRef.current = [];
      batchFetchedRef.current = 1;
      setQuestions(preGenerated);
      setState("active");
      // Pre-fetch batch 2 in background
      fetchBatch(1, preGenerated);
      return;
    }

    try {
      // Fetch first batch (Q1-Q2)
      const result = await quiz({
        paragraph: content,
        postTitle,
        batchIndex: 0,
        previousQuestions: [],
        quizCount: questionsPerBatch,
        studyMode,
        postTags: normalizedPostTags,
      });
      if (result.quiz.length === 0) throw new Error("No questions generated");
      batchFetchedRef.current = 1;
      setQuestions(result.quiz);
      setState("active");

      // Immediately start pre-fetching batch 2 (Q3-Q4) in background
      fetchBatch(1, result.quiz);
    } catch (err) {
      console.error("Quiz failed:", err);
      setError("퀴즈를 불러오는 데 실패했습니다. 다시 시도해주세요.");
      setState("idle");
    }
  }, [
    content,
    postTitle,
    fetchBatch,
    questionsPerBatch,
    studyMode,
    normalizedPostTags,
  ]);

  // When user moves to question N, pre-fetch the next batch if we're 1 question away from the end
  useEffect(() => {
    if (state !== "active") return;

    const questionsLoaded = questions.length;
    const distanceFromEnd = questionsLoaded - 1 - currentIndex;

    // Pre-fetch when user is on the last question of current batch
    if (
      distanceFromEnd <= 0 &&
      !isFetchingRef.current &&
      batchFetchedRef.current < maxBatches
    ) {
      fetchBatch(batchFetchedRef.current, questions);
    }
  }, [currentIndex, questions, state, fetchBatch, maxBatches]);

  const handleSubmitAnswer = useCallback(() => {
    const question = questions[currentIndex];
    const correct = isCorrectAnswer(question, currentAnswer);
    if (!correct) {
      setWrongQuestions((prev) => [
        ...prev.filter((q) => q.question !== question.question),
        question,
      ]);
    }
    setAnswers((prev) => [
      ...prev,
      { value: currentAnswer, submitted: true, correct },
    ]);
  }, [questions, currentIndex, currentAnswer]);

  const handleNext = useCallback(() => {
    const nextIndex = currentIndex + 1;

    if (nextIndex >= questions.length) {
      // We're at the last loaded question
      if (isFetchingRef.current || isFetchingNext) {
        // More questions coming — wait (UI shows loading)
        setCurrentIndex(nextIndex);
        setCurrentAnswer("");
      } else if (batchFetchedRef.current >= maxBatches) {
        // No more batches available
        setState("complete");
      } else {
        // Trigger fetch if not already running, then show loading
        setCurrentIndex(nextIndex);
        setCurrentAnswer("");
      }
    } else {
      setCurrentIndex(nextIndex);
      setCurrentAnswer("");
    }
  }, [currentIndex, questions.length, isFetchingNext, maxBatches]);

  const handleRetry = useCallback(() => {
    setState("idle");
    setQuestions([]);
    setAnswers([]);
    setWrongQuestions([]);
    setCurrentIndex(0);
    setCurrentAnswer("");
    setError(null);
    batchFetchedRef.current = 0;
    isFetchingRef.current = false;
  }, []);

  const currentQuestion = questions[currentIndex];
  const currentAnswerState = answers[currentIndex];
  const correctCount = answers.filter((a) => a.correct).length;
  const totalAnswered = answers.length;

  // Determine if we're waiting for next question to load
  const isWaitingForNext =
    state === "active" &&
    !currentQuestion &&
    (isFetchingNext || isFetchingRef.current);
  // Determine if we should show complete (no more questions and not fetching)
  const shouldShowComplete =
    state === "active" &&
    !currentQuestion &&
    !isFetchingNext &&
    !isFetchingRef.current &&
    batchFetchedRef.current >= maxBatches;

  // Return null after all hooks if no code blocks
  if (!shouldEnableQuiz) return null;

  return (
    <div
      data-testid="quiz-panel"
      className={cn(
        "my-8 max-w-4xl mx-auto rounded-2xl border shadow-sm overflow-hidden",
        isTerminal
          ? "bg-[hsl(var(--terminal-code-bg))] border-primary/20"
          : "bg-card/80 backdrop-blur-sm border-border/60",
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-3 px-6 py-4 border-b",
          isTerminal
            ? "border-primary/10 bg-primary/5"
            : "border-border/40 bg-muted/30",
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-xl",
            isTerminal ? "bg-primary/20" : "bg-primary/10",
          )}
        >
          <BookOpen className={cn("h-4 w-4", "text-primary")} />
        </div>
        <div>
          <h3
            className={cn(
              "font-semibold text-sm",
              isTerminal && "font-mono text-primary",
            )}
          >
            {isTerminal ? "$ quiz --interactive" : "AI 코드 퀴즈"}
          </h3>
          <p
            className={cn(
              "text-xs text-muted-foreground",
              isTerminal && "font-mono",
            )}
          >
            이 글의 코드를 기반으로 생성된 퀴즈
          </p>
          {studyMode && (
            <p
              className={cn(
                "text-[10px] text-primary/80",
                isTerminal && "font-mono",
              )}
            >
              학습 모드: 확장 문제 세트 활성화
            </p>
          )}
        </div>

        {state === "active" && (
          <div className="ml-auto flex items-center gap-2">
            {/* Next question loading indicator */}
            {isFetchingNext && (
              <span
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2 py-1 rounded-full",
                  isTerminal
                    ? "text-primary/60 bg-primary/10"
                    : "text-muted-foreground bg-muted/50",
                )}
              >
                <Zap className="h-3 w-3" />
                <span className={isTerminal ? "font-mono" : ""}>
                  다음 문제 준비 중
                </span>
              </span>
            )}
            <span
              className={cn(
                "text-xs text-muted-foreground",
                isTerminal && "font-mono",
              )}
            >
              {Math.min(currentIndex + 1, questions.length)} /{" "}
              {questions.length}
              {isFetchingNext && "+"}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        {/* Idle */}
        {state === "idle" && (
          <div className="flex flex-col items-center py-4 gap-4">
            <p
              className={cn(
                "text-sm text-center text-muted-foreground max-w-sm",
                isTerminal && "font-mono",
              )}
            >
              {hasCodeBlocks
                ? "이 글의 코드 예제를 학습했나요? AI가 코드 기반 심층 퀴즈를 출제합니다."
                : "학습 태그가 감지되어 퀴즈가 활성화되었습니다. 학습 모드로 더 다양한 문제를 풀어보세요."}
            </p>
            <button
              type="button"
              onClick={() => setStudyMode((prev) => !prev)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs border transition-colors",
                studyMode
                  ? isTerminal
                    ? "bg-primary/20 text-primary border-primary/40 font-mono"
                    : "bg-primary/10 text-primary border-primary/30"
                  : isTerminal
                    ? "text-muted-foreground border-primary/20 hover:text-primary hover:border-primary/40 font-mono"
                    : "text-muted-foreground border-border hover:text-foreground hover:border-primary/30",
              )}
              aria-pressed={studyMode}
            >
              {studyMode
                ? "학습 모드 ON (배치당 3문제)"
                : "학습 모드 OFF (배치당 2문제)"}
            </button>
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <button
              type="button"
              data-testid="quiz-start"
              onClick={handleStart}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm transition-all",
                "hover:scale-[1.02] active:scale-[0.98]",
                isTerminal
                  ? "bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
              )}
            >
              <BookOpen className="h-4 w-4" />
              퀴즈 시작하기
            </button>
          </div>
        )}

        {/* Initial loading */}
        {state === "loading" && (
          <div
            className={cn(
              "flex items-center justify-center gap-3 py-8",
              isTerminal ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className={cn("text-sm", isTerminal && "font-mono")}>
              코드 분석 중...
            </span>
          </div>
        )}

        {/* Waiting for next question to stream in */}
        {isWaitingForNext && (
          <div
            className={cn(
              "flex items-center justify-center gap-3 py-8",
              isTerminal ? "text-primary" : "text-muted-foreground",
            )}
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className={cn("text-sm", isTerminal && "font-mono")}>
              다음 문제 생성 중...
            </span>
          </div>
        )}

        {/* Show complete if ran out of questions */}
        {shouldShowComplete && (
          <CompleteView
            correctCount={correctCount}
            totalAnswered={totalAnswered}
            isTerminal={isTerminal}
            onRetry={handleRetry}
          />
        )}

        {/* Active question */}
        {state === "active" && currentQuestion && (
          <QuestionView
            question={currentQuestion}
            questionNumber={currentIndex + 1}
            answerState={currentAnswerState}
            currentAnswer={currentAnswer}
            onAnswerChange={setCurrentAnswer}
            onSubmit={handleSubmitAnswer}
            onNext={handleNext}
            isLast={
              currentIndex + 1 >= questions.length &&
              batchFetchedRef.current >= maxBatches
            }
            isTerminal={isTerminal}
            isNextLoading={
              isFetchingNext && currentIndex + 1 >= questions.length
            }
            isWrongQuestion={wrongQuestions.some(
              (q) => q.question === currentQuestion.question,
            )}
          />
        )}

        {/* Complete state (triggered by handleNext reaching end) */}
        {state === "complete" && (
          <CompleteView
            correctCount={correctCount}
            totalAnswered={totalAnswered}
            isTerminal={isTerminal}
            onRetry={handleRetry}
          />
        )}
      </div>
    </div>
  );
}

// --- Sub-components ---

interface QuestionViewProps {
  question: QuizQuestion;
  questionNumber: number;
  answerState: AnswerState | undefined;
  currentAnswer: string;
  onAnswerChange: (v: string) => void;
  onSubmit: () => void;
  onNext: () => void;
  isLast: boolean;
  isTerminal: boolean;
  isNextLoading: boolean;
  isWrongQuestion?: boolean;
}

function QuestionView({
  question,
  questionNumber,
  answerState,
  currentAnswer,
  onAnswerChange,
  onSubmit,
  onNext,
  isLast,
  isTerminal,
  isNextLoading,
  isWrongQuestion = false,
}: QuestionViewProps) {
  // Badge for question type
  const typeBadge: Record<string, string> = {
    fill_blank: "빈칸 채우기",
    multiple_choice: "선택형",
    transform: "변형 문제",
    explain: "실행 추론",
    system_modeling: "시스템 모델링",
    tradeoff_analysis: "트레이드오프 분석",
    refactoring_problem: "리팩토링 문제",
    concept_connection: "개념 연결",
  };

  return (
    <div
      data-testid="quiz-question"
      className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
    >
      {/* Type badge + question */}
      <div
        className={cn(
          "rounded-xl px-4 py-4 border space-y-2 min-w-0 overflow-hidden",
          isTerminal
            ? "bg-primary/5 border-primary/20"
            : "bg-muted/40 border-border/50",
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
              isTerminal
                ? "bg-primary/20 text-primary font-mono"
                : "bg-primary/10 text-primary",
            )}
          >
            {typeBadge[question.type] ?? question.type}
          </span>
          <span
            className={cn(
              "text-[10px] text-muted-foreground",
              isTerminal && "font-mono",
            )}
          >
            Q{questionNumber}
          </span>
          {isWrongQuestion && !answerState?.submitted && (
            <span
              className={cn(
                "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                isTerminal
                  ? "bg-orange-500/20 text-orange-400 border border-orange-500/30 font-mono"
                  : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20",
              )}
            >
              ⚠️ 재출제
            </span>
          )}
        </div>
        <div
          className={cn(
            "text-sm font-medium leading-relaxed break-words [overflow-wrap:anywhere]",
            isTerminal && "font-mono text-foreground/90",
          )}
        >
          <QuizRichContent
            content={question.question}
            isTerminal={isTerminal}
          />
        </div>
      </div>

      {/* Answer area */}
      {!answerState?.submitted && (
        <>
          {question.type === "multiple_choice" && question.options ? (
            <div className="space-y-2">
              {question.options.map((option, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onAnswerChange(option)}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-xl border text-sm transition-all",
                    "hover:scale-[1.005] active:scale-[0.998]",
                    currentAnswer === option
                      ? isTerminal
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-primary/10 border-primary text-primary font-medium"
                      : isTerminal
                        ? "bg-primary/5 border-primary/20 text-foreground/80 hover:bg-primary/10"
                        : "bg-background border-border/50 text-foreground/80 hover:bg-muted/50",
                  )}
                >
                  <span className="font-mono text-xs mr-3 opacity-50">
                    {String.fromCharCode(65 + i)}.
                  </span>
                  {option}
                </button>
              ))}
            </div>
          ) : question.type === "transform" || question.type === "explain" ? (
            <CodeIDE
              value={currentAnswer}
              onChange={onAnswerChange}
              question={question.question}
            />
          ) : question.type === "system_modeling" ? (
            <div className="space-y-3">
              <div
                className={cn(
                  "flex flex-wrap gap-2 text-[10px] font-medium",
                  isTerminal ? "font-mono text-primary/60" : "text-muted-foreground",
                )}
              >
                {["컴포넌트", "데이터 흐름", "입력/출력", "상호작용"].map((hint) => (
                  <span
                    key={hint}
                    className={cn(
                      "px-2 py-0.5 rounded-full border",
                      isTerminal
                        ? "border-primary/20 bg-primary/5"
                        : "border-border/50 bg-muted/30",
                    )}
                  >
                    {hint}
                  </span>
                ))}
              </div>
              <CodeIDE
                value={currentAnswer}
                onChange={onAnswerChange}
                question={question.question}
              />
            </div>
          ) : question.type === "tradeoff_analysis" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {["Option A", "Option B"].map((label) => (
                  <div
                    key={label}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-center text-xs font-semibold",
                      isTerminal
                        ? "border-primary/20 bg-primary/5 text-primary font-mono"
                        : "border-border/50 bg-muted/30 text-muted-foreground",
                    )}
                  >
                    {label}
                  </div>
                ))}
              </div>
              <CodeIDE
                value={currentAnswer}
                onChange={onAnswerChange}
                question={question.question}
              />
            </div>
          ) : question.type === "refactoring_problem" ? (
            <CodeIDE
              value={currentAnswer}
              onChange={onAnswerChange}
              question={question.question}
            />
          ) : question.type === "concept_connection" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3 justify-center">
                {question.question
                  .match(/[`"']([^`"']+)[`"']/g)
                  ?.slice(0, 2)
                  .map((concept, i) => (
                    <span
                      key={i}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border",
                        isTerminal
                          ? "bg-primary/15 border-primary/30 text-primary font-mono"
                          : "bg-primary/10 border-primary/20 text-primary",
                      )}
                    >
                      {concept.replace(/[`"']/g, "")}
                    </span>
                  )) ?? null}
              </div>
              <CodeIDE
                value={currentAnswer}
                onChange={onAnswerChange}
                question={question.question}
              />
            </div>
          ) : (
            <textarea
              value={currentAnswer}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder="코드 토큰을 입력하세요..."
              rows={2}
              className={cn(
                "w-full rounded-xl border px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50",
                isTerminal
                  ? "bg-[hsl(var(--terminal-code-bg))] border-primary/20 text-foreground font-mono"
                  : "bg-background border-border/50",
              )}
            />
          )}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!currentAnswer.trim()}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all",
              "disabled:opacity-40 disabled:cursor-not-allowed",
              isTerminal
                ? "bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            확인
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}

      {/* Feedback */}
      {answerState?.submitted && (
        <div
          data-testid="quiz-feedback"
          className={cn(
            "rounded-xl px-4 py-4 border space-y-3 animate-in fade-in-0 duration-200",
            answerState.correct
              ? isTerminal
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/40"
              : isTerminal
                ? "bg-red-500/10 border-red-500/30"
                : "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800/40",
          )}
        >
          <div className="flex items-center gap-2">
            {answerState.correct ? (
              <CheckCircle
                className={cn(
                  "h-4 w-4",
                  isTerminal
                    ? "text-emerald-400"
                    : "text-green-600 dark:text-green-400",
                )}
              />
            ) : (
              <XCircle
                className={cn(
                  "h-4 w-4",
                  isTerminal
                    ? "text-red-400"
                    : "text-red-600 dark:text-red-400",
                )}
              />
            )}
            <span
              className={cn(
                "text-sm font-medium",
                answerState.correct
                  ? isTerminal
                    ? "text-emerald-400"
                    : "text-green-700 dark:text-green-300"
                  : isTerminal
                    ? "text-red-400"
                    : "text-red-700 dark:text-red-300",
              )}
            >
              {answerState.correct ? "정답입니다!" : "틀렸습니다."}
            </span>
          </div>
          {!answerState.correct && (
            <div className={cn("text-sm space-y-1", isTerminal && "font-mono")}>
              <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                정답
              </span>
              <pre
                className={cn(
                  "text-xs rounded-lg px-3 py-2 overflow-x-auto whitespace-pre-wrap",
                  isTerminal
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-foreground",
                )}
              >
                {question.answer}
              </pre>
            </div>
          )}
          {question.explanation && (
            <div
              className={cn(
                "text-xs text-muted-foreground leading-relaxed",
                isTerminal && "font-mono",
              )}
            >
              <QuizRichContent
                content={question.explanation}
                isTerminal={isTerminal}
              />
            </div>
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={isNextLoading}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all mt-2",
              "disabled:opacity-60",
              isTerminal
                ? "bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {isNextLoading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                준비 중...
              </>
            ) : isLast ? (
              <>
                결과 보기
                <ChevronRight className="h-4 w-4" />
              </>
            ) : (
              <>
                다음 문제
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

interface CompleteViewProps {
  correctCount: number;
  totalAnswered: number;
  isTerminal: boolean;
  onRetry: () => void;
}

function CompleteView({
  correctCount,
  totalAnswered,
  isTerminal,
  onRetry,
}: CompleteViewProps) {
  const pct =
    totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
  return (
    <div className="flex flex-col items-center py-4 gap-4 animate-in fade-in-0 duration-300">
      <div
        className={cn(
          "flex items-center justify-center w-16 h-16 rounded-2xl mb-2",
          isTerminal ? "bg-primary/10" : "bg-primary/10",
        )}
      >
        <BookOpen className={cn("h-8 w-8 text-primary")} />
      </div>
      <div className="text-center space-y-1">
        <p
          className={cn(
            "text-2xl font-bold",
            isTerminal && "font-mono text-primary",
          )}
        >
          {correctCount} / {totalAnswered} 정답
        </p>
        <p
          className={cn(
            "text-sm font-medium",
            isTerminal ? "font-mono text-primary/60" : "text-muted-foreground",
          )}
        >
          정답률 {pct}%
        </p>
        <p
          className={cn(
            "text-sm text-muted-foreground mt-1",
            isTerminal && "font-mono",
          )}
        >
          {pct === 100
            ? "완벽합니다! 코드를 완전히 이해했어요 🎉"
            : pct >= 70
              ? "잘 했습니다! 놓친 코드 라인을 다시 확인해보세요."
              : "코드를 다시 읽고 각 라인의 역할을 분석해보세요!"}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all mt-2",
          "hover:scale-[1.02] active:scale-[0.98]",
          isTerminal
            ? "bg-primary/20 border border-primary/40 text-primary hover:bg-primary/30"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
        )}
      >
        <RotateCcw className="h-4 w-4" />
        다시 도전하기
      </button>
    </div>
  );
}

export default QuizPanel;
