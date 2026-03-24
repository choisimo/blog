import { Compass, FlaskConical, MessageSquareQuote, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LensCard as LensCardData } from "@/services/chat";

type LensCardProps = {
  card: LensCardData;
  stacked?: boolean;
  depth?: number;
  active?: boolean;
  showEvidence?: boolean;
  onToggleEvidence?: () => void;
  onPointerMove?: React.PointerEventHandler<HTMLDivElement>;
  onPointerDown?: React.PointerEventHandler<HTMLDivElement>;
  onPointerUp?: React.PointerEventHandler<HTMLDivElement>;
};

const PERSONA_STYLES: Record<
  LensCardData["personaId"],
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    shell: string;
    badge: string;
  }
> = {
  mentor: {
    label: "Mentor",
    icon: MessageSquareQuote,
    shell:
      "border-amber-300/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.14),_transparent_42%),linear-gradient(135deg,rgba(255,251,235,0.985),rgba(255,247,237,0.97))]",
    badge: "bg-amber-500 text-white",
  },
  debater: {
    label: "Debater",
    icon: Scale,
    shell:
      "border-rose-300/80 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.14),_transparent_42%),linear-gradient(135deg,rgba(255,241,242,0.985),rgba(255,245,245,0.97))]",
    badge: "bg-rose-500 text-white",
  },
  explorer: {
    label: "Explorer",
    icon: Compass,
    shell:
      "border-sky-300/80 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.14),_transparent_42%),linear-gradient(135deg,rgba(240,249,255,0.985),rgba(236,253,255,0.97))]",
    badge: "bg-sky-500 text-white",
  },
  analyst: {
    label: "Analyst",
    icon: FlaskConical,
    shell:
      "border-emerald-300/80 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_42%),linear-gradient(135deg,rgba(236,253,245,0.985),rgba(240,253,250,0.97))]",
    badge: "bg-emerald-500 text-white",
  },
};

export default function LensCard({
  card,
  stacked = false,
  depth = 0,
  active = false,
  showEvidence = false,
  onToggleEvidence,
  onPointerMove,
  onPointerDown,
  onPointerUp,
}: LensCardProps) {
  const persona = PERSONA_STYLES[card.personaId];
  const PersonaIcon = persona.icon;
  const interactionHint = showEvidence
    ? "클릭해 요점 보기"
    : "클릭해 근거 보기";

  return (
    <div
      role={active && onToggleEvidence ? "button" : undefined}
      tabIndex={active && onToggleEvidence ? 0 : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={active ? onToggleEvidence : undefined}
      onKeyDown={
        active && onToggleEvidence
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onToggleEvidence();
              }
            }
          : undefined
      }
      aria-label={active ? interactionHint : undefined}
      className={cn(
        "relative h-[24rem] select-none [perspective:1800px]",
        active && onToggleEvidence && "cursor-pointer focus:outline-none",
        stacked && "absolute inset-0 pointer-events-none",
        stacked && depth === 1 && "translate-y-3 scale-[0.97] opacity-70",
        stacked && depth === 2 && "translate-y-6 scale-[0.94] opacity-45",
      )}
    >
      <div
        className={cn(
          "relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d]",
          active && showEvidence && "[transform:rotateY(180deg)]",
        )}
      >
        <div
          className={cn(
            "absolute inset-0 flex h-full flex-col overflow-hidden rounded-[2rem] border px-4 py-4 shadow-[0_22px_50px_rgba(15,23,42,0.12)] [backface-visibility:hidden]",
            persona.shell,
            active &&
              "ring-1 ring-white/60 focus-visible:ring-2 focus-visible:ring-white/75",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                    persona.badge,
                  )}
                >
                  <PersonaIcon className="h-3.5 w-3.5" />
                  {persona.label}
                </span>
                <span className="rounded-full border border-slate-300/80 bg-white/88 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-600">
                  {card.angleKey}
                </span>
                {active && onToggleEvidence && (
                  <span className="rounded-full border border-slate-300/70 bg-white/75 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                    {interactionHint}
                  </span>
                )}
              </div>
              <h3 className="line-clamp-2 max-w-full break-words text-[1.25rem] font-semibold leading-tight text-slate-900">
                {card.title}
              </h3>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <div className="rounded-[1.35rem] border border-white/90 bg-white/92 px-3.5 py-3.5 shadow-sm">
              <p className="break-words text-sm leading-6 text-slate-700">
                {card.summary}
              </p>
            </div>

            {card.bullets.length > 0 && (
              <ul className="space-y-2.5">
                {card.bullets.slice(0, 4).map((bullet, index) => (
                  <li
                    key={`${card.id}-${index}`}
                    className="flex items-start gap-2.5"
                  >
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-700/70" />
                    <span className="break-words text-sm leading-6 text-slate-800">
                      {bullet}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-1">
                {card.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-300/80 bg-white/90 px-3 py-1 text-[11px] font-medium text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className={cn(
            "absolute inset-0 flex h-full flex-col overflow-hidden rounded-[2rem] border px-4 py-4 shadow-[0_22px_50px_rgba(15,23,42,0.12)] [backface-visibility:hidden] [transform:rotateY(180deg)]",
            persona.shell,
            active &&
              "ring-1 ring-white/60 focus-visible:ring-2 focus-visible:ring-white/75",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                    persona.badge,
                  )}
                >
                  <PersonaIcon className="h-3.5 w-3.5" />
                  {persona.label}
                </span>
                <span className="rounded-full border border-slate-300/80 bg-white/92 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">
                  Evidence
                </span>
                {active && onToggleEvidence && (
                  <span className="rounded-full border border-slate-300/70 bg-white/75 px-2.5 py-1 text-[10px] font-medium text-slate-500">
                    {interactionHint}
                  </span>
                )}
              </div>
              <h3 className="line-clamp-2 break-words text-[1.2rem] font-semibold leading-tight text-slate-900">
                {card.title}
              </h3>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {card.detail && (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Detail
                </p>
                <div className="rounded-[1.35rem] border border-white/90 bg-white/94 px-3.5 py-3.5 text-sm leading-6 text-slate-700 shadow-sm whitespace-pre-wrap">
                  {card.detail}
                </div>
              </section>
            )}

            {card.bullets.length > 0 && (
              <section className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Evidence Notes
                </p>
                <div className="space-y-2">
                  {card.bullets.map((bullet, index) => (
                    <div
                      key={`${card.id}-evidence-${index}`}
                      className="rounded-[1.15rem] border border-white/80 bg-white/90 px-3.5 py-3 text-sm leading-6 text-slate-800 shadow-sm"
                    >
                      {bullet}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {card.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-1">
                {card.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-300/80 bg-white/92 px-3 py-1 text-[11px] font-medium text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
