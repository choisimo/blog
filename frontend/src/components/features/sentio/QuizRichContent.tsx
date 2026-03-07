import { useEffect, useMemo, useRef, useState } from "react";
import ChatMarkdown from "@/components/features/chat/ChatMarkdown";
import { cn } from "@/lib/utils";

type QuizVisualizationSpec = {
  html: string;
  js?: string;
  css?: string;
  title?: string;
  minHeight?: number;
};

type QuizRichSegment =
  | { type: "markdown"; text: string }
  | { type: "viz"; spec: QuizVisualizationSpec }
  | { type: "viz_error"; message: string; raw: string };

type QuizRichContentProps = {
  content: string;
  isTerminal?: boolean;
  className?: string;
};

const VIZ_FENCE_LANGS = new Set([
  "viz",
  "visualization",
  "graph",
  "chart",
  "html",
  "htm",
  "html+js",
  "htmljs",
]);

function toText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function tryExtractObjectJson(text: string): Record<string, unknown> | null {
  const direct = tryParseJson(text);
  if (direct) return direct;

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return tryParseJson(text.slice(start, end + 1));
  }
  return null;
}

function normalizeChartData(
  input: Record<string, unknown>,
): { labels: string[]; values: number[]; type: "bar" | "line" } | null {
  const rows = Array.isArray(input.data) ? input.data : null;
  if (!rows) return null;

  const labels: string[] = [];
  const values: number[] = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const label = toText(rec.label ?? rec.name ?? rec.x ?? rec.category);
    const num = Number(rec.value ?? rec.y ?? rec.count ?? rec.score);
    if (!label || !Number.isFinite(num)) continue;
    labels.push(label);
    values.push(num);
  }

  if (labels.length === 0) return null;
  const rawType = toText(input.type).toLowerCase();
  const type = rawType === "line" ? "line" : "bar";

  return { labels, values, type };
}

function buildCanvasChartSpec(
  input: Record<string, unknown>,
): QuizVisualizationSpec | null {
  const chart = normalizeChartData(input);
  if (!chart) return null;

  const payload = JSON.stringify(chart);
  const title = toText(input.title) || "Generated Graph";
  const minHeight = clampNumber(input.height, 180, 560, 260);

  const html = `
<div class="quiz-chart-wrap">
  <canvas id="quiz-viz-canvas"></canvas>
</div>
`.trim();

  const js = `
(function () {
  const cfg = ${payload};
  const canvas = document.getElementById("quiz-viz-canvas");
  if (!canvas) throw new Error("Canvas element not found");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context not available");

  const wrap = canvas.parentElement || document.body;
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(420, Math.floor((wrap.clientWidth || 640) - 8));
  const height = 280;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  const labels = cfg.labels || [];
  const values = cfg.values || [];
  const maxValue = Math.max(...values, 1);
  const left = 46;
  const bottom = height - 34;
  const chartW = width - left - 16;
  const chartH = bottom - 20;

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, 20);
  ctx.lineTo(left, bottom);
  ctx.lineTo(width - 16, bottom);
  ctx.stroke();

  if (cfg.type === "line") {
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < values.length; i += 1) {
      const x = left + (chartW * i) / Math.max(1, values.length - 1);
      const y = bottom - (values[i] / maxValue) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#2563eb";
    for (let i = 0; i < values.length; i += 1) {
      const x = left + (chartW * i) / Math.max(1, values.length - 1);
      const y = bottom - (values[i] / maxValue) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    const barWidth = chartW / Math.max(values.length, 1) * 0.62;
    const gap = chartW / Math.max(values.length, 1) * 0.38;
    for (let i = 0; i < values.length; i += 1) {
      const x = left + i * (barWidth + gap) + gap * 0.5;
      const h = (values[i] / maxValue) * chartH;
      const y = bottom - h;
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(x, y, barWidth, h);
    }
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  for (let i = 0; i < labels.length; i += 1) {
    const x = cfg.type === "line"
      ? left + (chartW * i) / Math.max(1, labels.length - 1)
      : left + i * (chartW / Math.max(labels.length, 1)) + chartW / Math.max(labels.length, 1) / 2;
    ctx.textAlign = "center";
    ctx.fillText(String(labels[i]).slice(0, 10), x, bottom + 14);
  }
})();
`.trim();

  return {
    title,
    html,
    js,
    minHeight,
    css: `
.quiz-chart-wrap {
  width: 100%;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}
canvas {
  display: block;
  max-width: 100%;
  border-radius: 10px;
}
`.trim(),
  };
}

function parseVisualizationFence(
  langRaw: string,
  body: string,
): { spec?: QuizVisualizationSpec; error?: string } {
  const lang = langRaw.trim().toLowerCase();
  const trimmed = body.trim();

  if (!trimmed) {
    return { error: "Visualization block is empty." };
  }

  if (
    lang === "html" ||
    lang === "htm" ||
    lang === "html+js" ||
    lang === "htmljs"
  ) {
    return {
      spec: {
        html: trimmed,
        minHeight: 240,
      },
    };
  }

  const parsed = tryExtractObjectJson(trimmed);
  if (!parsed) {
    return { error: "Visualization JSON parsing failed." };
  }

  const chartSpec = buildCanvasChartSpec(parsed);
  if (chartSpec) {
    return { spec: chartSpec };
  }

  const html = toText(parsed.html ?? parsed.markup ?? parsed.template);
  const js = toText(parsed.js ?? parsed.javascript ?? parsed.script);
  const css = toText(parsed.css ?? parsed.style ?? parsed.styles);
  const title = toText(parsed.title);
  const minHeight = clampNumber(
    parsed.height ?? parsed.minHeight,
    160,
    560,
    240,
  );

  if (!html && !js) {
    return {
      error: "Visualization data must include `html`/`js` or chart `data`.",
    };
  }

  return {
    spec: {
      html: html || "<div id='quiz-viz-root'></div>",
      js: js || undefined,
      css: css || undefined,
      title: title || undefined,
      minHeight,
    },
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function parseQuizRichContent(content: string): QuizRichSegment[] {
  const input = typeof content === "string" ? content : "";
  if (!input.trim()) return [{ type: "markdown", text: "" }];

  const segments: QuizRichSegment[] = [];
  let cursor = 0;
  const fenceRe = /```([^\n`]*)\n([\s\S]*?)```/g;

  const pushMarkdown = (text: string) => {
    if (!text) return;
    const prev = segments[segments.length - 1];
    if (prev?.type === "markdown") {
      prev.text += text;
      return;
    }
    segments.push({ type: "markdown", text });
  };

  while (true) {
    const match = fenceRe.exec(input);
    if (!match) break;

    const [full, langRaw, bodyRaw] = match;
    const start = match.index;

    pushMarkdown(input.slice(cursor, start));
    cursor = start + full.length;

    const lang = langRaw.trim().toLowerCase();
    if (!VIZ_FENCE_LANGS.has(lang)) {
      pushMarkdown(full);
      continue;
    }

    try {
      const parsed = parseVisualizationFence(lang, bodyRaw);
      if (parsed.spec) {
        segments.push({ type: "viz", spec: parsed.spec });
      } else {
        segments.push({
          type: "viz_error",
          message: parsed.error || "Visualization block parsing failed.",
          raw: full,
        });
      }
    } catch (err) {
      segments.push({
        type: "viz_error",
        message:
          err instanceof Error
            ? err.message
            : "Unexpected visualization parsing error.",
        raw: full,
      });
    }
  }

  pushMarkdown(input.slice(cursor));

  if (segments.length === 0) return [{ type: "markdown", text: input }];
  return segments;
}

function buildVizSrcDoc(spec: QuizVisualizationSpec, frameId: string): string {
  const safeCss = (spec.css || "").replace(/<\/style/gi, "<\\/style");
  const safeJs = (spec.js || "").replace(/<\/script/gi, "<\\/script");
  const minHeight = clampNumber(spec.minHeight, 160, 560, 240);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root { color-scheme: light; }
    html, body {
      margin: 0;
      padding: 0;
      min-height: ${minHeight}px;
      background: #ffffff;
      color: #0f172a;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      overflow-x: hidden;
    }
    #quiz-viz-root {
      width: 100%;
      min-height: ${minHeight}px;
      box-sizing: border-box;
      padding: 8px;
    }
    ${safeCss}
  </style>
</head>
<body>
  <div id="quiz-viz-root">${spec.html || ""}</div>
  <script>
    (() => {
      const FRAME_ID = ${JSON.stringify(frameId)};
      const post = (type, payload = {}) => {
        try {
          parent.postMessage({ __quizViz: true, frameId: FRAME_ID, type, ...payload }, "*");
        } catch {}
      };

      const notifyHeight = () => {
        try {
          const h = Math.max(
            ${minHeight},
            document.documentElement.scrollHeight || 0,
            document.body.scrollHeight || 0
          );
          post("height", { value: h });
        } catch {}
      };

      window.addEventListener("error", (event) => {
        post("error", { message: event?.message || "Visualization runtime error." });
      });
      window.addEventListener("unhandledrejection", (event) => {
        const reason = event?.reason;
        const msg = reason?.message || String(reason || "Unhandled rejection");
        post("error", { message: msg });
      });

      const ready = () => {
        post("ready");
        notifyHeight();
      };

      if (typeof ResizeObserver === "function") {
        try {
          const ro = new ResizeObserver(() => notifyHeight());
          ro.observe(document.body);
        } catch {}
      }

      window.addEventListener("load", ready);
      setTimeout(ready, 32);
      setTimeout(notifyHeight, 200);

      try {
        ${safeJs}
      } catch (err) {
        const msg = err?.message || String(err || "Visualization script error");
        post("error", { message: msg });
      }
    })();
  </script>
</body>
</html>`;
}

function VisualizationFrame({
  spec,
  isTerminal,
}: {
  spec: QuizVisualizationSpec;
  isTerminal: boolean;
}) {
  const frameIdRef = useRef(
    `quiz-viz-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const frameId = frameIdRef.current;
  const initialHeight = clampNumber(spec.minHeight, 160, 560, 240);
  const [frameHeight, setFrameHeight] = useState<number>(initialHeight);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const srcDoc = useMemo(() => buildVizSrcDoc(spec, frameId), [spec, frameId]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (typeof data.__quizViz === 'undefined' || data.__quizViz !== true) return;
      if (data.frameId !== frameId) return;

      const type = data.type;
      if (type === "ready") {
        setReady(true);
        return;
      }
      if (type === "height") {
        const next = clampNumber(data.value as number, 160, 1200, initialHeight);
        setFrameHeight(next);
        return;
      }
      if (type === "error") {
        const msg =
          toText(data.message as string) || "Visualization runtime error.";
        setError(msg);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [frameId, initialHeight]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border",
        isTerminal
          ? "border-primary/20 bg-[hsl(var(--terminal-code-bg))]"
          : "border-border/60 bg-background",
      )}
    >
      {spec.title && (
        <div
          className={cn(
            "border-b px-3 py-1.5 text-xs font-medium",
            isTerminal
              ? "border-primary/20 text-primary/80"
              : "border-border/50 text-muted-foreground",
          )}
        >
          {spec.title}
        </div>
      )}
      <div className="relative">
        {!ready && (
          <div
            className={cn(
              "pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-xs",
              isTerminal
                ? "text-primary/70 bg-background/50"
                : "text-muted-foreground bg-background/55",
            )}
          >
            시각화 렌더링 중...
          </div>
        )}
        <iframe
          title={spec.title || "quiz-visualization"}
          srcDoc={srcDoc}
          sandbox="allow-scripts"
          loading="lazy"
          className="w-full border-0"
          style={{
            minHeight: `${initialHeight}px`,
            height: `${frameHeight}px`,
          }}
        />
      </div>
      {error && (
        <div
          className={cn(
            "border-t px-3 py-2 text-xs",
            isTerminal
              ? "border-red-500/30 bg-red-500/10 text-red-300"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          렌더링 오류: {error}
        </div>
      )}
    </div>
  );
}

export default function QuizRichContent({
  content,
  isTerminal = false,
  className,
}: QuizRichContentProps) {
  const segments = useMemo(() => parseQuizRichContent(content), [content]);

  return (
    <div className={cn("space-y-3", className)}>
      {segments.map((segment, index) => {
        if (segment.type === "markdown") {
          return (
            <div
              key={`md-${index}`}
              className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
            >
              <ChatMarkdown content={segment.text} />
            </div>
          );
        }

        if (segment.type === "viz_error") {
          return (
            <div
              key={`viz-err-${index}`}
              className={cn(
                "space-y-2 rounded-xl border px-3 py-2 text-xs",
                isTerminal
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  : "border-amber-200 bg-amber-50 text-amber-700",
              )}
            >
              <p>{segment.message}</p>
              <pre
                className={cn(
                  "max-h-56 overflow-auto whitespace-pre-wrap rounded-lg px-2 py-1.5",
                  isTerminal
                    ? "bg-background/50 text-amber-100"
                    : "bg-background text-foreground",
                )}
              >
                {segment.raw}
              </pre>
            </div>
          );
        }

        return (
          <VisualizationFrame
            key={`viz-${index}`}
            spec={segment.spec}
            isTerminal={isTerminal}
          />
        );
      })}
    </div>
  );
}
