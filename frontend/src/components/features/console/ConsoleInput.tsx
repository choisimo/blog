/**
 * Console Input Component
 * 
 * Terminal-style input with mode selector
 * High-fidelity cyberpunk industrial style
 */

import { memo, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Square, Database, Globe, Cpu, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConsoleMode } from './types';

interface ConsoleInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isProcessing: boolean;
  mode: ConsoleMode;
  onModeChange: (mode: ConsoleMode) => void;
  disabled?: boolean;
  isMobile?: boolean;
  isTerminal?: boolean;
  className?: string;
}

const MODE_CONFIG: Record<ConsoleMode, { icon: typeof Database; label: string; desc: string }> = {
  rag: { icon: Database, label: 'RAG', desc: 'Search blog knowledge' },
  agent: { icon: Cpu, label: 'Agent', desc: 'Multi-step reasoning' },
  web: { icon: Globe, label: 'Web', desc: 'Search the internet' },
};

function ModeTab({
  mode,
  isActive,
  onClick,
  isMobile,
  isTerminal,
}: {
  mode: ConsoleMode;
  isActive: boolean;
  onClick: () => void;
  isMobile?: boolean;
  isTerminal?: boolean;
}) {
  const config = MODE_CONFIG[mode];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center font-mono transition-all border-b-2 -mb-[2px]',
        isMobile 
          ? 'gap-2 px-3 py-2.5 text-sm min-h-[44px]' 
          : 'gap-1.5 px-2.5 py-1.5 text-xs',
        isActive
          ? 'text-primary border-primary bg-primary/5'
          : isTerminal
            ? 'text-muted-foreground border-transparent hover:text-foreground hover:border-primary/30'
            : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
      )}
      title={config.desc}
    >
      <Icon className={cn(isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
      <span>{config.label}</span>
    </button>
  );
}

export const ConsoleInput = memo(function ConsoleInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isProcessing,
  mode,
  onModeChange,
  disabled,
  isMobile,
  isTerminal,
  className,
}: ConsoleInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Don't auto-focus on mobile to prevent keyboard popup
    if (!isProcessing && inputRef.current && !isMobile) {
      inputRef.current.focus();
    }
  }, [isProcessing, isMobile]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessing && value.trim()) {
        onSubmit();
      }
    }
  };

  const handleSubmit = () => {
    if (isProcessing) {
      onStop();
    } else if (value.trim()) {
      onSubmit();
    }
  };

  return (
    <div className={cn(
      'border-t',
      isTerminal ? 'border-border' : 'border-border',
      className
    )}>
      {/* Mode Tabs */}
      <div className={cn(
        'flex items-center border-b',
        isTerminal 
          ? 'border-border/50 bg-background/30'
          : 'border-border/50 bg-muted/30',
        isMobile ? 'px-1 overflow-x-auto' : 'px-2'
      )}>
        {(Object.keys(MODE_CONFIG) as ConsoleMode[]).map(m => (
          <ModeTab
            key={m}
            mode={m}
            isActive={mode === m}
            onClick={() => onModeChange(m)}
            isMobile={isMobile}
            isTerminal={isTerminal}
          />
        ))}
        <div className="flex-1" />
        {!isMobile && (
          <span className="text-[10px] font-mono text-muted-foreground px-2">
            Shift+Enter for newline
          </span>
        )}
      </div>

      {/* Input Area */}
      <div className={cn(
        'flex items-end gap-2',
        isTerminal ? 'bg-background/20' : 'bg-muted/20',
        isMobile ? 'p-3 pb-4' : 'p-3'
      )}>
        {!isMobile && (
          <div className={cn(
            'flex-shrink-0 flex items-center gap-1 text-xs font-mono pt-2',
            isTerminal ? 'text-primary/70' : 'text-muted-foreground'
          )}>
            <ChevronRight className="w-4 h-4" />
          </div>
        )}

        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about blog content..."
            disabled={disabled || isProcessing}
            rows={1}
            className={cn(
              'w-full bg-transparent text-foreground placeholder:text-muted-foreground',
              'resize-none outline-none',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isMobile 
                ? 'text-base min-h-[32px] max-h-[100px]' 
                : 'text-sm min-h-[24px] max-h-[120px]'
            )}
            style={{
              height: 'auto',
              minHeight: isMobile ? '32px' : '24px',
            }}
            onInput={e => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, isMobile ? 100 : 120) + 'px';
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || (!isProcessing && !value.trim())}
          className={cn(
            'flex-shrink-0 rounded flex items-center justify-center transition-all',
            isMobile ? 'w-11 h-11 min-w-[44px] min-h-[44px]' : 'w-8 h-8',
            isProcessing
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : value.trim()
                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                : isTerminal
                  ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {isProcessing ? (
            <Square className={cn(isMobile ? 'w-5 h-5' : 'w-4 h-4')} />
          ) : (
            <Send className={cn(isMobile ? 'w-5 h-5' : 'w-4 h-4')} />
          )}
        </button>
      </div>
    </div>
  );
});
