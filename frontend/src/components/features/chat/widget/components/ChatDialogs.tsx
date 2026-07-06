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

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const ANSI_ESCAPE_DETECTOR = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/;
const DIALOG_CONTROL_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const DIALOG_URL_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/;
const SAFE_DIALOG_IMAGE_PROTOCOLS = new Set(["http:", "https:", "blob:"]);

function stripUnsafeDialogControls(value: string): string {
  return value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(DIALOG_CONTROL_TEXT_PATTERN, "");
}

function normalizeDialogLabel(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const normalized = stripUnsafeDialogControls(value)
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function normalizeDialogImageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const rawUrl = value.trim();
  if (
    !rawUrl ||
    ANSI_ESCAPE_DETECTOR.test(rawUrl) ||
    DIALOG_URL_CONTROL_PATTERN.test(rawUrl) ||
    rawUrl.includes("\\") ||
    rawUrl.startsWith("//")
  ) {
    return null;
  }

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(rawUrl);
  } catch {
    return null;
  }

  if (DIALOG_URL_CONTROL_PATTERN.test(decodedUrl) || decodedUrl.includes("\\")) {
    return null;
  }

  if (rawUrl.startsWith("/")) return rawUrl;

  try {
    const base =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost";
    const parsed = new URL(rawUrl, base);
    if (!SAFE_DIALOG_IMAGE_PROTOCOLS.has(parsed.protocol)) return null;
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && (parsed.username || parsed.password)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function formatImageSize(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return "크기 알 수 없음";
  }

  return `${Math.max(1, Math.round(value / 1024))}KB`;
}

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
          {uploadedImages.map((img) => {
            const imageName = normalizeDialogLabel(img.name, "첨부 이미지");
            const imageUrl = normalizeDialogImageUrl(img.url);
            const imageSize = formatImageSize(img.size);
            return (
              <button
                key={img.id}
                type="button"
                aria-label={`이미지 열기: ${imageName}`}
                className="flex w-full items-center gap-3 rounded-lg border px-2 py-1 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!imageUrl}
                onClick={() => {
                  if (!imageUrl) return;
                  try {
                    window.open(imageUrl, "_blank", "noopener,noreferrer");
                  } catch {
                    void 0;
                  }
                }}
                title={imageName}
              >
                <div aria-hidden="true" className="h-12 w-12 overflow-hidden rounded bg-muted">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex-1 truncate">
                  <div className="font-medium truncate">{imageName}</div>
                  <div className="text-xs text-muted-foreground">
                    {imageSize}
                  </div>
                </div>
              </button>
            );
          })}
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
  const liveRoomLabel = normalizeDialogLabel(currentLiveRoomLabel);
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
              liveRoomLabel
                ? `현재 방 AI 토론 (${liveRoomLabel})`
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
  const safeLabel = normalizeDialogLabel(label, "대화 작업");
  const safeValue = normalizeDialogLabel(value);
  const buttonLabel = safeValue ? `${safeLabel}, ${safeValue}` : safeLabel;

  return (
    <button
      type="button"
      aria-label={buttonLabel}
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
      title={buttonLabel}
    >
      <span className="text-base">{safeLabel}</span>
      {safeValue && (
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
          {safeValue}
        </span>
      )}
    </button>
  );
}
