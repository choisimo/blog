import { cn } from "@/lib/utils";
import type { ThoughtCard as ThoughtCardData } from "@/services/chat";

type ThoughtCardProps = {
  card: ThoughtCardData;
  index: number;
};

export default function ThoughtCard({ card, index }: ThoughtCardProps) {
  const topicLabel = card.trackKey.replace(/[-_]+/g, " ");

  return (
    <article className="rounded-[1.75rem] border border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_42%),linear-gradient(180deg,rgba(236,253,245,0.92),rgba(255,255,255,0.96))] px-5 py-5 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
          Thought {index + 1}
        </p>
        <span className="inline-flex max-w-[14rem] truncate rounded-full border border-emerald-200/80 bg-emerald-100/80 px-3 py-1 text-[11px] font-medium text-emerald-800">
          {topicLabel}
        </span>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold leading-tight text-slate-900">
            {card.title}
          </h3>
          {card.subtitle && (
            <p className="text-sm leading-6 text-slate-600">{card.subtitle}</p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-white/70 bg-white/75 px-4 py-4">
        <p className="text-sm leading-7 text-slate-700">{card.body}</p>
      </div>

      {card.bullets && card.bullets.length > 0 && (
        <ul className="mt-5 space-y-3">
          {card.bullets.slice(0, 5).map((bullet, bulletIndex) => (
            <li
              key={`${card.id}-${bulletIndex}`}
              className="flex items-start gap-3"
            >
              <span className="mt-2 h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-sm leading-6 text-slate-800">{bullet}</span>
            </li>
          ))}
        </ul>
      )}

      {card.tags && card.tags.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {card.tags.map((tag) => (
            <span
              key={tag}
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
