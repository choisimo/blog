/**
 * Console Input Component
 * 
 * Terminal-style input with mode selector
 * High-fidelity cyberpunk industrial style
 */

import { memo, useRef, useEffect, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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
  label?: string;
  title?: string;
  inputLabel?: string;
  placeholder?: string;
  submitLabel?: string;
  stopLabel?: string;
  newlineHint?: string;
}

const MODE_CONFIG: Record<ConsoleMode, { icon: typeof Database; label: string; desc: string }> = {
  rag: { icon: Database, label: 'RAG', desc: 'Search blog knowledge' },
  agent: { icon: Cpu, label: 'Agent', desc: 'Multi-step reasoning' },
  web: { icon: Globe, label: 'Web', desc: 'Search the internet' },
};
const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;
const DEFAULT_CONSOLE_INPUT_LABEL = 'Console input';
const DEFAULT_TEXTAREA_LABEL = 'Console query';
const DEFAULT_PLACEHOLDER = 'Ask about blog content...';
const DEFAULT_SUBMIT_LABEL = 'Send message';
const DEFAULT_STOP_LABEL = 'Stop response';
const DEFAULT_NEWLINE_HINT = 'Shift+Enter for newline';

function normalizeInputValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function normalizeConsoleMode(value: unknown): ConsoleMode {
  return typeof value === 'string' && value in MODE_CONFIG
    ? (value as ConsoleMode)
    : 'rag';
}

function normalizeConsoleInputText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return fallback;
  }

  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized || fallback;
}

function isComposingEvent(e: ReactKeyboardEvent<HTMLTextAreaElement>): boolean {
  const nativeEvent = e.nativeEvent as { isComposing?: boolean };
  const syntheticEvent = e as unknown as { isComposing?: boolean };
  return nativeEvent.isComposing === true || syntheticEvent.isComposing === true;
}

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
      aria-pressed={isActive}
    >
      <Icon className={cn(isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5')} aria-hidden="true" />
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
  label = DEFAULT_CONSOLE_INPUT_LABEL,
  title,
  inputLabel = DEFAULT_TEXTAREA_LABEL,
  placeholder = DEFAULT_PLACEHOLDER,
  submitLabel = DEFAULT_SUBMIT_LABEL,
  stopLabel = DEFAULT_STOP_LABEL,
  newlineHint = DEFAULT_NEWLINE_HINT,
}: ConsoleInputProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const inputValue = normalizeInputValue(value);
  const activeMode = normalizeConsoleMode(mode);
  const hasInput = inputValue.trim().length > 0;
  const isInputDisabled = Boolean(disabled || isProcessing);
  const safeLabel = normalizeConsoleInputText(label, DEFAULT_CONSOLE_INPUT_LABEL);
  const safeTitle = normalizeConsoleInputText(title);
  const safeInputLabel = normalizeConsoleInputText(inputLabel, DEFAULT_TEXTAREA_LABEL);
  const safePlaceholder = normalizeConsoleInputText(placeholder, DEFAULT_PLACEHOLDER);
  const safeSubmitLabel = normalizeConsoleInputText(submitLabel, DEFAULT_SUBMIT_LABEL);
  const safeStopLabel = normalizeConsoleInputText(stopLabel, DEFAULT_STOP_LABEL);
  const safeNewlineHint = normalizeConsoleInputText(newlineHint, DEFAULT_NEWLINE_HINT);

  useEffect(() => {
    // Don't auto-focus on mobile to prevent keyboard popup
    if (!isProcessing && inputRef.current && !isMobile) {
      inputRef.current.focus();
    }
  }, [isProcessing, isMobile]);

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (isComposingEvent(e)) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessing && !disabled && hasInput) {
        onSubmit();
      }
    }
  };

  const handleSubmit = () => {
    if (isProcessing) {
      onStop();
    } else if (!disabled && hasInput) {
      onSubmit();
    }
  };

  return (
    <div className={cn(
      'border-t',
      isTerminal ? 'border-border' : 'border-border',
      className
    )}
      aria-label={safeLabel}
      title={safeTitle || undefined}
    >
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
            isActive={activeMode === m}
            onClick={() => onModeChange(m)}
            isMobile={isMobile}
            isTerminal={isTerminal}
          />
        ))}
        <div className="flex-1" />
        {!isMobile && (
          <span className="text-[10px] font-mono text-muted-foreground px-2">
            {safeNewlineHint}
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
            value={inputValue}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={safePlaceholder}
            aria-label={safeInputLabel}
            disabled={isInputDisabled}
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
              target.style.height = `${Math.min(target.scrollHeight, isMobile ? 100 : 120)}px`;
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || (!isProcessing && !hasInput)}
          aria-label={isProcessing ? safeStopLabel : safeSubmitLabel}
          className={cn(
            'flex-shrink-0 rounded flex items-center justify-center transition-all',
            isMobile ? 'w-11 h-11 min-w-[44px] min-h-[44px]' : 'w-8 h-8',
            isProcessing
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : hasInput
                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                : isTerminal
                  ? 'bg-muted/50 text-muted-foreground cursor-not-allowed'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {isProcessing ? (
            <Square className={cn(isMobile ? 'w-5 h-5' : 'w-4 h-4')} aria-hidden="true" />
          ) : (
            <Send className={cn(isMobile ? 'w-5 h-5' : 'w-4 h-4')} aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
});
