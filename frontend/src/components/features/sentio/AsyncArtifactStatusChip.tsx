import { cn } from "@/lib/utils";
import type { AsyncArtifactStatus } from "./hooks/useAsyncArtifact";

type AsyncArtifactStatusChipProps = {
  status: AsyncArtifactStatus;
  labels?: Partial<Record<AsyncArtifactStatus, string>>;
  className?: string;
};

const DEFAULT_LABELS: Record<AsyncArtifactStatus, string> = {
  idle: "",
  warming: "Generating",
  ready: "Ready",
  "fallback-hard": "Fallback",
  error: "Error",
};

const STATUS_CLASSES: Record<AsyncArtifactStatus, string> = {
  idle: "",
  warming: "bg-sky-100 text-sky-700",
  ready: "bg-emerald-100 text-emerald-700",
  "fallback-hard": "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
};
const ALLOWED_STATUSES = new Set<AsyncArtifactStatus>([
  "idle",
  "warming",
  "ready",
  "fallback-hard",
  "error",
]);
const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeStatus(value: unknown): AsyncArtifactStatus | null {
  return typeof value === "string" && ALLOWED_STATUSES.has(value as AsyncArtifactStatus)
    ? (value as AsyncArtifactStatus)
    : null;
}

export function normalizeStatusLabel(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(ANSI_ESCAPE_PATTERN, "")
    .replace(CONTROL_TEXT_PATTERN, " ")
    .replace(COLLAPSED_WHITESPACE_PATTERN, " ")
    .trim();
}

export function AsyncArtifactStatusChip({
  status,
  labels,
  className,
}: AsyncArtifactStatusChipProps) {
  const safeStatus = normalizeStatus(status);
  if (!safeStatus || safeStatus === "idle" || safeStatus === "ready") {
    return null;
  }

  const label = normalizeStatusLabel(labels?.[safeStatus] ?? DEFAULT_LABELS[safeStatus]);
  if (!label) {
    return null;
  }

  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        STATUS_CLASSES[safeStatus],
        className,
      )}
    >
      {label}
    </span>
  );
}

export default AsyncArtifactStatusChip;
