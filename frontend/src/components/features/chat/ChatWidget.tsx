import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { streamChatEvents, ensureSession } from '@/services/chat';

export type SourceLink = { title?: string; url?: string; score?: number; snippet?: string };
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  sources?: SourceLink[];
  followups?: string[];
};

export default function ChatWidget(props: { onClose?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [persistOptIn, setPersistOptIn] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [firstTokenMs, setFirstTokenMs] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canSend = input.trim().length > 0 && !busy;

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    sc.scrollTop = sc.scrollHeight + 1000;
  }, [messages, busy]);

  useEffect(() => {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem('ai_chat_persist_optin') : null;
    setPersistOptIn(v === '1');
  }, []);

  useEffect(() => {
    ensureSession().then((id) => setSessionId(id)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!persistOptIn || !sessionId) return;
    try {
      const raw = localStorage.getItem(`ai_chat_history_${sessionId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {}
  }, [persistOptIn, sessionId]);

  useEffect(() => {
    if (!persistOptIn || !sessionId) return;
    try {
      localStorage.setItem(`ai_chat_history_${sessionId}`, JSON.stringify(messages));
    } catch {}
  }, [messages, persistOptIn, sessionId]);

  const push = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  const send = useCallback(async () => {
    if (!canSend) return;
    const text = input.trim();
    setInput('');
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    push({ id, role: 'user', text });

    const aiId = `${id}_ai`;
    setBusy(true);
    setFirstTokenMs(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let acc = '';
      push({ id: aiId, role: 'assistant', text: '' });
      for await (const ev of streamChatEvents({ text, signal: controller.signal, onFirstToken: (ms) => setFirstTokenMs(ms) })) {
        if (ev.type === 'text') {
          acc += ev.text;
          setMessages(prev => prev.map(m => (m.id === aiId ? { ...m, text: acc } : m)));
        } else if (ev.type === 'sources') {
          setMessages(prev => prev.map(m => (m.id === aiId ? { ...m, sources: ev.sources } : m)));
        } else if (ev.type === 'followups') {
          setMessages(prev => prev.map(m => (m.id === aiId ? { ...m, followups: ev.questions } : m)));
        } else if (ev.type === 'done') {
        }
      }
    } catch (e: any) {
      const msg = e?.message || 'Chat failed';
      push({ id: `${aiId}_err`, role: 'system', text: msg });
    } finally {
      setBusy(false);
    }
  }, [canSend, input, push]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearAll = useCallback(() => {
    if (messages.length > 0) {
      if (!window.confirm('대화를 삭제할까요?')) return;
    }
    setMessages([]);
    setFirstTokenMs(null);
    if (persistOptIn && sessionId) {
      try { localStorage.removeItem(`ai_chat_history_${sessionId}`); } catch {}
    }
  }, [messages.length, persistOptIn, sessionId]);

  const summary = useMemo(() => {
    if (messages.length === 0) return '';
    const assistants = messages.filter(m => m.role === 'assistant' && m.text.trim());
    const last = assistants[assistants.length - 1];
    const txt = last?.text || '';
    return txt.length > 160 ? `${txt.slice(0, 160)}…` : txt;
  }, [messages]);

  const pageTitle = useMemo(() => {
    return typeof document !== 'undefined' ? document.title : '';
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) void send();
    }
  }, [canSend, send]);

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[10000] w-[min(100%-24px,42rem)] max-h-[70vh] flex flex-col rounded-xl border bg-background shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">AI Chat</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-muted-foreground">
            {busy ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 생성 중
                {firstTokenMs != null && <span className="ml-1 text-muted-foreground/70">첫 토큰 {firstTokenMs}ms</span>}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Experimental</span>
            )}
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">기록 저장</span>
                  <Switch checked={persistOptIn} onCheckedChange={(v) => {
                    setPersistOptIn(!!v);
                    try { localStorage.setItem('ai_chat_persist_optin', v ? '1' : '0'); } catch {}
                  }} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-[240px] text-xs">브라우저에만 저장됩니다. 언제든 삭제할 수 있어요.</div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="px-4 py-1 border-b text-[11px] text-muted-foreground">
        현재 글 '{pageTitle}' 기반으로 질문 중
      </div>
      <div ref={scrollRef} className="flex-1 min-h-[140px] max-h-[46vh] overflow-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground">블로그와 현재 글에 대해 무엇이든 물어보세요.</div>
        )}
        {messages.map(m => {
          const isUser = m.role === 'user';
          const isAssistant = m.role === 'assistant';
          const isSystem = m.role === 'system';
          return (
            <div key={m.id} className={[
              'flex',
              isUser ? 'justify-end' : 'justify-start',
            ].join(' ')}>
              <div className={[
                'max-w-[85%] whitespace-pre-wrap text-sm leading-relaxed rounded-2xl px-3 py-2',
                isUser && 'bg-primary text-primary-foreground rounded-br-sm',
                isAssistant && 'bg-secondary text-secondary-foreground rounded-bl-sm',
                isSystem && 'bg-destructive/10 text-destructive',
              ].filter(Boolean).join(' ')}>
                {m.text}
                {isAssistant && Array.isArray(m.sources) && m.sources.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-[11px] text-muted-foreground">참고한 출처</div>
                    <ul className="text-xs list-disc pl-4 space-y-1">
                      {m.sources.map((s, i) => (
                        <li key={i}>
                          {s.url ? (
                            <a className="underline" href={s.url} target="_blank" rel="noreferrer">
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
                {isAssistant && Array.isArray(m.followups) && m.followups.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[11px] text-muted-foreground mb-1">연관 질문</div>
                    <div className="flex flex-wrap gap-1">
                      {m.followups.map((q, i) => (
                        <Button key={i} size="sm" variant="secondary" className="h-7 text-xs px-2" onClick={() => setInput(q)}>
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
        <div className="px-4 py-1 border-t text-[11px] text-muted-foreground truncate">
          지난 대화 요약: {summary}
        </div>
      )}
      <div className="flex items-end gap-2 p-3 border-t shrink-0">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Type your message..."
          className="flex-1"
        />
        {busy ? (
          <Button onClick={stop} size="sm" variant="secondary" className="h-9">
            <Square className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Stop</span>
          </Button>
        ) : (
          <Button onClick={send} disabled={!canSend} size="sm" className="h-9">
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Send</span>
          </Button>
        )}
        <Button onClick={clearAll} variant="ghost" size="sm" className="h-9">새 대화</Button>
      </div>
    </div>
  );
}
