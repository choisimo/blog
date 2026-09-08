import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import DebateRoom, {
  type DebateTopic,
} from '@/components/features/debate/DebateRoom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const PLAIN_CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;
const MESSAGE_CONTROL_TEXT_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const MAX_TOPIC_TITLE_LENGTH = 160;
const MAX_TOPIC_CONTEXT_LENGTH = 4000;
const MAX_ENTRY_INTENT_ID_LENGTH = 80;

function sanitizePlainText(value: unknown, maxLength: number): string {
  return String(value ?? "")
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(PLAIN_CONTROL_TEXT_PATTERN, "")
    .trim()
    .slice(0, maxLength);
}

function sanitizeContextText(value: unknown): string {
  return String(value ?? "")
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(MESSAGE_CONTROL_TEXT_PATTERN, "")
    .trim()
    .slice(0, MAX_TOPIC_CONTEXT_LENGTH);
}

function buildDebateTopic(input: {
  title: unknown;
  context: unknown;
  entryMode?: DebateTopic["entryMode"];
  entryIntentId?: unknown;
}): DebateTopic | null {
  const title = sanitizePlainText(input.title, MAX_TOPIC_TITLE_LENGTH);
  const context = sanitizeContextText(input.context);

  if (!title && !context) return null;

  const entryIntentId = sanitizePlainText(
    input.entryIntentId,
    MAX_ENTRY_INTENT_ID_LENGTH,
  );

  return {
    title: title || context.slice(0, 80) || "대화 주제",
    context: context || title,
    entryMode:
      input.entryMode === "prism" || input.entryMode === "chain"
        ? input.entryMode
        : "default",
    entryIntentId: entryIntentId || undefined,
  };
}

function buildTopicFromSearchParams(
  searchParams: URLSearchParams,
): DebateTopic | null {
  const entryMode = searchParams.get("mode");
  return buildDebateTopic({
    title: searchParams.get("topic"),
    context: searchParams.get("context") || searchParams.get("excerpt"),
    entryMode:
      entryMode === "prism" || entryMode === "chain" ? entryMode : "default",
    entryIntentId: searchParams.get("intent"),
  });
}

export default function Debate() {
  const [searchParams] = useSearchParams();
  const initialTopic = useMemo(
    () => buildTopicFromSearchParams(searchParams),
    [searchParams],
  );
  const [title, setTitle] = useState(initialTopic?.title || '');
  const [context, setContext] = useState(initialTopic?.context || '');
  const [activeTopic, setActiveTopic] = useState<DebateTopic | null>(
    initialTopic
  );

  const draftTopic = buildDebateTopic({ title, context });
  const canStart = draftTopic !== null;

  return (
    <div
      className='ui-page ui-debate-page ui-page-container fn-debate fn-shell fn-page-space'
      data-ui-page='debate'
    >
      <header className='ui-page-heading ui-debate-heading'>
        <div>
          <Link to='/' className='ui-back-link'>
            <ArrowLeft className='h-4 w-4' />
            홈으로
          </Link>
          <p className='fn-eyebrow'>INDEPENDENT DEBATE</p>
          <h1>질문에 머무는 시간.</h1>
          <p>주제와 맥락을 바탕으로 생각을 이어갑니다.</p>
        </div>
        {activeTopic && (
          <Button
            className='ui-control'
            data-ui-variant='outline'
            variant='outline'
            onClick={() => setActiveTopic(null)}
          >
            주제 다시 입력
          </Button>
        )}
      </header>
      {!activeTopic ? (
        <section className='ui-debate-entry' aria-label='상담 주제 설정'>
          <div className='ui-form-stack'>
            <div className='ui-field-group'>
              <label htmlFor='debate-topic'>주제</label>
              <Input
                className='ui-input'
                id='debate-topic'
                value={title}
                maxLength={MAX_TOPIC_TITLE_LENGTH}
                onChange={event => setTitle(event.target.value)}
                placeholder='다른 관점으로 살펴보고 싶은 주제'
              />
            </div>
            <div className='ui-field-group'>
              <label htmlFor='debate-context'>맥락</label>
              <Textarea
                id='debate-context'
                value={context}
                maxLength={MAX_TOPIC_CONTEXT_LENGTH}
                onChange={event => setContext(event.target.value)}
                aria-describedby='debate-context-help'
                className='ui-textarea ui-debate-context'
                placeholder='참고할 배경이나 읽고 있던 문단을 입력하세요.'
              />
              <div className='ui-field-help' id='debate-context-help'>
                <span>주제 또는 맥락 중 하나를 입력하면 열 수 있습니다.</span>
                <span className='ui-field-count'>
                  {context.length.toLocaleString()} /{' '}
                  {MAX_TOPIC_CONTEXT_LENGTH.toLocaleString()}
                </span>
              </div>
            </div>
            <div className='ui-form-actions'>
              <Button
                className='ui-control'
                data-ui-variant='default'
                disabled={!canStart}
                onClick={() => {
                  const nextTopic = buildDebateTopic({ title, context });
                  if (nextTopic) setActiveTopic(nextTopic);
                }}
              >
                상담실 열기
              </Button>
            </div>
          </div>
          <aside className='ui-context-note'>
            <h2>
              답보다 먼저,
              <br />
              좋은 질문을.
            </h2>
            <p>
              주제와 관련된 배경을 입력하면 상담실에서 같은 맥락을 이어갈 수
              있습니다.
            </p>
            <p>
              고민하는 선택지나 궁금한 점을 구체적으로 남기면 다양한 관점으로
              살펴볼 수 있습니다.
            </p>
            <details>
              <summary>어떤 내용을 적으면 좋을까요?</summary>
              <p>
                예: “개인 프로젝트에 어떤 데이터베이스를 쓸지 고민 중입니다.
                예상 사용자 수와 관리에 쓸 수 있는 시간을 함께 고려하고 싶어요.”
              </p>
            </details>
          </aside>
        </section>
      ) : (
        <section className='ui-debate-room' aria-label='상담 작업공간'>
          <DebateRoom
            topic={activeTopic}
            onClose={() => setActiveTopic(null)}
          />
        </section>
      )}
    </div>
  );
}
