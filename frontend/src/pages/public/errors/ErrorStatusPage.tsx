import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpenText, Home, LifeBuoy } from "lucide-react";
import type { ButtonProps } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { site } from "@/config/site";
import { cn } from "@/lib/utils";

type Tone = "amber" | "sky" | "rose" | "violet" | "emerald" | "slate";

export interface ErrorStatusAction {
  label: string;
  icon?: LucideIcon;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: ButtonProps["variant"];
}

export interface ErrorStatusPageProps {
  statusCode: number | string;
  label: string;
  title: string;
  description: string;
  hints: string[];
  icon: LucideIcon;
  tone?: Tone;
  actions?: ErrorStatusAction[];
  footer?: ReactNode;
}

const toneStyles: Record<
  Tone,
  {
    badge: string;
    chip: string;
    code: string;
    glow: string;
    bullet: string;
  }
> = {
  amber: {
    badge:
      "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    chip: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300",
    code: "from-amber-500 via-orange-500 to-red-500",
    glow: "from-amber-500/20 via-orange-500/10 to-transparent",
    bullet: "bg-amber-500",
  },
  sky: {
    badge: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    chip: "border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-300",
    code: "from-sky-500 via-cyan-500 to-blue-500",
    glow: "from-sky-500/20 via-cyan-500/10 to-transparent",
    bullet: "bg-sky-500",
  },
  rose: {
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    chip: "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-300",
    code: "from-rose-500 via-red-500 to-orange-500",
    glow: "from-rose-500/20 via-red-500/10 to-transparent",
    bullet: "bg-rose-500",
  },
  violet: {
    badge:
      "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300",
    chip: "border-violet-500/25 bg-violet-500/10 text-violet-600 dark:text-violet-300",
    code: "from-violet-500 via-fuchsia-500 to-pink-500",
    glow: "from-violet-500/20 via-fuchsia-500/10 to-transparent",
    bullet: "bg-violet-500",
  },
  emerald: {
    badge:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
    code: "from-emerald-500 via-teal-500 to-cyan-500",
    glow: "from-emerald-500/20 via-teal-500/10 to-transparent",
    bullet: "bg-emerald-500",
  },
  slate: {
    badge:
      "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:text-slate-300",
    chip: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
    code: "from-slate-500 via-zinc-500 to-stone-500",
    glow: "from-slate-500/20 via-zinc-500/10 to-transparent",
    bullet: "bg-slate-500",
  },
};

function ErrorActionButton({ action }: { action: ErrorStatusAction }) {
  const Icon = action.icon ?? ArrowRight;
  const variant = action.variant ?? "default";

  if (action.to) {
    return (
      <Button asChild size="lg" variant={variant}>
        <Link to={action.to}>
          <Icon className="h-4 w-4" />
          {action.label}
        </Link>
      </Button>
    );
  }

  if (action.href) {
    const external =
      action.href.startsWith("http://") ||
      action.href.startsWith("https://") ||
      action.href.startsWith("mailto:");

    return (
      <Button asChild size="lg" variant={variant}>
        <a
          href={action.href}
          rel={external ? "noreferrer" : undefined}
          target={
            external && !action.href.startsWith("mailto:")
              ? "_blank"
              : undefined
          }
        >
          <Icon className="h-4 w-4" />
          {action.label}
        </a>
      </Button>
    );
  }

  return (
    <Button size="lg" variant={variant} onClick={action.onClick}>
      <Icon className="h-4 w-4" />
      {action.label}
    </Button>
  );
}

export default function ErrorStatusPage({
  statusCode,
  label,
  title,
  description,
  hints,
  icon: Icon,
  tone = "amber",
  actions = [],
  footer,
}: ErrorStatusPageProps) {
  const styles = toneStyles[tone];

  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const previousDescription = descriptionTag?.getAttribute("content") ?? null;

    document.title = `${statusCode} | nodove blog`;
    if (descriptionTag) {
      descriptionTag.setAttribute("content", description);
    }

    return () => {
      document.title = previousTitle;
      if (descriptionTag && previousDescription != null) {
        descriptionTag.setAttribute("content", previousDescription);
      }
    };
  }, [description, statusCode]);

  return (
    <div className="container relative mx-auto flex min-h-[calc(100vh-13rem)] max-w-6xl items-center px-4 py-12 sm:py-16">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-8 top-12 h-56 rounded-full bg-gradient-to-r blur-3xl",
          styles.glow,
        )}
      />

      <Card className="relative w-full overflow-hidden rounded-[28px] border-border/70 bg-background/95 shadow-2xl shadow-black/5">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 border-l border-border/40 bg-[linear-gradient(180deg,transparent,rgba(148,163,184,0.06),transparent)] lg:block" />
        <CardContent className="grid gap-10 p-6 pt-6 md:p-8 md:pt-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
          <section className="space-y-6">
            <Badge
              className={cn(
                "w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.24em]",
                styles.badge,
              )}
            >
              {label}
            </Badge>

            <div className="flex flex-wrap items-end gap-4">
              <div
                className={cn(
                  "bg-gradient-to-br bg-clip-text text-7xl font-black tracking-[-0.08em] text-transparent sm:text-8xl",
                  styles.code,
                )}
              >
                {statusCode}
              </div>
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl border backdrop-blur",
                  styles.chip,
                )}
              >
                <Icon className="h-7 w-7" />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                {description}
              </p>
            </div>

            {actions.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {actions.map((action, index) => (
                  <ErrorActionButton
                    key={`${action.label}-${index}`}
                    action={action}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="rounded-3xl border border-border/70 bg-muted/30 p-5 sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Next Steps
              </div>
              <ul className="mt-4 space-y-3">
                {hints.map((hint) => (
                  <li
                    key={hint}
                    className="flex items-start gap-3 text-sm text-muted-foreground"
                  >
                    <span
                      className={cn(
                        "mt-2 h-2 w-2 shrink-0 rounded-full",
                        styles.bullet,
                      )}
                    />
                    <span className="leading-6">{hint}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                to="/"
                className="group rounded-2xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-primary/30 hover:bg-accent/40"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/80">
                  <Home className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm font-semibold">홈으로</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  메인 페이지에서 다시 이동합니다.
                </p>
              </Link>

              <Link
                to="/blog"
                className="group rounded-2xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-primary/30 hover:bg-accent/40"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/80">
                  <BookOpenText className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm font-semibold">글 목록 보기</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  다른 글이나 공개 페이지로 이동합니다.
                </p>
              </Link>

              <a
                href={`mailto:${site.email}`}
                className="group rounded-2xl border border-border/70 bg-card/70 p-4 transition-colors hover:border-primary/30 hover:bg-accent/40"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-background/80">
                  <LifeBuoy className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm font-semibold">문의하기</div>
                <p className="mt-1 break-all text-sm text-muted-foreground">
                  {site.email}
                </p>
              </a>
            </div>

            {footer && (
              <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
                {footer}
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
