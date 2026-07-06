import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatStatusBanner } from "../types";

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const STATUS_CONTROL_TEXT_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function stripUnsafeStatusControls(value: string): string {
  return value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(STATUS_CONTROL_TEXT_PATTERN, "");
}

function normalizeStatusText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const normalized = stripUnsafeStatusControls(value)
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function getBannerToneClass(
  tone: ChatStatusBanner["tone"],
  isTerminal: boolean,
) {
  if (tone === "error") {
    return isTerminal
      ? "border-destructive/40 bg-destructive/10 text-destructive"
      : "border-destructive/30 bg-destructive/10 text-destructive";
  }

  if (tone === "warn") {
    return isTerminal
      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
      : "border-amber-500/30 bg-amber-500/10 text-amber-700";
  }

  return isTerminal
    ? "border-primary/30 bg-primary/10 text-primary"
    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
}

function BannerIcon({
  tone,
  text,
}: {
  tone: ChatStatusBanner["tone"];
  text: string;
}) {
  if (tone === "error") {
    return <WifiOff aria-hidden="true" className="h-4 w-4 shrink-0" focusable="false" />;
  }

  if (tone === "warn") {
    return <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" focusable="false" />;
  }

  if (text.includes("복구")) {
    return <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" focusable="false" />;
  }

  return <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" focusable="false" />;
}

export function ChatStatusRail({
  banner,
  isTerminal,
}: {
  banner: ChatStatusBanner | null;
  isTerminal: boolean;
}) {
  if (!banner) return null;
  const bannerText = normalizeStatusText(banner.text, "상태 업데이트");
  const liveMode = banner.tone === "error" ? "assertive" : "polite";

  return (
    <div
      className={cn(
        "shrink-0 border-b px-4 py-2",
        isTerminal
          ? "border-border bg-[hsl(var(--terminal-titlebar))]"
          : "border-border/60 bg-muted/20",
      )}
    >
      <div
        aria-atomic="true"
        aria-label={bannerText}
        aria-live={liveMode}
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed",
          getBannerToneClass(banner.tone, isTerminal),
        )}
        role={banner.tone === "error" ? "alert" : "status"}
      >
        <BannerIcon tone={banner.tone} text={bannerText} />
        <span>{bannerText}</span>
      </div>
    </div>
  );
}
