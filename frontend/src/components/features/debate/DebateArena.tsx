import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  SkipForward,
  ThumbsUp,
  ThumbsDown,
  Trophy,
  Loader2,
  Swords,
  Shield,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { getApiBaseUrl } from '@/utils/apiBase';
import { getChatBaseUrl } from '@/services/chat/config';
import ChatMarkdown from '@/components/features/chat/ChatMarkdown';

type Agent = {
  name: string;
  role: 'attacker' | 'defender' | 'moderator';
  color: string;
};

type DebateMessage = {
  role: string;
  name: string;
  content: string;
  color: string;
};

type DebateSession = {
  sessionId: string;
  topicId: string;
  topic: {
    title: string;
    description?: string;
  };
  agents: Agent[];
};

type DebateArenaProps = {
  initialTopic?: string;
  initialDescription?: string;
  onClose: () => void;
};

const AGENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  attacker: Swords,
  defender: Shield,
  moderator: Scale,
};

type ApiEnvelope<T> = {
  ok?: boolean;
  data?: T;
  error?: { message?: string } | string;
  message?: string;
};

function normalizeBaseUrl(base: string): string {
  return base.replace(/\/$/, '');
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  if (typeof obj.message === 'string') return obj.message;
  if (typeof obj.error === 'string') return obj.error;
  if (obj.error && typeof obj.error === 'object') {
    const err = obj.error as Record<string, unknown>;
    if (typeof err.message === 'string') return err.message;
  }
  return null;
}

function getDebateBaseCandidates(): string[] {
  const candidates = new Set<string>();

  try {
    candidates.add(normalizeBaseUrl(getApiBaseUrl()));
  } catch {
    // ignore
  }

  try {
    candidates.add(normalizeBaseUrl(getChatBaseUrl()));
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    candidates.add(normalizeBaseUrl(window.location.origin));
  }

  const hasNodoveDomain = Array.from(candidates).some((base) => /nodove\.com/i.test(base));
  if (hasNodoveDomain) {
    candidates.add('https://api.nodove.com');
  }

  return Array.from(candidates);
}

async function requestDebate<T>(path: string, init: RequestInit): Promise<T> {
  const bases = getDebateBaseCandidates();
  if (bases.length === 0) {
    throw new Error('토론 API 기본 URL을 찾을 수 없습니다.');
  }

  let lastError = '토론 API 요청에 실패했습니다.';

  for (const base of bases) {
    const url = `${base}/api/v1/debate${path}`;

    try {
      const response = await fetch(url, init);
      const text = await response.text().catch(() => '');

      let parsed: ApiEnvelope<T> | null = null;
      if (text) {
        try {
          parsed = JSON.parse(text) as ApiEnvelope<T>;
        } catch {
          parsed = null;
        }
      }

      if (response.ok && parsed?.ok && parsed.data !== undefined) {
        return parsed.data;
      }

      const message =
        extractErrorMessage(parsed) ||
        (text && !text.startsWith('<') ? text.slice(0, 160) : '') ||
        `서버 오류: ${response.status}`;

      const isNotFoundLike =
        response.status === 404 ||
        response.status === 405 ||
        /not\s*found/i.test(message);

      lastError = message;
      if (isNotFoundLike) {
        continue;
      }

      throw new Error(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : '토론 API 호출 실패';
      lastError = message;
    }
  }

  throw new Error(lastError);
}

export default function DebateArena({
  initialTopic = '',
  initialDescription = '',
  onClose,
}: DebateArenaProps) {
  const { isTerminal } = useTheme();
  const [topic, setTopic] = useState(initialTopic);
  const [description, setDescription] = useState(initialDescription);
  const [session, setSession] = useState<DebateSession | null>(null);
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [votes, setVotes] = useState<Record<number, { attacker: number; defender: number }>>({});
  const [userVote, setUserVote] = useState<Record<number, 'attacker' | 'defender'>>({});
  const [winner, setWinner] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      if (autoPlayRef.current) {
        clearTimeout(autoPlayRef.current);
      }
    };
  }, []);

  const startDebate = useCallback(async () => {
    if (!topic.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await requestDebate<DebateSession>('/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicTitle: topic.trim(),
          topicDescription: description.trim() || undefined,
        }),
      });
      setSession(data);
      setMessages([]);
      setCurrentRound(0);
      setVotes({});
      setUserVote({});
      setWinner(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : '토론 세션 생성에 실패했습니다.';
      console.error('Failed to start debate:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [topic, description]);

  const nextRound = useCallback(async () => {
    if (!session || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await requestDebate<{ roundNumber: number; messages: DebateMessage[] }>(
        `/sessions/${session.sessionId}/round`,
        {
        method: 'POST',
        }
      );

      const { roundNumber, messages: newMessages } = data;
      setCurrentRound(roundNumber);
      setMessages((prev) => [...prev, ...newMessages]);
    } catch (err) {
      const message = err instanceof Error ? err.message : '라운드 생성에 실패했습니다.';
      console.error('Failed to generate round:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [session, isLoading]);

  const vote = useCallback(
    async (votedFor: 'attacker' | 'defender') => {
      if (!session || currentRound === 0) return;

      try {
        const data = await requestDebate<{ votes: { attacker: number; defender: number } }>(
          `/sessions/${session.sessionId}/vote`,
          {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roundNumber: currentRound,
            votedFor,
          }),
          }
        );

        setVotes((prev) => ({
          ...prev,
          [currentRound]: data.votes,
        }));
        setUserVote((prev) => ({
          ...prev,
          [currentRound]: votedFor,
        }));
      } catch (err) {
        console.error('Failed to vote:', err);
      }
    },
    [session, currentRound]
  );

  const endDebate = useCallback(async () => {
    if (!session) return;

    setIsAutoPlaying(false);
    if (autoPlayRef.current) {
      clearTimeout(autoPlayRef.current);
    }

    try {
      const data = await requestDebate<{ winner: string | null }>(
        `/sessions/${session.sessionId}/end`,
        {
        method: 'POST',
        }
      );

      setWinner(data.winner);
    } catch (err) {
      console.error('Failed to end debate:', err);
    }
  }, [session]);

  const toggleAutoPlay = useCallback(() => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      if (autoPlayRef.current) {
        clearTimeout(autoPlayRef.current);
      }
    } else {
      setIsAutoPlaying(true);
    }
  }, [isAutoPlaying]);

  useEffect(() => {
    if (isAutoPlaying && session && !isLoading && currentRound < 5) {
      autoPlayRef.current = setTimeout(() => {
        nextRound();
      }, 2000);
    } else if (isAutoPlaying && currentRound >= 5) {
      setIsAutoPlaying(false);
      endDebate();
    }
  }, [isAutoPlaying, session, isLoading, currentRound, nextRound, endDebate]);

  const renderAgentMessage = (msg: DebateMessage, index: number) => {
    const Icon = AGENT_ICONS[msg.role] || Scale;

    return (
      <div
        key={index}
        className={cn(
          'flex gap-3 p-4 rounded-xl border animate-in fade-in-0 slide-in-from-bottom-2',
          isTerminal ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border/40'
        )}
      >
        <div
          className="flex items-center justify-center h-10 w-10 rounded-full shrink-0"
          style={{ backgroundColor: `${msg.color}20` }}
        >
          <Icon className="h-5 w-5" style={{ color: msg.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm" style={{ color: msg.color }}>
              {msg.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {msg.role === 'attacker' ? '반론' : msg.role === 'defender' ? '옹호' : '정리'}
            </span>
          </div>
          <div className="text-sm">
            <ChatMarkdown content={msg.content} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={cn(
        'flex flex-col h-full max-h-[85vh] overflow-hidden rounded-2xl border shadow-xl',
        isTerminal
          ? 'bg-[hsl(var(--terminal-code-bg))] border-primary/30 font-mono'
          : 'bg-card border-border'
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between px-4 py-3.5 border-b shrink-0',
          isTerminal ? 'border-primary/20 bg-[hsl(var(--terminal-titlebar))]' : 'border-border/40'
        )}
      >
        {isTerminal && (
          <div className="flex items-center gap-1.5 mr-3">
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
            <div className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
          </div>
        )}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-full shrink-0',
              isTerminal ? 'bg-primary/20 border border-primary/30' : 'bg-primary/10'
            )}
          >
            <Swords className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className={cn('font-semibold text-base', isTerminal && 'text-primary')}>
              AI 토론 아레나
            </h3>
            <p className="text-xs text-muted-foreground">
              {session ? `라운드 ${currentRound}/5` : '새 토론 시작'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'flex items-center justify-center h-9 w-9 rounded-full transition-colors',
            isTerminal
              ? 'hover:bg-primary/20 text-primary/70 hover:text-primary'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          )}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4">
        {error && (
          <div
            className={cn(
              'rounded-xl border px-4 py-3 text-sm',
              isTerminal
                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                : 'border-red-200 bg-red-50 text-red-700'
            )}
          >
            {error}
          </div>
        )}

        {!session && (
          <div className="space-y-4 animate-in fade-in-0">
            <div className="space-y-3">
              <label className="text-sm font-medium">토론 주제</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: AI가 인간의 일자리를 대체할 것인가?"
                className={cn(
                  'w-full px-4 py-3 rounded-xl border text-sm',
                  isTerminal
                    ? 'bg-primary/5 border-primary/30 focus:border-primary'
                    : 'bg-background border-border focus:border-primary'
                )}
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium">추가 설명 (선택)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="토론에 대한 배경이나 맥락을 설명해주세요..."
                rows={3}
                className={cn(
                  'w-full px-4 py-3 rounded-xl border text-sm resize-none',
                  isTerminal
                    ? 'bg-primary/5 border-primary/30 focus:border-primary'
                    : 'bg-background border-border focus:border-primary'
                )}
              />
            </div>
            <button
              type="button"
              onClick={startDebate}
              disabled={!topic.trim() || isLoading}
              className={cn(
                'w-full py-3 rounded-xl font-medium text-sm transition-colors',
                isTerminal
                  ? 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
                (!topic.trim() || isLoading) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  준비 중...
                </span>
              ) : (
                '토론 시작'
              )}
            </button>
          </div>
        )}

        {session && messages.length === 0 && !winner && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">토론이 준비되었습니다.</p>
            <p className="text-xs mt-1">아래 버튼을 눌러 라운드를 시작하세요.</p>
          </div>
        )}

        {messages.map((msg, i) => renderAgentMessage(msg, i))}

        {winner && (
          <div
            className={cn(
              'p-6 rounded-xl border text-center animate-in fade-in-0',
              isTerminal ? 'bg-primary/10 border-primary/30' : 'bg-primary/5 border-primary/20'
            )}
          >
            <Trophy className="h-12 w-12 mx-auto mb-3 text-yellow-500" />
            <h4 className="text-lg font-semibold mb-1">토론 종료!</h4>
            <p className="text-sm text-muted-foreground">
              {winner ? `승자: ${winner}` : '무승부'}
            </p>
          </div>
        )}
      </div>

      {session && !winner && (
        <div
          className={cn(
            'border-t px-4 py-4 space-y-3 shrink-0',
            isTerminal ? 'border-primary/20 bg-primary/5' : 'border-border/40 bg-muted/20'
          )}
        >
          {currentRound > 0 && !userVote[currentRound] && (
            <div className="flex items-center justify-center gap-3">
              <span className="text-xs text-muted-foreground">이번 라운드 승자는?</span>
              <button
                type="button"
                onClick={() => vote('defender')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
                  'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                )}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
                옹호자
              </button>
              <button
                type="button"
                onClick={() => vote('attacker')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors',
                  'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                )}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                도전자
              </button>
            </div>
          )}

          {currentRound > 0 && userVote[currentRound] && votes[currentRound] && (
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span>
                옹호자: <span className="text-green-500">{votes[currentRound].defender}</span>표
              </span>
              <span>
                도전자: <span className="text-red-500">{votes[currentRound].attacker}</span>표
              </span>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={toggleAutoPlay}
              disabled={isLoading || currentRound >= 5}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors',
                isTerminal
                  ? 'border border-primary/30 hover:bg-primary/10'
                  : 'border border-border hover:bg-muted',
                (isLoading || currentRound >= 5) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isAutoPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  일시정지
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  자동 진행
                </>
              )}
            </button>

            <button
              type="button"
              onClick={nextRound}
              disabled={isLoading || isAutoPlaying || currentRound >= 5}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors',
                isTerminal
                  ? 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/40'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
                (isLoading || isAutoPlaying || currentRound >= 5) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SkipForward className="h-4 w-4" />
              )}
              다음 라운드
            </button>

            {currentRound >= 3 && (
              <button
                type="button"
                onClick={endDebate}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors',
                  'bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30 border border-yellow-500/40'
                )}
              >
                <Trophy className="h-4 w-4" />
                종료
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
