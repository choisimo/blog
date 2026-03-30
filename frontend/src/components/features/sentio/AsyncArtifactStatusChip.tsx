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

export function AsyncArtifactStatusChip({
  status,
  labels,
  className,
}: AsyncArtifactStatusChipProps) {
  if (status === "idle" || status === "ready") {
    return null;
  }

  const label = labels?.[status] ?? DEFAULT_LABELS[status];
  if (!label) {
    return null;
  }

  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
        STATUS_CLASSES[status],
        className,
      )}
    >
      {label}
    </span>
  );
}

export default AsyncArtifactStatusChip;
