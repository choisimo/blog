import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ChatSessionMeta, UploadedChatImage } from "../types";

type ImageDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadedImages: UploadedChatImage[];
};

export function ImageDrawer({
  open,
  onOpenChange,
  uploadedImages,
}: ImageDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>이미지 메모</DialogTitle>
          <DialogDescription>
            최근 대화에서 첨부한 이미지들을 다시 확인할 수 있어요.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto overscroll-contain space-y-2 text-sm">
          {uploadedImages.length === 0 && (
            <p className="text-muted-foreground text-sm">
              저장된 이미지가 없습니다.
            </p>
          )}
          {uploadedImages.map((img) => (
            <button
              key={img.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-lg border px-2 py-1 text-left hover:bg-muted"
              onClick={() => {
                try {
                  window.open(img.url, "_blank", "noopener,noreferrer");
                } catch {
                  void 0;
                }
              }}
            >
              <div className="h-12 w-12 overflow-hidden rounded bg-muted">
                <img
                  src={img.url}
                  alt={img.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1 truncate">
                <div className="font-medium truncate">{img.name}</div>
                <div className="text-xs text-muted-foreground">
                  {Math.max(1, Math.round(img.size / 1024))}KB
                </div>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type MobileActionSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessions: ChatSessionMeta[];
  uploadedImages: UploadedChatImage[];
  persistOptIn: boolean;
  onShowSessions: () => void;
  onShowImageDrawer: () => void;
  onTogglePersist: () => void;
  onStartDebate?: () => void;
  currentLiveRoomLabel?: string;
  onClearAll: () => void;
  isTerminal: boolean;
  livePinned?: boolean;
  onToggleLivePinned?: () => void;
};

export function MobileActionSheet({
  open,
  onOpenChange,
  sessions,
  uploadedImages,
  persistOptIn,
  onShowSessions,
  onShowImageDrawer,
  onTogglePersist,
  onStartDebate,
  currentLiveRoomLabel,
  onClearAll,
  isTerminal,
  livePinned = false,
  onToggleLivePinned,
}: MobileActionSheetProps) {
  const runAction = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "h-auto max-h-[85vh] rounded-t-3xl px-6 pb-8 pt-4",
          isTerminal &&
            "rounded-t-xl bg-[hsl(var(--terminal-code-bg))] border-primary/30",
        )}
        aria-describedby={undefined}
      >
        <SheetHeader className="text-left pb-4">
          <SheetTitle
            className={cn("text-lg", isTerminal && "font-mono text-primary")}
          >
            {isTerminal ? ">_ 대화 옵션" : "대화 옵션"}
          </SheetTitle>
          <SheetDescription className={isTerminal ? "font-mono" : ""}>
            대화 관리 및 설정
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3">
          <ActionButton
            label="최근 대화 보기"
            value={`${sessions.length}개`}
            disabled={!sessions.length}
            onClick={() => runAction(onShowSessions)}
            isTerminal={isTerminal}
          />
          <ActionButton
            label="이미지 메모 보기"
            value={`${uploadedImages.length}개`}
            disabled={!uploadedImages.length}
            onClick={() => runAction(onShowImageDrawer)}
            isTerminal={isTerminal}
          />
          <ActionButton
            label={persistOptIn ? "기록 저장 끄기" : "기록 저장 켜기"}
            value={persistOptIn ? "ON" : "OFF"}
            valueBadge
            valuePrimary={persistOptIn}
            onClick={() => runAction(onTogglePersist)}
            isTerminal={isTerminal}
          />
          <ActionButton
            label={livePinned ? "LIVE 고정 끄기" : "LIVE 고정 켜기"}
            value={livePinned ? "ON" : "OFF"}
            valueBadge
            valuePrimary={livePinned}
            disabled={!onToggleLivePinned}
            onClick={() => runAction(() => onToggleLivePinned?.())}
            isTerminal={isTerminal}
          />
          <ActionButton
            label={
              currentLiveRoomLabel
                ? `현재 방 AI 토론 (${currentLiveRoomLabel})`
                : "현재 방 AI 토론"
            }
            value="LIVE"
            valueBadge
            valuePrimary
            disabled={!onStartDebate}
            onClick={() => runAction(() => onStartDebate?.())}
            isTerminal={isTerminal}
          />
          <ActionButton
            label="대화 초기화"
            destructive
            onClick={() => runAction(onClearAll)}
            isTerminal={isTerminal}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ActionButton({
  label,
  value,
  valueBadge,
  valuePrimary,
  disabled,
  destructive,
  onClick,
  isTerminal,
}: {
  label: string;
  value?: string;
  valueBadge?: boolean;
  valuePrimary?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  onClick: () => void;
  isTerminal: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-colors",
        isTerminal
          ? "rounded-lg border-primary/30 hover:bg-primary/10 font-mono"
          : "hover:bg-muted",
        disabled && "opacity-50 cursor-not-allowed",
        destructive &&
          (isTerminal
            ? "border-destructive/40 text-destructive hover:bg-destructive/10"
            : "border-destructive/40 text-destructive hover:bg-destructive/5"),
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="text-base">{label}</span>
      {value && (
        <span
          className={cn(
            "text-sm",
            valueBadge && "px-2 py-0.5 rounded-full",
            valueBadge && valuePrimary
              ? isTerminal
                ? "bg-primary/20 text-primary"
                : "bg-primary/10 text-primary"
              : valueBadge
                ? "bg-muted text-muted-foreground"
                : isTerminal
                  ? "text-primary/60"
                  : "text-muted-foreground",
          )}
        >
          {value}
        </span>
      )}
    </button>
  );
}
