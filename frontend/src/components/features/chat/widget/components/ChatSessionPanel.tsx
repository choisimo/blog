import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatSessionMeta, QuestionMode } from "../types";

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const ANSI_ESCAPE_DETECTOR = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/;
const PANEL_CONTROL_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const PANEL_ID_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;

type ChatSessionPanelProps = {
  sessions: ChatSessionMeta[];
  selectedSessionIds: string[];
  onToggleSession: (id: string) => void;
  onLoadSession: (id: string) => void;
  onClose: () => void;
  onAggregateSelected: () => void;
  isTerminal: boolean;
  isMobile: boolean;
};

function normalizePanelSessionId(sessionId: unknown): string | null {
  if (typeof sessionId !== "string") return null;
  const value = sessionId.trim();
  if (!value || ANSI_ESCAPE_DETECTOR.test(value) || PANEL_ID_CONTROL_PATTERN.test(value)) return null;
  return value;
}

function stripUnsafePanelControls(value: string): string {
  return value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(PANEL_CONTROL_TEXT_PATTERN, "");
}

function normalizePanelLabel(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const normalized = stripUnsafePanelControls(value)
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function normalizePanelDate(value: unknown): { label: string; dateTime?: string } {
  const date = new Date(value as string | number | Date);
  if (Number.isNaN(date.getTime())) {
    return { label: "날짜 없음" };
  }

  return {
    label: date.toLocaleDateString(),
    dateTime: date.toISOString(),
  };
}

export function ChatSessionPanel({
  sessions,
  selectedSessionIds,
  onToggleSession,
  onLoadSession,
  onClose,
  onAggregateSelected,
  isTerminal,
  isMobile,
}: ChatSessionPanelProps) {
  const visibleSessions = sessions.flatMap((session) => {
    const id = normalizePanelSessionId(session.id);
    return id ? [{ ...session, id }] : [];
  });
  const normalizedSelectedSessionIds = selectedSessionIds.flatMap((id) => {
    const normalized = normalizePanelSessionId(id);
    return normalized ? [normalized] : [];
  });

  if (visibleSessions.length === 0) return null;

  return (
    <div
      aria-label="최근 대화 세션"
      className={cn(
        "border-b shrink-0",
        isTerminal
          ? "bg-[hsl(var(--terminal-code-bg))] border-border"
          : "bg-muted/40",
      )}
      role="region"
    >
      <div
        className={cn(
          "px-4 pt-3 max-h-48 overflow-y-auto overscroll-contain space-y-2",
          isMobile && "px-4",
        )}
      >
        {visibleSessions.map((s) => {
          const checked = normalizedSelectedSessionIds.includes(s.id);
          const title = normalizePanelLabel(s.title, "제목 없음");
          const articleTitle = normalizePanelLabel(s.articleTitle);
          const dateMeta = normalizePanelDate(s.updatedAt);
          return (
            <div
              key={s.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isTerminal
                  ? "border border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                  : "border hover:bg-muted",
              )}
            >
              <input
                type="checkbox"
                aria-label={`대화 선택: ${title}`}
                className={cn("h-4 w-4 rounded", isTerminal && "accent-primary")}
                checked={checked}
                onChange={() => onToggleSession(s.id)}
              />
              <button
                type="button"
                aria-label={`대화 불러오기: ${title}`}
                className="flex-1 text-left min-w-0"
                onClick={() => {
                  onLoadSession(s.id);
                  onClose();
                }}
                title={title}
              >
                <div
                  className={cn(
                    "truncate font-medium text-sm",
                    isTerminal && "font-mono text-foreground",
                  )}
                >
                  {title}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground truncate mt-0.5">
                  {articleTitle && (
                    <span className="truncate max-w-[120px]">
                      {articleTitle}
                    </span>
                  )}
                  <time className="shrink-0" dateTime={dateMeta.dateTime}>
                    {dateMeta.label}
                  </time>
                </div>
              </button>
            </div>
          );
        })}
      </div>
      <div
        className={cn(
          "px-4 py-3 border-t flex items-center justify-between",
          isTerminal && "border-border",
        )}
      >
        <span
          aria-live="polite"
          className={cn("text-xs text-muted-foreground", isTerminal && "font-mono")}
        >
          선택: {normalizedSelectedSessionIds.length}개
        </span>
        <Button
          type="button"
          size="sm"
          className={cn(
            "h-8 px-3 text-xs",
            isTerminal &&
              "bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30",
          )}
          disabled={!normalizedSelectedSessionIds.length}
          aria-label={`선택한 대화 ${normalizedSelectedSessionIds.length}개 통합 질문하기`}
          onClick={onAggregateSelected}
        >
          통합 질문하기
        </Button>
      </div>
    </div>
  );
}

type ModeSelectorProps = {
  questionMode: QuestionMode;
  onModeChange: (mode: QuestionMode) => void;
  isTerminal: boolean;
  isMobile: boolean;
};

export function ModeSelector({
  questionMode,
  onModeChange,
  isTerminal,
  isMobile,
}: ModeSelectorProps) {
  if (isTerminal) {
    return (
      <div
        className={cn(
          "flex items-center justify-between border-b px-4 py-2 shrink-0",
          "border-border font-mono bg-[hsl(var(--terminal-code-bg))]",
        )}
      >
        <span className="text-xs text-muted-foreground/60">Mode:</span>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            aria-label="모드 선택: 이 글 관련"
            aria-pressed={questionMode === "article"}
            onClick={() => onModeChange("article")}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 border transition-all",
              questionMode === "article"
                ? "border-solid border-primary/60 text-primary bg-primary/10"
                : "border-dotted border-muted-foreground/30 text-muted-foreground hover:border-primary/40 hover:text-primary/70",
            )}
          >
            <span className="text-terminal-amber">[</span>
            <span className={questionMode === "article" ? "text-primary crt-text-glow" : "opacity-0"}>X</span>
            <span className="text-terminal-amber">]</span>
            <span className="ml-1">이 글 관련</span>
          </button>
          <button
            type="button"
            aria-label="모드 선택: 자유 대화"
            aria-pressed={questionMode === "general"}
            onClick={() => onModeChange("general")}
            className={cn(
              "flex items-center gap-1 px-2 py-1.5 border transition-all",
              questionMode === "general"
                ? "border-solid border-primary/60 text-primary bg-primary/10"
                : "border-dotted border-muted-foreground/30 text-muted-foreground hover:border-primary/40 hover:text-primary/70",
            )}
          >
            <span className="text-terminal-amber">[</span>
            <span className={questionMode === "general" ? "text-primary crt-text-glow" : "opacity-0"}>X</span>
            <span className="text-terminal-amber">]</span>
            <span className="ml-1">자유 대화</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b px-4 py-2 shrink-0",
        "bg-background/50",
      )}
    >
      <span
        className={cn(
          "text-xs text-muted-foreground truncate max-w-[50%]",
        )}
      >
        {questionMode === "article" ? "이 글 관련" : "자유 대화"}
      </span>
      <div
        className={cn(
          "inline-flex rounded-full border bg-muted/40 p-0.5 shadow-sm",
          "focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-offset-2 focus-within:ring-offset-background/30",
        )}
      >
        <Button
          size="sm"
          type="button"
          aria-label="모드 선택: 이 글 관련"
          aria-pressed={questionMode === "article"}
          variant={questionMode === "article" ? "secondary" : "ghost"}
          className={cn(
            "h-7 px-3 text-xs rounded-full transition-colors",
            isMobile && "h-8 px-4",
            questionMode === "article" &&
              "bg-background/80 text-foreground shadow border border-border/60",
            questionMode !== "article" &&
              "bg-transparent text-muted-foreground hover:text-foreground hover:bg-background/30 border border-transparent",
          )}
          onClick={() => onModeChange("article")}
        >
          이 글 관련
        </Button>
        <Button
          size="sm"
          type="button"
          aria-label="모드 선택: 자유 대화"
          aria-pressed={questionMode === "general"}
          variant={questionMode === "general" ? "secondary" : "ghost"}
          className={cn(
            "h-7 px-3 text-xs rounded-full transition-colors",
            isMobile && "h-8 px-4",
            questionMode === "general" &&
              "bg-background/80 text-foreground shadow border border-border/60",
            questionMode !== "general" &&
              "bg-transparent text-muted-foreground hover:text-foreground hover:bg-background/30 border border-transparent",
          )}
          onClick={() => onModeChange("general")}
        >
          자유 대화
        </Button>
      </div>
    </div>
  );
}
