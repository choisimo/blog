import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Send,
  Loader2,
  MessageSquare,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Lightbulb,
  Users,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { streamChatEvents, ensureSession } from '@/services/chat';
import { PrismResult } from '@/services/ai';
import ChatMarkdown from '@/components/features/chat/ChatMarkdown';

export type DebateMessage = {
  id: string;
  role: 'user' | 'ai' | 'system';
  content: string;
  stance?: 'agree' | 'disagree' | 'neutral';
  timestamp: number;
};

export type DebateTopic = {
  title: string;
  context: string;
  facets?: PrismResult['facets'];
  originalParagraph?: string;
};

type DebateRoomProps = {
  topic: DebateTopic;
  onClose: () => void;
  postTitle?: string;
};

const DEBATE_STARTERS = [
  { label: '이 부분이 특히 신경 쓰여요', stance: 'agree' as const, icon: ThumbsUp },
  { label: '이 부분이 조금 불편해요', stance: 'disagree' as const, icon: ThumbsDown },
  { label: '조금 더 이해하고 정리하고 싶어요', stance: 'neutral' as const, icon: Lightbulb },
];

const FOLLOW_UP_PROMPTS = [
  '내 상황에 맞게 풀어서 설명해줘',
  '다른 관점에서 보면 어떻게 느낄 수 있을까?',
  '앞으로 내가 어떤 선택을 할 수 있을지 같이 정리해줘',
  '지금 내가 놓치고 있는 포인트가 있다면 알려줘',
];

function buildDebateSystemPrompt(topic: DebateTopic, stance?: 'agree' | 'disagree' | 'neutral'): string {
  const lines: string[] = [
    '당신은 사려 깊은 상담 파트너입니다. 다음 지침을 따르세요:',
    '',
    '1. 사용자의 감정과 생각을 먼저 공감하고, 차분하게 응답합니다.',
    '2. 옳고 그름을 판단하기보다, 사용자가 스스로 정리하고 선택할 수 있도록 도와줍니다.',
    '3. 조언이 필요할 때에는 예의 바르게, 구체적인 예시와 함께 제안합니다.',
    '4. 사용자가 새로운 관점이나 선택지를 발견하도록 부드럽게 질문을 던집니다.',
    '5. 말투는 친근하고 따뜻하게 유지하되, 과도하게 가볍지 않게 균형을 잡습니다.',
    '6. 응답은 2~4문장 정도로 간결하게, 지금 대화에서 가장 중요한 한두 가지에 집중합니다.',
    '',
    '---',
    '',
    '[상담 주제]',
    topic.title,
    '',
    '[맥락]',
    topic.context,
  ];

  if (topic.facets && topic.facets.length > 0) {
    lines.push('', '[참고할 수 있는 관점들]');
    topic.facets.forEach((f, i) => {
      lines.push(`${i + 1}. ${f.title}`);
      f.points.forEach(p => lines.push(`   - ${p}`));
    });
  }

  if (stance === 'agree') {
    lines.push('', '사용자는 이 내용에 어느 정도 공감하고 있습니다. 그 공감을 바탕으로 조금 더 깊이 이해하고 정리할 수 있도록 도와주세요.');
  } else if (stance === 'disagree') {
    lines.push('', '사용자는 이 내용에 대해 불편함 또는 다른 시각을 가지고 있습니다. 그 감정을 존중하면서 안전한 분위기에서 생각을 풀어낼 수 있도록 도와주세요.');
  }

  return lines.join('\n');
}

export default function DebateRoom({ topic, onClose, postTitle }: DebateRoomProps) {
  const { isTerminal } = useTheme();
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [currentStance, setCurrentStance] = useState<'agree' | 'disagree' | 'neutral' | null>(null);
  const [showStarters, setShowStarters] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canSend = input.trim().length > 0 && !busy;

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const addMessage = useCallback((msg: DebateMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const startDebate = useCallback(async (stance: 'agree' | 'disagree' | 'neutral') => {
    setCurrentStance(stance);
    setShowStarters(false);
    setBusy(true);

    const userMsg: DebateMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: DEBATE_STARTERS.find(s => s.stance === stance)?.label || '',
      stance,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const aiId = `ai_${Date.now()}`;
    addMessage({
      id: aiId,
      role: 'ai',
      content: '',
      timestamp: Date.now(),
    });

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const systemPrompt = buildDebateSystemPrompt(topic, stance);
      const starterText = stance === 'agree'
        ? '이 부분이 특히 신경 쓰여요. 조금 더 이해하고 정리하고 싶어요.'
        : stance === 'disagree'
        ? '이 부분이 조금 불편해요. 다른 관점에서 생각해볼 수 있을까요?'
        : '조금 더 이해하고 정리하고 싶어요. 핵심 논점이 무엇인가요?';

      let acc = '';
      for await (const ev of streamChatEvents({
        text: `${systemPrompt}\n\n---\n\n사용자: ${starterText}`,
        signal: controller.signal,
        useArticleContext: false,
      })) {
        if (ev.type === 'text') {
          acc += ev.text;
          setMessages(prev =>
            prev.map(m => (m.id === aiId ? { ...m, content: acc } : m))
          );
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === aiId
              ? { ...m, content: '죄송해요, 응답을 생성하지 못했어요. 다시 시도해주세요.' }
              : m
          )
        );
      }
    } finally {
      setBusy(false);
    }
  }, [topic, addMessage]);

  const sendMessage = useCallback(async () => {
    if (!canSend) return;

    const text = input.trim();
    setInput('');

    const userMsg: DebateMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    const aiId = `ai_${Date.now()}`;
    addMessage({
      id: aiId,
      role: 'ai',
      content: '',
      timestamp: Date.now(),
    });

    setBusy(true);

    try {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Build conversation history
      const history = messages
        .filter(m => m.role !== 'system')
        .map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
        .join('\n\n');

      const systemPrompt = buildDebateSystemPrompt(topic, currentStance || undefined);
      const fullPrompt = [
        systemPrompt,
        '',
        '---',
        '',
        '[대화 기록]',
        history,
        '',
        `사용자: ${text}`,
      ].join('\n');

      let acc = '';
      for await (const ev of streamChatEvents({
        text: fullPrompt,
        signal: controller.signal,
        useArticleContext: false,
      })) {
        if (ev.type === 'text') {
          acc += ev.text;
          setMessages(prev =>
            prev.map(m => (m.id === aiId ? { ...m, content: acc } : m))
          );
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === aiId
              ? { ...m, content: '죄송해요, 응답을 생성하지 못했어요.' }
              : m
          )
        );
      }
    } finally {
      setBusy(false);
    }
  }, [canSend, input, messages, topic, currentStance, addMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (canSend) sendMessage();
      }
    },
    [canSend, sendMessage]
  );

  const resetDebate = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setCurrentStance(null);
    setShowStarters(true);
    setInput('');
    setBusy(false);
  }, []);

  const useFollowUp = useCallback((prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col h-full max-h-[600px] overflow-hidden rounded-2xl border shadow-lg',
        isTerminal
          ? 'bg-[hsl(var(--terminal-code-bg))] border-primary/20'
          : 'bg-card border-border'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3 border-b shrink-0',
          isTerminal
            ? 'border-primary/10 bg-primary/5'
            : 'border-border/40 bg-muted/30'
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-full shrink-0',
              isTerminal ? 'bg-primary/20' : 'bg-primary/10'
            )}
          >
            <Users className={cn('h-4 w-4', isTerminal ? 'text-primary' : 'text-primary')} />
          </div>
          <div className="min-w-0">
            <h3
              className={cn(
                'font-semibold text-sm truncate',
                isTerminal && 'font-mono text-primary'
              )}
            >
              AI 상담실
            </h3>
            <p className="text-xs text-muted-foreground truncate max-w-[200px]">
              {topic.title}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={resetDebate}
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-full transition-colors',
                isTerminal
                  ? 'hover:bg-primary/10 text-primary/60 hover:text-primary'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
              aria-label="상담 초기화"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-full transition-colors',
              isTerminal
                ? 'hover:bg-primary/10 text-primary/60 hover:text-primary'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            )}
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Initial Topic Display */}
        {showStarters && (
          <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
            {/* Topic Card */}
            <div
              className={cn(
                'rounded-xl px-4 py-4 border',
                isTerminal
                  ? 'bg-primary/5 border-primary/20'
                  : 'bg-muted/30 border-border/60'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'flex items-center justify-center h-8 w-8 rounded-lg shrink-0 mt-0.5',
                    isTerminal ? 'bg-primary/20' : 'bg-primary/10'
                  )}
                >
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm mb-2">{topic.title}</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {topic.context.length > 200
                      ? `${topic.context.slice(0, 200)}...`
                      : topic.context}
                  </p>
                </div>
              </div>
            </div>

            {/* Facets Preview */}
            {topic.facets && topic.facets.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground px-1">관련 관점들:</p>
                <div className="flex flex-wrap gap-2">
                  {topic.facets.slice(0, 3).map((f, i) => (
                    <span
                      key={i}
                      className={cn(
                        'inline-flex items-center px-3 py-1.5 rounded-full text-xs',
                        isTerminal
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'bg-secondary text-secondary-foreground'
                      )}
                    >
                      {f.title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Stance Selection */}
            <div className="space-y-3 pt-2">
              <p className="text-sm text-center text-muted-foreground">
                어떤 마음으로 상담을 시작할까요?
              </p>
              <div className="grid grid-cols-1 gap-2">
                {DEBATE_STARTERS.map(starter => {
                  const Icon = starter.icon;
                  return (
                    <button
                      key={starter.stance}
                      type="button"
                      onClick={() => startDebate(starter.stance)}
                      disabled={busy}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
                        'hover:scale-[1.01] active:scale-[0.99]',
                        isTerminal
                          ? 'border-primary/20 hover:border-primary/40 hover:bg-primary/5'
                          : 'border-border hover:border-primary/30 hover:bg-muted/50',
                        busy && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <div
                        className={cn(
                          'flex items-center justify-center h-8 w-8 rounded-lg',
                          starter.stance === 'agree' && 'bg-emerald-500/10 text-emerald-500',
                          starter.stance === 'disagree' && 'bg-orange-500/10 text-orange-500',
                          starter.stance === 'neutral' && 'bg-blue-500/10 text-blue-500'
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-sm font-medium">{starter.label}</span>
                      <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Conversation Messages */}
        {messages.map(msg => (
          <div
            key={msg.id}
            className={cn(
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3',
                msg.role === 'user' && 'bg-primary text-primary-foreground rounded-br-md',
                msg.role === 'ai' &&
                  (isTerminal
                    ? 'bg-primary/5 border border-primary/20 rounded-bl-md'
                    : 'bg-secondary text-secondary-foreground rounded-bl-md'),
                msg.role === 'system' && 'bg-muted text-muted-foreground'
              )}
            >
              {msg.role === 'ai' && msg.content ? (
                <ChatMarkdown content={msg.content} />
              ) : msg.role === 'ai' && !msg.content ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>생각하는 중...</span>
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              )}

              {/* Stance badge for user messages */}
              {msg.role === 'user' && msg.stance && (
                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-primary-foreground/20">
                  {msg.stance === 'agree' && <ThumbsUp className="h-3 w-3" />}
                  {msg.stance === 'disagree' && <ThumbsDown className="h-3 w-3" />}
                  {msg.stance === 'neutral' && <Lightbulb className="h-3 w-3" />}
                  <span className="text-xs opacity-80">
                    {msg.stance === 'agree' && '동의'}
                    {msg.stance === 'disagree' && '반대'}
                    {msg.stance === 'neutral' && '탐구'}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Quick Follow-ups after AI response */}
        {!busy && messages.length > 0 && messages[messages.length - 1]?.role === 'ai' && (
          <div className="flex flex-wrap gap-2 pt-2">
            {FOLLOW_UP_PROMPTS.slice(0, 3).map((prompt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => useFollowUp(prompt)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-full transition-colors',
                  isTerminal
                    ? 'bg-primary/10 text-primary/80 hover:bg-primary/20 hover:text-primary border border-primary/20'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground'
                )}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Input Area */}
      {!showStarters && (
        <div
          className={cn(
            'border-t px-4 py-3 shrink-0',
            isTerminal ? 'border-primary/10 bg-primary/5' : 'border-border/40 bg-muted/20'
          )}
        >
          <div
            className={cn(
              'flex items-end gap-2 rounded-xl border px-3 py-2',
              isTerminal ? 'border-primary/20 bg-background/50' : 'border-border bg-background'
            )}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="생각을 나눠보세요..."
              rows={1}
              className={cn(
                'flex-1 resize-none border-0 bg-transparent py-2 text-sm focus:outline-none focus:ring-0',
                'placeholder:text-muted-foreground/50',
                isTerminal && 'font-mono'
              )}
              style={{ maxHeight: '120px' }}
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!canSend}
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg transition-colors shrink-0',
                canSend
                  ? isTerminal
                    ? 'bg-primary/20 text-primary hover:bg-primary/30'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              )}
              aria-label="보내기"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
