import { Compass, FlaskConical, MessageSquareQuote, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LensCard as LensCardData } from "@/services/chat";

type LensCardProps = {
  card: LensCardData;
  stacked?: boolean;
  depth?: number;
  active?: boolean;
  onOpenEvidence?: () => void;
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
      "border-amber-300/70 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.2),_transparent_45%),linear-gradient(135deg,rgba(255,251,235,0.92),rgba(255,247,237,0.88))]",
    badge: "bg-amber-500 text-white",
  },
  debater: {
    label: "Debater",
    icon: Scale,
    shell:
      "border-rose-300/70 bg-[radial-gradient(circle_at_top_left,_rgba(244,63,94,0.18),_transparent_45%),linear-gradient(135deg,rgba(255,241,242,0.94),rgba(255,245,245,0.88))]",
    badge: "bg-rose-500 text-white",
  },
  explorer: {
    label: "Explorer",
    icon: Compass,
    shell:
      "border-sky-300/70 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_45%),linear-gradient(135deg,rgba(240,249,255,0.94),rgba(236,253,255,0.88))]",
    badge: "bg-sky-500 text-white",
  },
  analyst: {
    label: "Analyst",
    icon: FlaskConical,
    shell:
      "border-emerald-300/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(135deg,rgba(236,253,245,0.94),rgba(240,253,250,0.88))]",
    badge: "bg-emerald-500 text-white",
  },
};

export default function LensCard({
  card,
  stacked = false,
  depth = 0,
  active = false,
  onOpenEvidence,
  onPointerDown,
  onPointerUp,
}: LensCardProps) {
  const persona = PERSONA_STYLES[card.personaId];
  const PersonaIcon = persona.icon;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className={cn(
        "relative flex h-[24rem] flex-col overflow-hidden rounded-[2rem] border px-5 py-5 shadow-[0_22px_50px_rgba(15,23,42,0.12)] transition-all duration-300 select-none",
        persona.shell,
        stacked && "absolute inset-0 pointer-events-none",
        stacked && depth === 1 && "translate-y-3 scale-[0.97] opacity-70",
        stacked && depth === 2 && "translate-y-6 scale-[0.94] opacity-45",
        active && "ring-1 ring-white/50",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
              persona.badge,
            )}
          >
            <PersonaIcon className="h-3.5 w-3.5" />
            {persona.label}
          </span>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {card.angleKey}
            </p>
            <h3 className="max-w-[16rem] text-[1.45rem] font-semibold leading-tight text-slate-900">
              {card.title}
            </h3>
          </div>
        </div>
        <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
          {card.tags[0] || "lens"}
        </div>
      </div>

      <div className="mt-5 rounded-[1.5rem] border border-white/70 bg-white/70 px-4 py-4 shadow-sm backdrop-blur">
        <p className="text-sm leading-6 text-slate-700">{card.summary}</p>
      </div>

      <ul className="mt-5 space-y-3">
        {card.bullets.slice(0, 4).map((bullet, index) => (
          <li key={`${card.id}-${index}`} className="flex items-start gap-3">
            <span className="mt-2 h-2 w-2 rounded-full bg-slate-700/70" />
            <span className="text-sm leading-6 text-slate-800">{bullet}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="flex flex-wrap gap-2">
          {card.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-slate-300/70 bg-white/70 px-3 py-1 text-[11px] font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
        {active && onOpenEvidence && (
          <button
            type="button"
            onClick={onOpenEvidence}
            className="rounded-full border border-slate-300/80 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-white"
          >
            상세 근거 보기
          </button>
        )}
      </div>
    </div>
  );
}
