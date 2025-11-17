import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Sparkles, Send, Loader2, Square, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  streamChatEvents,
  ensureSession,
  uploadChatImage,
  invokeChatAggregate,
} from '@/services/chat';
import ChatMarkdown from './ChatMarkdown';

export type SourceLink = {
  title?: string;
  url?: string;
  score?: number;
  snippet?: string;
};
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  sources?: SourceLink[];
  followups?: string[];
};

type ChatSessionMeta = {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  mode: 'article' | 'general';
  articleUrl?: string;
  articleTitle?: string;
};

const CHAT_SESSIONS_INDEX_KEY = 'ai_chat_sessions_index';
const CHAT_SESSION_STORAGE_PREFIX = 'ai_chat_history_v2_';

export default function ChatWidget(props: { onClose?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [persistOptIn, setPersistOptIn] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [sessionKey, setSessionKey] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const existing =
        window.localStorage.getItem('ai_chat_current_session_key');
      if (existing && existing.trim()) return existing;
    } catch {}
    const fresh = `sess_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    try {
      window.localStorage.setItem('ai_chat_current_session_key', fresh);
    } catch {}
    return fresh;
  });
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [showSessions, setShowSessions] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isAggregatePrompt, setIsAggregatePrompt] = useState(false);
  const [firstTokenMs, setFirstTokenMs] = useState<number | null>(null);
  const [questionMode, setQuestionMode] = useState<'article' | 'general'>(
    'article'
  );
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canSend =
    (input.trim().length > 0 || attachedImage !== null) && !busy;

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    sc.scrollTop = sc.scrollHeight + 1000;
  }, [messages, busy]);

  useEffect(() => {
    const v =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('ai_chat_persist_optin')
        : null;
    setPersistOptIn(v === '1');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(CHAT_SESSIONS_INDEX_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) setSessions(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    ensureSession()
      .then(id => setSessionId(id))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!persistOptIn || !sessionKey) return;
    try {
      const raw = localStorage.getItem(
        `${CHAT_SESSION_STORAGE_PREFIX}${sessionKey}`
      );
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed);
      } else {
        setMessages([]);
      }
    } catch {}
  }, [persistOptIn, sessionKey]);

  useEffect(() => {
    if (!persistOptIn || !sessionKey) return;
    try {
      localStorage.setItem(
        `${CHAT_SESSION_STORAGE_PREFIX}${sessionKey}`,
        JSON.stringify(messages)
      );
    } catch {}
  }, [messages, persistOptIn, sessionKey]);

  const push = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const loadSession = useCallback(
    (id: string) => {
      try {
        const raw = localStorage.getItem(
          `${CHAT_SESSION_STORAGE_PREFIX}${id}`
        );
        if (raw) {
          const parsed = JSON.parse(raw) as ChatMessage[];
          if (Array.isArray(parsed)) {
            setMessages(parsed);
          } else {
            setMessages([]);
          }
        } else {
          setMessages([]);
        }
        setFirstTokenMs(null);
        setAttachedImage(null);
        setSessionKey(id);
        try {
          localStorage.setItem('ai_chat_current_session_key', id);
        } catch {}
      } catch {
        setMessages([]);
      }
    },
    []
  );

  const toggleSessionSelected = useCallback((id: string) => {
    setSelectedSessionIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const aggregateFromSessionIds = useCallback(
    (ids: string[]) => {
      const uniqueIds = Array.from(new Set(ids));
      if (!uniqueIds.length) return;
      const lines: string[] = ['[참조 세션 요약]'];

      uniqueIds.forEach((id, idx) => {
        const s = sessions.find(x => x.id === id);
        if (!s) return;
        const title = s.title || s.articleTitle || `세션 ${idx + 1}`;
        const summaryText = s.summary || '(요약 없음)';
        lines.push(`${idx + 1}) ${title}`, summaryText, '');
      });

      lines.push(
        '---',
        '위 세션들을 모두 고려해서 다음 질문에 답해줘.',
        '',
        '(여기에 이어서 궁금한 점을 적어 주세요...)'
      );

      setInput(lines.join('\n'));
      setShowSessions(false);
      setSelectedSessionIds([]);
      setIsAggregatePrompt(true);
    },
    [sessions]
  );

  const send = useCallback(async () => {
    if (!canSend) return;
    const trimmed = input.trim();
    const imageToUpload = attachedImage;

    setBusy(true);
    setFirstTokenMs(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    let aiId: string | null = null;

    try {
      let uploaded:
        | {
            url: string;
            key: string;
            size: number;
            contentType: string;
          }
        | null = null;

      if (imageToUpload) {
        uploaded = await uploadChatImage(imageToUpload, controller.signal);
      }

      const baseText =
        trimmed || (imageToUpload ? '첨부한 이미지에 대해 설명해줘.' : '');

      const lines: string[] = [baseText];

      if (uploaded && imageToUpload) {
        const sizeKb = Math.max(1, Math.round(uploaded.size / 1024));
        lines.push(
          '',
          '[첨부 이미지]',
          `URL: ${uploaded.url}`,
          `파일명: ${imageToUpload.name}`,
          `크기: ${sizeKb}KB`
        );
      }

      const text = lines.join('\n');
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setInput('');
      setAttachedImage(null);
      push({ id, role: 'user', text });
      aiId = `${id}_ai`;

      if (isAggregatePrompt) {
        setIsAggregatePrompt(false);
        const aggregated = await invokeChatAggregate({
          prompt: text,
          signal: controller.signal,
        });
        push({ id: aiId, role: 'assistant', text: aggregated });
      } else {
        let acc = '';
        push({ id: aiId, role: 'assistant', text: '' });
        for await (const ev of streamChatEvents({
          text,
          signal: controller.signal,
          onFirstToken: ms => setFirstTokenMs(ms),
          useArticleContext: questionMode === 'article',
        })) {
          if (ev.type === 'text') {
            acc += ev.text;
            setMessages(prev =>
              prev.map(m => (m.id === aiId ? { ...m, text: acc } : m))
            );
          } else if (ev.type === 'sources') {
            setMessages(prev =>
              prev.map(m => (m.id === aiId ? { ...m, sources: ev.sources } : m))
            );
          } else if (ev.type === 'followups') {
            setMessages(prev =>
              prev.map(m =>
                m.id === aiId ? { ...m, followups: ev.questions } : m
              )
            );
          } else if (ev.type === 'done') {
          }
        }
      }
    } catch (e: any) {
      const msg = e?.message || 'Chat failed';
      const errId =
        aiId != null
          ? `${aiId}_err`
          : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_err`;
      push({ id: errId, role: 'system', text: msg });
    } finally {
      setBusy(false);
    }
  }, [attachedImage, canSend, input, isAggregatePrompt, push, questionMode]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearAll = useCallback(() => {
    if (messages.length > 0) {
      if (!window.confirm('대화를 삭제할까요?')) return;
    }
    setMessages([]);
    setFirstTokenMs(null);
    setAttachedImage(null);
    setIsAggregatePrompt(false);
    const nextKey = `sess_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    setSessionKey(nextKey);
    try {
      localStorage.setItem('ai_chat_current_session_key', nextKey);
    } catch {}
  }, [messages.length]);

  const summary = useMemo(() => {
    if (messages.length === 0) return '';
    const assistants = messages.filter(
      m => m.role === 'assistant' && m.text.trim()
    );
    const last = assistants[assistants.length - 1];
    const txt = last?.text || '';
    return txt.length > 160 ? `${txt.slice(0, 160)}…` : txt;
  }, [messages]);

  const pageTitle = useMemo(() => {
    return typeof document !== 'undefined' ? document.title : '';
  }, []);

  const handleAggregateFromSelected = useCallback(() => {
    if (!selectedSessionIds.length) return;
    aggregateFromSessionIds(selectedSessionIds);
  }, [aggregateFromSessionIds, selectedSessionIds]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ sessionIds?: string[] }>).detail;
      const ids = detail?.sessionIds;
      if (!Array.isArray(ids) || !ids.length) return;
      const filtered = ids.filter(id => typeof id === 'string');
      if (!filtered.length) return;
      aggregateFromSessionIds(filtered);
    };
    window.addEventListener('aiChat:aggregateFromGraph', handler as EventListener);
    return () => {
      window.removeEventListener(
        'aiChat:aggregateFromGraph',
        handler as EventListener
      );
    };
  }, [aggregateFromSessionIds]);

  useEffect(() => {
    if (!persistOptIn || !sessionKey) return;
    if (messages.length === 0) return;

    const nowIso = new Date().toISOString();
    const firstUser = messages.find(m => m.role === 'user' && m.text.trim());
    const baseTitle = (firstUser?.text || pageTitle || '새 대화')
      .split('\n')[0]
      .trim();
    const title =
      baseTitle.length > 60 ? `${baseTitle.slice(0, 60)}…` : baseTitle;
    const articleUrl =
      typeof window !== 'undefined' ? window.location.href : undefined;

    setSessions(prev => {
      const existing = prev.find(s => s.id === sessionKey);
      const createdAt = existing?.createdAt || nowIso;
      const next: ChatSessionMeta = {
        id: sessionKey,
        title: existing?.title || title,
        summary,
        createdAt,
        updatedAt: nowIso,
        messageCount: messages.length,
        mode: questionMode,
        articleUrl: articleUrl || existing?.articleUrl,
        articleTitle: pageTitle || existing?.articleTitle,
      };
      const others = prev.filter(s => s.id !== sessionKey);
      const updated = [next, ...others];
      try {
        localStorage.setItem(
          CHAT_SESSIONS_INDEX_KEY,
          JSON.stringify(updated)
        );
        if (typeof window !== 'undefined') {
          try {
            window.dispatchEvent(new CustomEvent('aiChat:sessionsUpdated'));
          } catch {}
        }
      } catch {}
      return updated;
    });
  }, [messages, summary, questionMode, pageTitle, persistOptIn, sessionKey]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (canSend) void send();
      }
    },
    [canSend, send]
  );

  return (
    <div className='fixed bottom-20 left-1/2 -translate-x-1/2 z-[10000] w-[min(100%-24px,42rem)] max-h-[70vh] flex flex-col rounded-xl border bg-background shadow-lg'>
      <div className='flex items-center justify-between px-4 py-2 border-b shrink-0'>
        <div className='flex items-center gap-2'>
          <Sparkles className='h-4 w-4 text-primary' />
          <h3 className='text-sm font-semibold'>AI Chat</h3>
        </div>
        <div className='flex items-center gap-3'>
          <div className='text-xs text-muted-foreground'>
            {busy ? (
              <span className='inline-flex items-center gap-1'>
                <Loader2 className='h-3.5 w-3.5 animate-spin' /> 생성 중
                {firstTokenMs != null && (
                  <span className='ml-1 text-muted-foreground/70'>
                    첫 토큰 {firstTokenMs}ms
                  </span>
                )}
              </span>
            ) : (
              <span className='text-xs text-muted-foreground'>
                Experimental
              </span>
            )}
          </div>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            className='h-7 px-2 text-[11px]'
            disabled={!sessions.length}
            onClick={() => setShowSessions(v => !v)}
          >
            최근 대화
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className='flex items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>
                    기록 저장
                  </span>
                  <Switch
                    checked={persistOptIn}
                    onCheckedChange={v => {
                      setPersistOptIn(!!v);
                      try {
                        localStorage.setItem(
                          'ai_chat_persist_optin',
                          v ? '1' : '0'
                        );
                      } catch {}
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className='max-w-[240px] text-xs'>
                  브라우저에만 저장됩니다. 언제든 삭제할 수 있어요.
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      {showSessions && sessions.length > 0 && (
        <div className='border-b bg-muted/40'>
          <div className='px-3 pt-2 max-h-40 overflow-y-auto text-xs space-y-1'>
            {sessions.map(s => {
              const checked = selectedSessionIds.includes(s.id);
              return (
                <div
                  key={s.id}
                  className='flex items-center gap-2 px-1 py-1 rounded hover:bg-muted'
                >
                  <input
                    type='checkbox'
                    className='h-3 w-3'
                    checked={checked}
                    onChange={() => toggleSessionSelected(s.id)}
                  />
                  <button
                    type='button'
                    className='flex-1 text-left'
                    onClick={() => {
                      loadSession(s.id);
                      setShowSessions(false);
                    }}
                  >
                    <div className='truncate font-medium'>
                      {s.title || '제목 없음'}
                    </div>
                    <div className='flex items-center gap-1 text-[10px] text-muted-foreground truncate'>
                      {s.articleTitle && (
                        <span className='truncate'>{s.articleTitle}</span>
                      )}
                      <span>
                        {new Date(s.updatedAt).toLocaleString()}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
          <div className='px-3 pb-2 pt-1 border-t flex items-center justify-between text-[11px]'>
            <span className='text-muted-foreground'>
              선택된 세션: {selectedSessionIds.length}개
            </span>
            <Button
              type='button'
              size='sm'
              className='h-7 px-2 text-[11px]'
              disabled={!selectedSessionIds.length}
              onClick={handleAggregateFromSelected}
            >
              통합 질문하기
            </Button>
          </div>
        </div>
      )}
      <div className='px-4 py-1 border-b text-[11px] text-muted-foreground'>
        {questionMode === 'article'
          ? `현재 글 '${pageTitle}' 기반으로 질문 중`
          : '일반 대화 모드 — 블로그 전체나 다른 주제로 자유롭게 이야기해 보세요.'}
      </div>
      <div
        ref={scrollRef}
        className='flex-1 min-h-[140px] max-h-[46vh] overflow-auto px-4 py-3 space-y-3'
      >
        {messages.length === 0 && (
          <div className='text-xs text-muted-foreground'>
            블로그와 현재 글에 대해 무엇이든 물어보세요.
          </div>
        )}
        {messages.map(m => {
          const isUser = m.role === 'user';
          const isAssistant = m.role === 'assistant';
          const isSystem = m.role === 'system';
          return (
            <div
              key={m.id}
              className={[
                'flex',
                isUser ? 'justify-end' : 'justify-start',
              ].join(' ')}
            >
              <div
                className={[
                  'max-w-[85%] text-sm leading-relaxed rounded-2xl px-3 py-2',
                  isUser && 'bg-primary text-primary-foreground rounded-br-sm',
                  isAssistant &&
                    'bg-secondary text-secondary-foreground rounded-bl-sm',
                  isSystem && 'bg-destructive/10 text-destructive',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {isAssistant ? (
                  <ChatMarkdown content={m.text} />
                ) : (
                  <span className='whitespace-pre-wrap'>{m.text}</span>
                )}
                {isAssistant &&
                  Array.isArray(m.sources) &&
                  m.sources.length > 0 && (
                    <div className='mt-2 space-y-1'>
                      <div className='text-[11px] text-muted-foreground'>
                        참고한 출처
                      </div>
                      <ul className='text-xs list-disc pl-4 space-y-1'>
                        {m.sources.map((s, i) => (
                          <li key={i}>
                            {s.url ? (
                              <a
                                className='underline'
                                href={s.url}
                                target='_blank'
                                rel='noreferrer'
                              >
                                {s.title || s.url}
                              </a>
                            ) : (
                              <span>{s.title || '출처'}</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                {isAssistant &&
                  Array.isArray(m.followups) &&
                  m.followups.length > 0 && (
                    <div className='mt-2'>
                      <div className='text-[11px] text-muted-foreground mb-1'>
                        연관 질문
                      </div>
                      <div className='flex flex-wrap gap-1'>
                        {m.followups.map((q, i) => (
                          <Button
                            key={i}
                            size='sm'
                            variant='secondary'
                            className='h-7 text-xs px-2'
                            onClick={() => setInput(q)}
                          >
                            {q}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          );
        })}
      </div>
      {persistOptIn && summary && (
        <div className='px-4 py-1 border-t text-[11px] text-muted-foreground truncate'>
          지난 대화 요약: {summary}
        </div>
      )}
      <div className='border-t shrink-0'>
        <div className='flex items-center justify-between px-3 pt-2 pb-1 gap-2'>
          <div className='inline-flex items-center rounded-full border bg-muted p-0.5'>
            <Button
              type='button'
              size='sm'
              variant={questionMode === 'article' ? 'secondary' : 'ghost'}
              className='h-6 px-2 text-[11px]'
              onClick={() => setQuestionMode('article')}
            >
              현재 글 기반 질문
            </Button>
            <Button
              type='button'
              size='sm'
              variant={questionMode === 'general' ? 'secondary' : 'ghost'}
              className='h-6 px-2 text-[11px]'
              onClick={() => setQuestionMode('general')}
            >
              일반 대화
            </Button>
          </div>
          <div className='hidden sm:inline text-[11px] text-muted-foreground truncate'>
            {questionMode === 'article'
              ? '이 페이지 내용을 참고해서 답변해요.'
              : '페이지와 무관하게 자유롭게 대화해요.'}
          </div>
        </div>
        {attachedImage && (
          <div className='px-3 pb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground'>
            <span className='inline-flex items-center gap-1 truncate'>
              <ImageIcon className='h-3 w-3' />
              <span className='truncate'>이미지 "{attachedImage.name}" 첨부됨</span>
            </span>
            <button
              type='button'
              className='text-[11px] underline'
              onClick={() => setAttachedImage(null)}
            >
              제거
            </button>
          </div>
        )}
        <div className='flex items-end gap-2 px-3 pb-3'>
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder='Type your message...'
            className='flex-1'
          />
          <div className='flex items-center gap-1'>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={e => {
                const file = e.target.files?.[0] ?? null;
                setAttachedImage(file);
              }}
            />
            <Button
              type='button'
              size='sm'
              variant='outline'
              className='h-9 px-2'
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className='h-4 w-4' />
            </Button>
            {busy ? (
              <Button
                onClick={stop}
                size='sm'
                variant='secondary'
                className='h-9'
              >
                <Square className='h-4 w-4' />
                <span className='hidden sm:inline ml-1'>Stop</span>
              </Button>
            ) : (
              <Button
                onClick={send}
                disabled={!canSend}
                size='sm'
                className='h-9'
              >
                <Send className='h-4 w-4' />
                <span className='hidden sm:inline ml-1'>Send</span>
              </Button>
            )}
            <Button
              onClick={clearAll}
              variant='ghost'
              size='sm'
              className='h-9'
            >
              새 대화
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
