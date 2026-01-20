/**
 * Console Messages Display
 * 
 * Renders conversation messages with streaming support
 * High-fidelity cyberpunk industrial style
 */

import { memo, useRef, useEffect } from 'react';
import { User, Bot, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConsoleCitations } from './ConsoleCitations';
import type { ConsoleMessage } from './types';

interface ConsoleMessagesProps {
  messages: ConsoleMessage[];
  isMobile?: boolean;
  isTerminal?: boolean;
  scrollKey?: unknown;
  className?: string;
}

function MessageContent({ content, isStreaming, isMobile }: { content: string; isStreaming?: boolean; isMobile?: boolean }) {
  if (!content && isStreaming) {
    return (
      <span className="inline-flex items-center gap-1 text-zinc-500">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-75" />
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse delay-150" />
      </span>
    );
  }

  return (
    <div className={cn('prose prose-invert max-w-none', isMobile ? 'prose-base' : 'prose-sm')}>
      <p className="whitespace-pre-wrap break-words leading-relaxed m-0">
        {content}
        {isStreaming && (
          <span className="inline-block w-2 h-4 ml-0.5 bg-primary/80 animate-pulse" />
        )}
      </p>
    </div>
  );
}

function UserMessage({ message, isMobile }: { message: ConsoleMessage; isMobile?: boolean }) {
  return (
    <div className={cn(
      'flex gap-3 bg-zinc-900/30',
      isMobile ? 'py-3 px-3' : 'py-3 px-4'
    )}>
      <div className={cn(
        'flex-shrink-0 rounded bg-zinc-800 flex items-center justify-center',
        isMobile ? 'w-8 h-8' : 'w-7 h-7'
      )}>
        <User className={cn(isMobile ? 'w-4.5 h-4.5' : 'w-4 h-4', 'text-zinc-400')} />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={cn(
          'text-foreground whitespace-pre-wrap break-words',
          isMobile ? 'text-base' : 'text-sm'
        )}>
          {message.content}
        </p>
      </div>
    </div>
  );
}

function AssistantMessage({ message, isMobile }: { message: ConsoleMessage; isMobile?: boolean }) {
  return (
    <div className={cn(
      'border-l-2 border-primary/30 bg-zinc-900/10',
      isMobile ? 'py-3 px-3' : 'py-3 px-4'
    )}>
      <div className="flex gap-3">
        <div className={cn(
          'flex-shrink-0 rounded bg-primary/10 border border-primary/20 flex items-center justify-center',
          isMobile ? 'w-8 h-8' : 'w-7 h-7'
        )}>
          <Bot className={cn(isMobile ? 'w-4.5 h-4.5' : 'w-4 h-4', 'text-primary')} />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <MessageContent content={message.content} isStreaming={message.isStreaming} isMobile={isMobile} />
        </div>
      </div>

      {message.citations && message.citations.length > 0 && (
        <div className={cn(
          'mt-3 pt-3 border-t border-zinc-800/50',
          isMobile ? 'ml-0' : 'ml-10'
        )}>
          <ConsoleCitations citations={message.citations} />
        </div>
      )}

      {message.error && (
        <div className={cn(
          'mt-2 flex items-center gap-2 text-red-400',
          isMobile ? 'ml-0 text-sm' : 'ml-10 text-xs'
        )}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{message.error}</span>
        </div>
      )}
    </div>
  );
}

function SystemMessage({ message, isMobile }: { message: ConsoleMessage; isMobile?: boolean }) {
  return (
    <div className={cn('py-2 text-center', isMobile ? 'px-3' : 'px-4')}>
      <span className={cn(
        'font-mono uppercase tracking-wider text-zinc-600 bg-zinc-900/50 rounded-full',
        isMobile ? 'text-xs px-3 py-1.5' : 'text-[10px] px-3 py-1'
      )}>
        {message.content}
      </span>
    </div>
  );
}

export const ConsoleMessages = memo(function ConsoleMessages({
  messages,
  isMobile,
  isTerminal,
  scrollKey,
  className,
}: ConsoleMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    });
  }, [messages, scrollKey]);

  if (messages.length === 0) {
    return (
      <div className={cn(
        'flex-1 flex flex-col items-center justify-start pt-4 pb-8',
        isMobile ? 'px-4' : 'px-8',
        className
      )}>
        <div className={cn('text-center space-y-3', isMobile ? 'max-w-[280px]' : 'max-w-md')}>
          <div className={cn(
            'mx-auto rounded-lg flex items-center justify-center',
            isTerminal 
              ? 'bg-primary/10 border border-primary/20' 
              : 'bg-muted border border-border',
            isMobile ? 'w-12 h-12' : 'w-14 h-14'
          )}>
            <Bot className={cn(
              isMobile ? 'w-6 h-6' : 'w-7 h-7',
              isTerminal ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
          <div className="space-y-1.5">
            <h3 className={cn(
              'font-medium',
              isTerminal ? 'text-primary' : 'text-foreground',
              isMobile ? 'text-sm' : 'text-sm'
            )}>
              AI Console
            </h3>
            <p className={cn(
              'leading-relaxed',
              isTerminal ? 'text-muted-foreground' : 'text-muted-foreground',
              isMobile ? 'text-xs' : 'text-xs'
            )}>
              Ask questions about blog posts. RAG-powered search retrieves relevant content.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex-1 overflow-y-auto', className)}>
      <div className="divide-y divide-zinc-800/30">
        {messages.map(message => {
          switch (message.role) {
            case 'user':
              return <UserMessage key={message.id} message={message} isMobile={isMobile} />;
            case 'assistant':
              return <AssistantMessage key={message.id} message={message} isMobile={isMobile} />;
            case 'system':
              return <SystemMessage key={message.id} message={message} isMobile={isMobile} />;
            default:
              return null;
          }
        })}
      </div>
      <div ref={bottomRef} />
    </div>
  );
});
