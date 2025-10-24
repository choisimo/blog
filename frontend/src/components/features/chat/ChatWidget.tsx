import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { streamChatMessage } from '@/services/chat';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
};

export default function ChatWidget(props: { onClose?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const canSend = input.trim().length > 0 && !busy;

  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    sc.scrollTop = sc.scrollHeight + 1000;
  }, [messages, busy]);

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
    try {
      let acc = '';
      push({ id: aiId, role: 'assistant', text: '' });
      for await (const chunk of streamChatMessage({ text })) {
        acc += chunk;
        setMessages(prev => prev.map(m => (m.id === aiId ? { ...m, text: acc } : m)));
      }
    } catch (e: any) {
      const msg = e?.message || 'Chat failed';
      push({ id: `${aiId}_err`, role: 'system', text: msg });
    } finally {
      setBusy(false);
    }
  }, [canSend, input, push]);

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
        <div className="text-xs text-muted-foreground">Experimental</div>
      </div>
      <div ref={scrollRef} className="flex-1 min-h-[140px] max-h-[50vh] overflow-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground">Ask anything about the post or the site.</div>
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
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-2 p-3 border-t shrink-0">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          rows={2}
          placeholder="Type your message..."
          className="flex-1"
        />
        <Button onClick={send} disabled={!canSend} size="sm" className="h-9">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          <span className="hidden sm:inline ml-1">Send</span>
        </Button>
      </div>
    </div>
  );
}
