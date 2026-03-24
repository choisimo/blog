import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  MessageSquareHeart,
  Orbit,
  Sparkles,
} from "lucide-react";
import DebateRoom, {
  type DebateTopic,
} from "@/components/features/debate/DebateRoom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function buildTopicFromSearchParams(
  searchParams: URLSearchParams,
): DebateTopic | null {
  const title = searchParams.get("topic")?.trim() || "";
  const context =
    searchParams.get("context")?.trim() ||
    searchParams.get("excerpt")?.trim() ||
    "";

  if (!title && !context) return null;

  const entryMode = searchParams.get("mode");
  const entryIntentId = searchParams.get("intent")?.trim() || undefined;

  return {
    title: title || context.slice(0, 80) || "대화 주제",
    context: context || title,
    entryMode:
      entryMode === "prism" || entryMode === "chain" ? entryMode : "default",
    entryIntentId,
  };
}

export default function Debate() {
  const [searchParams] = useSearchParams();
  const initialTopic = useMemo(
    () => buildTopicFromSearchParams(searchParams),
    [searchParams],
  );
  const [title, setTitle] = useState(initialTopic?.title || "");
  const [context, setContext] = useState(initialTopic?.context || "");
  const [activeTopic, setActiveTopic] = useState<DebateTopic | null>(
    initialTopic,
  );

  const canStart = title.trim().length > 0 || context.trim().length > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            홈으로 돌아가기
          </Link>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <Orbit className="h-3.5 w-3.5" />
              Independent Debate
            </span>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              인라인 흐름과 분리된 AI 상담실
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
              prism/chain 인라인 feed와는 별개의 독립 기능입니다. 주제와 맥락을
              직접 넣고, 필요한 경우 query parameter로 intent/mode를 지정해 바로
              진입할 수 있습니다.
            </p>
          </div>
        </div>

        {activeTopic && (
          <Button
            variant="outline"
            onClick={() => setActiveTopic(null)}
            className="shrink-0"
          >
            주제 다시 입력
          </Button>
        )}
      </div>

      {!activeTopic && (
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[2rem] border border-border/70 bg-card px-5 py-5 shadow-sm">
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  대화 주제를 직접 설정합니다
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  블로그 문단과 무관하게 독립된 topic/context를 넣어서 상담실을
                  열 수 있습니다.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="debate-topic" className="text-sm font-medium">
                  주제
                </label>
                <Input
                  id="debate-topic"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="예: 지금 이 선택을 어떻게 해석해야 할까?"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="debate-context" className="text-sm font-medium">
                  맥락
                </label>
                <Textarea
                  id="debate-context"
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder="상담실이 참고할 배경, 문단, 고민의 맥락을 입력하세요."
                  className="min-h-[220px]"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  disabled={!canStart}
                  onClick={() =>
                    setActiveTopic({
                      title: title.trim() || context.trim().slice(0, 80),
                      context: context.trim() || title.trim(),
                      entryMode: "default",
                    })
                  }
                >
                  상담실 열기
                </Button>
                <p className="text-xs text-muted-foreground">
                  `/debate?topic=...&context=...` 로도 바로 진입할 수 있습니다.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.98))] px-5 py-5 shadow-sm">
            <div className="space-y-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MessageSquareHeart className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">
                  무엇이 달라졌나
                </h2>
                <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
                  <li>prism/chain 인라인 feed는 더 이상 상담실을 기본 후속 동선으로 사용하지 않습니다.</li>
                  <li>상담실은 별도 route에서만 열리며, follow-up 생성 로직은 그대로 유지됩니다.</li>
                  <li>필요하면 query parameter로 특정 mode/intent를 강제해 기존 흐름을 재현할 수 있습니다.</li>
                </ul>
              </div>
              <div className="rounded-[1.5rem] border border-border/60 bg-background/80 px-4 py-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Example
                </div>
                <p className="mt-2 break-all text-xs leading-6">
                  `/debate?topic=다른%20관점으로%20보고%20싶다&context=이%20문단을%20읽고%20혼란스러웠다&mode=prism&intent=prism-compare`
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTopic && (
        <section className="rounded-[2rem] border border-border/60 bg-card/90 p-3 shadow-sm sm:p-5">
          <DebateRoom
            topic={activeTopic}
            onClose={() => setActiveTopic(null)}
          />
        </section>
      )}
    </div>
  );
}
