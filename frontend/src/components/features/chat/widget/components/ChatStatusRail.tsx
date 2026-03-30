import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatStatusBanner } from "../types";

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
    return <WifiOff className="h-4 w-4 shrink-0" />;
  }

  if (tone === "warn") {
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin" />;
  }

  if (text.includes("복구")) {
    return <CheckCircle2 className="h-4 w-4 shrink-0" />;
  }

  return <AlertCircle className="h-4 w-4 shrink-0" />;
}

export function ChatStatusRail({
  banner,
  isTerminal,
}: {
  banner: ChatStatusBanner | null;
  isTerminal: boolean;
}) {
  if (!banner) return null;

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
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed",
          getBannerToneClass(banner.tone, isTerminal),
        )}
      >
        <BannerIcon tone={banner.tone} text={banner.text} />
        <span>{banner.text}</span>
      </div>
    </div>
  );
}
