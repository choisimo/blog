import React from "react";
import {
  Send,
  Loader2,
  Square,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { QuestionMode } from "../types";

type ChatInputProps = {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  onClearAll: () => void;
  onFileSelect: (file: File | null) => void;
  attachedImage: File | null;
  attachedPreviewUrl: string | null;
  busy: boolean;
  canSend: boolean;
  firstTokenMs: number | null;
  questionMode: QuestionMode;
  isTerminal: boolean;
  isMobile: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
};

export function ChatInput({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
  onClearAll,
  onFileSelect,
  attachedImage,
  attachedPreviewUrl,
  busy,
  canSend,
  firstTokenMs,
  questionMode,
  isTerminal,
  isMobile,
  textareaRef,
  fileInputRef,
}: ChatInputProps) {
  const placeholder =
    questionMode === "article"
      ? "현재 글 내용에 대해 물어보고 싶은 것을 입력하세요..."
      : "자유롭게 궁금한 내용을 입력하세요...";

  return (
    <div
      className={cn(
        "border-t shrink-0",
        isTerminal && isMobile ? "px-2 py-3" : "px-4 py-4",
        isMobile && "pb-[calc(1rem+env(safe-area-inset-bottom))]",
        isTerminal
          ? "bg-[hsl(var(--terminal-code-bg))] border-border"
          : "bg-white dark:bg-[#0A0A0A] border-[#EAEAEA] dark:border-[#222222]",
      )}
    >
      {/* New conversation button */}
      <div
        className={cn(
          "flex items-center justify-between mb-2",
          isTerminal && "font-mono",
        )}
      >
        <span
          className={cn(
            isTerminal
              ? "text-xs text-primary/60"
              : "text-[11px] text-[#AAAAAA] dark:text-[#555555]",
          )}
        >
          {isTerminal ? "# 새 주제 시작" : "새 주제를 시작할 땐"}
        </span>
        {isTerminal ? (
          <Button
            onClick={onClearAll}
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-xs font-mono text-primary/80 hover:text-primary hover:bg-primary/10 border border-primary/30"
          >
            $ clear
          </Button>
        ) : (
          <button
            onClick={onClearAll}
            className="text-[11px] text-[#666666] dark:text-[#888888] hover:text-[#111111] dark:hover:text-[#EEEEEE] px-2 py-1 rounded-sm hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A] transition-colors"
          >
            새 대화
          </button>
        )}
      </div>

      {/* Attached image preview */}
      {attachedImage && (
        <AttachedImagePreview
          image={attachedImage}
          previewUrl={attachedPreviewUrl}
          onRemove={() => onFileSelect(null)}
          isTerminal={isTerminal}
        />
      )}

      {/* Input field */}
      {isTerminal ? (
        <TerminalInput
          input={input}
          onInputChange={onInputChange}
          onKeyDown={onKeyDown}
          onSend={onSend}
          onStop={onStop}
          onFileClick={() => fileInputRef.current?.click()}
          busy={busy}
          canSend={canSend}
          firstTokenMs={firstTokenMs}
          questionMode={questionMode}
          isMobile={isMobile}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef}
          onFileSelect={onFileSelect}
        />
      ) : (
        <DefaultInput
          input={input}
          onInputChange={onInputChange}
          onKeyDown={onKeyDown}
          onSend={onSend}
          onStop={onStop}
          onFileClick={() => fileInputRef.current?.click()}
          busy={busy}
          canSend={canSend}
          placeholder={placeholder}
          isMobile={isMobile}
          textareaRef={textareaRef}
          fileInputRef={fileInputRef}
          onFileSelect={onFileSelect}
        />
      )}
    </div>
  );
}

// Attached image preview
function AttachedImagePreview({
  image,
  previewUrl,
  onRemove,
  isTerminal,
}: {
  image: File;
  previewUrl: string | null;
  onRemove: () => void;
  isTerminal: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 mb-3",
        isTerminal
          ? "rounded-lg border-primary/30 bg-[hsl(var(--terminal-code-bg))] font-mono"
          : "bg-muted/30",
      )}
    >
      <span className="inline-flex items-center gap-3 truncate min-w-0">
        <div
          className={cn(
            "h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-muted",
            isTerminal && "rounded border border-primary/20",
          )}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={image.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-5 w-5 mx-auto my-auto text-muted-foreground" />
          )}
        </div>
        <span className="inline-flex min-w-0 flex-col">
          <span className="inline-flex items-center gap-1 truncate text-sm">
            {isTerminal && <span className="text-primary/60">[img]</span>}
            <span className="truncate">{image.name}</span>
          </span>
          <span className="text-xs text-muted-foreground">
            {Math.max(1, Math.round(image.size / 1024))}KB
          </span>
        </span>
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn(
          "h-8 px-2 text-xs shrink-0",
          isTerminal && "text-destructive hover:bg-destructive/10",
        )}
        onClick={onRemove}
      >
        {isTerminal ? "[x]" : "제거"}
      </Button>
    </div>
  );
}

// Terminal-style input
function TerminalInput({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
  onFileClick,
  busy,
  canSend,
  firstTokenMs,
  questionMode,
  isMobile,
  textareaRef,
  fileInputRef,
  onFileSelect,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  onFileClick: () => void;
  busy: boolean;
  canSend: boolean;
  firstTokenMs: number | null;
  questionMode: QuestionMode;
  isMobile: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (file: File | null) => void;
}) {
  return (
    <div
      className={cn(
        "bg-[hsl(var(--terminal-code-bg))]",
        isMobile
          ? "border-0 rounded-none"
          : "border border-border rounded-lg focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/50",
        isMobile ? "px-1 py-1" : "px-3 py-3",
      )}
    >
      <div className="flex items-end gap-2">
        {!isMobile && (
          <span className="font-mono select-none shrink-0 py-2 text-sm flex items-center gap-0.5">
            <span className="text-muted-foreground/60">user</span>
            <span className="text-muted-foreground/40">@</span>
            <span className="text-primary/70">ai-chat</span>
            <span className="text-muted-foreground/40">:~</span>
            <span className="text-primary font-bold crt-text-glow">$</span>
          </span>
        )}
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={isMobile ? 2 : 1}
          placeholder={
            questionMode === "article"
              ? "현재 글에 대해 질문하세요..."
              : "무엇이든 물어보세요..."
          }
          ref={textareaRef}
          className={cn(
            "flex-1 resize-none border-0 bg-transparent py-2 font-mono text-foreground",
            "focus-visible:ring-0 focus-visible:ring-offset-0",
            "placeholder:text-muted-foreground/60 overflow-y-auto",
            isMobile
              ? "px-2 text-sm min-h-[56px] max-h-[96px]"
              : "px-1 text-[12px] leading-tight min-h-[40px] max-h-[72px]",
          )}
        />
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onFileSelect(file);
            }}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "rounded-lg border border-primary/30 text-primary/70 hover:text-primary hover:bg-primary/10 hover:border-primary/50",
              isMobile ? "h-11 w-11" : "h-10 w-10",
            )}
            onClick={onFileClick}
            aria-label="이미지 첨부"
          >
            <ImageIcon className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
          </Button>
          {busy ? (
            <Button
              onClick={onStop}
              size="icon"
              variant="ghost"
              className={cn(
                "rounded-lg border border-destructive/50 text-destructive hover:bg-destructive/10",
                isMobile ? "h-11 w-11" : "h-10 w-10",
              )}
            >
              <Square className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
            </Button>
          ) : (
            <Button
              onClick={onSend}
              disabled={!canSend}
              size="icon"
              className={cn(
                "rounded-lg border border-primary bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30",
                isMobile ? "h-11 w-11" : "h-10 w-10",
              )}
            >
              <Send className={isMobile ? "h-5 w-5" : "h-4 w-4"} />
            </Button>
          )}
        </div>
      </div>
      {busy && firstTokenMs != null && (
        <div className="flex items-center gap-2 mt-2 text-xs font-mono text-primary/70">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>응답 중... (첫 토큰: {firstTokenMs}ms)</span>
        </div>
      )}
    </div>
  );
}

// Default style input
function DefaultInput({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  onStop,
  onFileClick,
  busy,
  canSend,
  placeholder,
  isMobile,
  textareaRef,
  fileInputRef,
  onFileSelect,
}: {
  input: string;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStop: () => void;
  onFileClick: () => void;
  busy: boolean;
  canSend: boolean;
  placeholder: string;
  isMobile: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onFileSelect: (file: File | null) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#EAEAEA] dark:border-[#333333] bg-white dark:bg-[#0A0A0A]",
        "transition-colors focus-within:border-[#111111] dark:focus-within:border-[#EEEEEE]",
        "px-3 py-2.5",
      )}
    >
      <div className="flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={isMobile ? 2 : 2}
          placeholder={placeholder}
          ref={textareaRef}
          className={cn(
            "flex-1 resize-none border-0 bg-transparent px-0 py-1.5",
            "text-[13px] text-[#111111] dark:text-[#EEEEEE]",
            "placeholder:text-[#AAAAAA] focus-visible:ring-0 focus-visible:ring-offset-0 overflow-y-auto",
            isMobile
              ? "min-h-[44px] max-h-[96px]"
              : "min-h-[44px] max-h-[96px]",
          )}
        />
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onFileSelect(file);
            }}
          />
          <button
            type="button"
            onClick={onFileClick}
            aria-label="이미지 첨부"
            className="h-8 w-8 flex items-center justify-center rounded-md transition-colors text-[#AAAAAA] hover:text-[#111111] dark:hover:text-[#EEEEEE] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]"
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </button>
          {busy ? (
            <button
              onClick={onStop}
              className="h-8 w-8 flex items-center justify-center rounded-md transition-colors text-[#888888] hover:text-[#111111] dark:hover:text-[#EEEEEE] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!canSend}
              type="button"
              className={cn(
                "h-8 w-8 flex items-center justify-center rounded-md transition-colors",
                canSend
                  ? "text-[#111111] dark:text-[#EEEEEE] hover:bg-[#F5F5F5] dark:hover:bg-[#1A1A1A]"
                  : "text-[#CCCCCC] dark:text-[#444444] cursor-not-allowed",
              )}
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
