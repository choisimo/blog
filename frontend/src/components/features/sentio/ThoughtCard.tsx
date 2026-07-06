import { cn } from "@/lib/utils";
import type { ThoughtCard as ThoughtCardData } from "@/services/chat";

type ThoughtCardProps = {
  card: ThoughtCardData;
  index: number;
};

const CONTROL_TEXT_PATTERN = /[\u0000-\u001F\u007F]+/g;
const COLLAPSED_WHITESPACE_PATTERN = /\s+/g;

function normalizeDisplayText(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  const normalized = value
    .replace(CONTROL_TEXT_PATTERN, " ")
    .replace(COLLAPSED_WHITESPACE_PATTERN, " ")
    .trim();
  return normalized || fallback;
}

function normalizeKey(value: unknown, fallback: string): string {
  const normalized = normalizeDisplayText(value)
    .replace(/[|/\\\s]+/g, "-")
    .replace(/[^A-Za-z0-9:_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
  return normalized || fallback;
}

function normalizeTextList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeDisplayText(item))
    .filter(Boolean)
    .slice(0, limit);
}

export default function ThoughtCard({ card, index }: ThoughtCardProps) {
  const safeIndex = Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0;
  const cardId = normalizeKey(card.id, `thought-${safeIndex + 1}`);
  const topicLabel = normalizeDisplayText(card.trackKey, cardId).replace(/[-_]+/g, " ");
  const title = normalizeDisplayText(card.title, `Thought ${safeIndex + 1}`);
  const subtitle = normalizeDisplayText(card.subtitle);
  const body = normalizeDisplayText(card.body, title);
  const bullets = normalizeTextList(card.bullets, 5);
  const tags = normalizeTextList(card.tags, 8);

  return (
    <article className="rounded-[1.75rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_42%),linear-gradient(180deg,rgba(236,253,245,0.92),rgba(255,255,255,0.96))] px-5 py-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          Thought {safeIndex + 1}
        </p>
        <span className="inline-flex max-w-[14rem] truncate rounded-full border border-emerald-200/80 bg-emerald-100/80 px-3 py-1 text-[11px] font-medium text-emerald-800">
          {topicLabel}
        </span>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold leading-tight text-slate-900">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm leading-6 text-slate-600">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/75 px-4 py-4">
        <p className="text-sm leading-7 text-slate-700">{body}</p>
      </div>

      {bullets.length > 0 && (
        <ul className="mt-5 space-y-3">
          {bullets.map((bullet, bulletIndex) => (
            <li
              key={`${cardId}-${bulletIndex}`}
              className="flex items-start gap-3"
            >
              <span className="mt-2 h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm leading-6 text-slate-800">{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {tags.map((tag, tagIndex) => (
            <span
              key={`${tag}-${tagIndex}`}
              className={cn(
                "rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-600",
              )}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
