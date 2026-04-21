import ReactMarkdown from "react-markdown";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import {
  Children,
  Fragment,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import type { Element as HastElement, ElementContent } from "hast";
import { Button } from "@/components/ui/button";
import SparkInline from "@/components/molecules/SparkInline";
import { blogMarkdownSanitizeSchema } from "./markdownSanitizeSchema";
import {
  ClickableImage,
  EmbeddedVideo,
  NormalizedVideoSource,
} from "./ImageLightbox";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import {
  createHeadingSlug,
  normalizeHeadingText,
} from "@/utils/content/markdownHeadings";

// Language modules are loaded on-demand the first time a code block using
// that language is rendered. This keeps the initial markdown chunk small.
const LANGUAGE_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  bash: () => import("react-syntax-highlighter/dist/esm/languages/hljs/bash"),
  cpp: () => import("react-syntax-highlighter/dist/esm/languages/hljs/cpp"),
  css: () => import("react-syntax-highlighter/dist/esm/languages/hljs/css"),
  dockerfile: () =>
    import("react-syntax-highlighter/dist/esm/languages/hljs/dockerfile"),
  go: () => import("react-syntax-highlighter/dist/esm/languages/hljs/go"),
  java: () => import("react-syntax-highlighter/dist/esm/languages/hljs/java"),
  javascript: () =>
    import("react-syntax-highlighter/dist/esm/languages/hljs/javascript"),
  json: () => import("react-syntax-highlighter/dist/esm/languages/hljs/json"),
  kotlin: () =>
    import("react-syntax-highlighter/dist/esm/languages/hljs/kotlin"),
  markdown: () =>
    import("react-syntax-highlighter/dist/esm/languages/hljs/markdown"),
  plaintext: () =>
    import("react-syntax-highlighter/dist/esm/languages/hljs/plaintext"),
  python: () =>
    import("react-syntax-highlighter/dist/esm/languages/hljs/python"),
  rust: () => import("react-syntax-highlighter/dist/esm/languages/hljs/rust"),
  shell: () => import("react-syntax-highlighter/dist/esm/languages/hljs/shell"),
  sql: () => import("react-syntax-highlighter/dist/esm/languages/hljs/sql"),
  typescript: () =>
    import("react-syntax-highlighter/dist/esm/languages/hljs/typescript"),
  vim: () => import("react-syntax-highlighter/dist/esm/languages/hljs/vim"),
  yaml: () => import("react-syntax-highlighter/dist/esm/languages/hljs/yaml"),
};

// Aliases that map to the same loader key
const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  py: "python",
  sh: "shell",
  text: "plaintext",
  tsx: "typescript",
  ts: "typescript",
};

const registeredLanguages = new Set<string>();

async function ensureLanguageRegistered(lang: string): Promise<void> {
  const canonical = LANGUAGE_ALIASES[lang] ?? lang;
  if (registeredLanguages.has(canonical)) return;
  const loader = LANGUAGE_LOADERS[canonical];
  if (!loader) return;
  try {
    const mod = await loader();
    SyntaxHighlighter.registerLanguage(
      canonical,
      (mod as { default: unknown }).default,
    );
    registeredLanguages.add(canonical);
  } catch {
    // silently ignore — code block will still render without highlighting
  }
}

// Terminal-style syntax highlighting theme
const terminalTheme: { [key: string]: React.CSSProperties } = {
  ...atomOneDark,
  hljs: {
    ...atomOneDark["hljs"],
    color: "#c6f7d4",
    background: "hsl(200 50% 3%)",
    border: "1px solid hsl(200 30% 12%)",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  "hljs-comment": { color: "#4e5953", fontStyle: "italic" },
  "hljs-keyword": { color: "#3cff96" },
  "hljs-string": { color: "#3cb8ff" },
  "hljs-title": { color: "#3cff96" },
  "hljs-number": { color: "#ffb02e" },
  "hljs-operator": { color: "#3cff96" },
  "hljs-punctuation": { color: "#7f8f87" },
  "hljs-variable": { color: "#e4f4e8" },
  "hljs-class .hljs-title": { color: "#3cb8ff" },
  "hljs-literal": { color: "#ffb02e" },
  "hljs-built_in": { color: "#ffb02e" },
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
  inlineEnabled?: boolean;
  postTitle?: string;
  postPath?: string; // e.g., "2025/future-tech-six-insights" for resolving relative image paths
}

const IFRAME_AUTO_HEIGHT_MESSAGE_TYPE = "blog-iframe-auto-height";
const IFRAME_AUTO_HEIGHT_REQUEST_TYPE = "blog-iframe-request-height";
const IFRAME_AUTO_HEIGHT_SOURCE = "nodove-blog-embed";
const DEFAULT_EMBED_HEIGHT = 760;
const MIN_EMBED_HEIGHT = 320;
const MAX_EMBED_HEIGHT = 6000;

function clampEmbedHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EMBED_HEIGHT;
  return Math.max(
    MIN_EMBED_HEIGHT,
    Math.min(MAX_EMBED_HEIGHT, Math.round(value)),
  );
}

function parseEmbedHeight(
  value: React.ComponentProps<"iframe">["height"],
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampEmbedHeight(value);
  }
  if (typeof value !== "string") return null;
  const raw = value.trim();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(px)?$/i);
  if (!match) return null;
  return clampEmbedHeight(Number(match[1]));
}

function normalizeIframeSrc(
  src: string | undefined,
  postPath: string,
): string | undefined {
  if (!src) return undefined;
  const raw = src.trim();
  if (!raw) return undefined;

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("//") ||
    raw.startsWith("data:") ||
    raw.startsWith("blob:")
  ) {
    return raw;
  }

  if (raw.startsWith("/")) {
    return raw;
  }

  if (raw.startsWith("posts/")) {
    return `/${raw}`;
  }

  const year = postPath.split("/")[0] ?? "";
  const normalizedRelative = raw.replace(/^\.?\//, "");
  if (/^\d{4}$/.test(year)) {
    return `/posts/${year}/${normalizedRelative}`;
  }

  return `/${normalizedRelative}`;
}

function extractEmbedHeightMessage(data: unknown): number | null {
  if (!data || typeof data !== "object") return null;

  const payload = data as Record<string, unknown>;
  if (payload.type !== IFRAME_AUTO_HEIGHT_MESSAGE_TYPE) return null;

  const value = payload.height;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;

  return clampEmbedHeight(numeric);
}

interface EmbeddedIframeProps extends React.ComponentProps<"iframe"> {
  postPath: string;
  isTerminal: boolean;
}

function EmbeddedIframe({
  src,
  height,
  style,
  className,
  postPath,
  isTerminal,
  loading,
  title,
  onLoad,
  ...rest
}: EmbeddedIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const resolvedSrc = useMemo(
    () =>
      normalizeIframeSrc(typeof src === "string" ? src : undefined, postPath),
    [postPath, src],
  );

  const initialHeight = useMemo(
    () => parseEmbedHeight(height) ?? DEFAULT_EMBED_HEIGHT,
    [height],
  );
  const [frameHeight, setFrameHeight] = useState(initialHeight);

  useEffect(() => {
    setFrameHeight(initialHeight);
  }, [initialHeight, resolvedSrc]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;

      const nextHeight = extractEmbedHeightMessage(event.data);
      if (!nextHeight) return;

      setFrameHeight((prev) =>
        Math.abs(prev - nextHeight) < 2 ? prev : nextHeight,
      );
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!resolvedSrc) {
    return null;
  }

  return (
    <div className="my-8 max-w-5xl mx-auto">
      <iframe
        {...rest}
        ref={iframeRef}
        src={resolvedSrc}
        title={title ?? "Embedded content"}
        loading={loading ?? "lazy"}
        className={cn(
          "w-full rounded-2xl border border-border/50 bg-card shadow-sm",
          isTerminal &&
            "rounded border-primary/35 bg-[hsl(var(--terminal-code-bg))]",
          className,
        )}
        style={{
          border: "none",
          minHeight: `${MIN_EMBED_HEIGHT}px`,
          width: "100%",
          ...style,
          height: `${frameHeight}px`,
        }}
        onLoad={(event) => {
          const targetWindow = iframeRef.current?.contentWindow;
          if (targetWindow) {
            targetWindow.postMessage(
              {
                type: IFRAME_AUTO_HEIGHT_REQUEST_TYPE,
                source: IFRAME_AUTO_HEIGHT_SOURCE,
              },
              "*",
            );
          }
          onLoad?.(event);
        }}
      />
    </div>
  );
}

function extractTextFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractTextFromNode).join(" ");
  }

  if (!isValidElement(node)) {
    return "";
  }

  const props = (node as ReactElement<{ children?: ReactNode }>).props ?? {};
  return Children.toArray(props.children).map(extractTextFromNode).join(" ");
}

function extractRawTextFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractRawTextFromNode).join("");
  }

  if (!isValidElement(node)) {
    return "";
  }

  const props = (node as ReactElement<{ children?: ReactNode }>).props ?? {};
  return Children.toArray(props.children).map(extractRawTextFromNode).join("");
}

function extractTextFromHastNode(node: ElementContent | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value;
  if ("children" in node) {
    return node.children.map(extractTextFromHastNode).join("");
  }
  return "";
}

function normalizeClassNames(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .join(" ");
  }
  return "";
}

function extractCodeBlockDataFromPre(
  node: HastElement | undefined,
  fallbackChildren: ReactNode,
): { className?: string; codeString: string } | null {
  const codeNode = node?.children.find(
    (child): child is HastElement =>
      child.type === "element" && child.tagName === "code",
  );

  if (codeNode) {
    const codeString = codeNode.children
      .map(extractTextFromHastNode)
      .join("")
      .replace(/\n$/, "");

    if (codeString) {
      const className = normalizeClassNames(codeNode.properties?.className);
      return {
        className: className || undefined,
        codeString,
      };
    }
  }

  const codeElement = Children.toArray(fallbackChildren).find(
    (
      child,
    ): child is ReactElement<{ className?: string; children?: ReactNode }> =>
      isValidElement(child) && child.type === "code",
  );

  if (!codeElement) {
    return null;
  }

  const codeString = extractRawTextFromNode(codeElement.props.children).replace(
    /\n$/,
    "",
  );

  if (!codeString) {
    return null;
  }

  return {
    className: codeElement.props.className,
    codeString,
  };
}

const SHELL_SNIPPET_PATTERN =
  /(^#!\/bin\/(?:ba|z|k)?sh)|(^|\n)\s*(sudo\s+)?(apt|awk|cat|chmod|cp|curl|docker|git|grep|journalctl|kubectl|logger|mail|mv|npm|pvecm|rm|sed|ssh|systemctl|tail|tee|ufw)\b|(\|\s*grep\b)/m;

function normalizeCodeLanguage(rawLanguage: string): {
  syntaxLanguage?: string;
  displayLanguage: string;
} {
  const normalized = rawLanguage.trim().toLowerCase();
  const aliasMap: Record<
    string,
    { syntaxLanguage?: string; displayLanguage: string }
  > = {
    bash: { syntaxLanguage: "bash", displayLanguage: "bash" },
    cpp: { syntaxLanguage: "cpp", displayLanguage: "cpp" },
    dockerfile: { syntaxLanguage: "dockerfile", displayLanguage: "dockerfile" },
    go: { syntaxLanguage: "go", displayLanguage: "go" },
    java: { syntaxLanguage: "java", displayLanguage: "java" },
    javascript: { syntaxLanguage: "javascript", displayLanguage: "javascript" },
    js: { syntaxLanguage: "javascript", displayLanguage: "javascript" },
    json: { syntaxLanguage: "json", displayLanguage: "json" },
    jsx: { syntaxLanguage: "jsx", displayLanguage: "jsx" },
    kotlin: { syntaxLanguage: "kotlin", displayLanguage: "kotlin" },
    markdown: { syntaxLanguage: "markdown", displayLanguage: "markdown" },
    md: { syntaxLanguage: "markdown", displayLanguage: "markdown" },
    plaintext: { syntaxLanguage: "plaintext", displayLanguage: "text" },
    py: { syntaxLanguage: "python", displayLanguage: "python" },
    python: { syntaxLanguage: "python", displayLanguage: "python" },
    rust: { syntaxLanguage: "rust", displayLanguage: "rust" },
    sh: { syntaxLanguage: "shell", displayLanguage: "shell" },
    shell: { syntaxLanguage: "shell", displayLanguage: "shell" },
    sql: { syntaxLanguage: "sql", displayLanguage: "sql" },
    text: { syntaxLanguage: "plaintext", displayLanguage: "text" },
    ts: { syntaxLanguage: "typescript", displayLanguage: "typescript" },
    tsx: { syntaxLanguage: "tsx", displayLanguage: "tsx" },
    typescript: { syntaxLanguage: "typescript", displayLanguage: "typescript" },
    vim: { syntaxLanguage: "vim", displayLanguage: "vim" },
    yaml: { syntaxLanguage: "yaml", displayLanguage: "yaml" },
    yml: { syntaxLanguage: "yaml", displayLanguage: "yaml" },
  };

  return aliasMap[normalized] ?? { displayLanguage: normalized || "code" };
}

function inferCodeLanguage(codeString: string): {
  syntaxLanguage?: string;
  displayLanguage: string;
} {
  const trimmed = codeString.trim();

  if (!trimmed) {
    return { displayLanguage: "code" };
  }

  if (SHELL_SNIPPET_PATTERN.test(trimmed)) {
    return { syntaxLanguage: "shell", displayLanguage: "shell" };
  }

  return { displayLanguage: "code" };
}

const INLINE_SAFE_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "br",
  "cite",
  "code",
  "del",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "s",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
]);

function hasNonInlineNode(node: unknown): boolean {
  if (!isValidElement(node)) return false;

  const props =
    (node as ReactElement<{ children?: ReactNode; src?: string }>).props ?? {};
  if (node.type === Fragment) {
    return Children.toArray(props.children).some((child) =>
      hasNonInlineNode(child),
    );
  }

  if (
    node.type === CodeBlock ||
    node.type === ClickableImage ||
    node.type === EmbeddedVideo ||
    node.type === NormalizedVideoSource ||
    node.type === EmbeddedIframe
  ) {
    return true;
  }

  if (typeof props.src === "string" && props.src.length > 0) return true;

  if (typeof node.type === "string" && !INLINE_SAFE_TAGS.has(node.type)) {
    return true;
  }

  const children = Children.toArray(props.children);
  return children.some((child) => hasNonInlineNode(child));
}

// ============================================================================
// CodeBlock component — line numbers + collapsible
// ============================================================================
interface CodeBlockProps {
  codeString: string;
  syntaxLanguage?: string;
  displayLanguage: string;
  isTerminalTheme: boolean;
  copiedCode: string | null;
  onCopy: (code: string) => void;
}

const COLLAPSE_THRESHOLD = 25;
const COLLAPSED_MAX_LINES = 480; // ~25 lines worth of height in px

function CodeBlock({
  codeString,
  syntaxLanguage,
  displayLanguage,
  isTerminalTheme,
  copiedCode,
  onCopy,
}: CodeBlockProps) {
  const lineCount = codeString.split("\n").length;
  const isLong = lineCount > COLLAPSE_THRESHOLD;
  const [collapsed, setCollapsed] = useState(isLong);
  const label = displayLanguage || "code";
  const showLineNumbers = lineCount > 1;

  // Lazily load the syntax-highlighting language module on first render.
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!syntaxLanguage) return;
    let live = true;
    ensureLanguageRegistered(syntaxLanguage).then(() => {
      if (live) forceUpdate((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [syntaxLanguage]);

  return (
    <div className="relative group my-8 max-w-4xl mx-auto">
      {/* Terminal-style header for code blocks */}
      {isTerminalTheme && (
        <div className="flex items-center gap-2 bg-[hsl(var(--terminal-titlebar))] px-4 py-2 rounded-t-xl border border-b-0 border-border font-mono text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
          <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
          <span className="w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
          <span className="ml-2 text-primary">{label}</span>
        </div>
      )}
      {/* Non-terminal language badge */}
      {!isTerminalTheme && (
        <div className="absolute left-4 top-3 z-10">
          <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-200 shadow-sm backdrop-blur">
            {label}
          </span>
        </div>
      )}

      {/* Copy button */}
      <Button
        size="icon"
        variant="ghost"
        data-testid="code-copy-btn"
        className={cn(
          "absolute right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10",
          isTerminalTheme
            ? "top-12 text-primary hover:text-primary hover:bg-primary/10"
            : "top-2",
        )}
        onClick={() => onCopy(codeString)}
      >
        {copiedCode === codeString ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>

      {/* Code area with collapsible */}
      <div className="relative overflow-hidden">
        <div
          className={cn(
            "overflow-x-auto transition-[max-height] duration-500 ease-in-out",
            collapsed ? "overflow-y-hidden" : "overflow-y-visible",
          )}
          style={
            collapsed
              ? { maxHeight: `${COLLAPSED_MAX_LINES}px` }
              : { maxHeight: "none" }
          }
        >
          <SyntaxHighlighter
            style={isTerminalTheme ? terminalTheme : atomOneDark}
            language={syntaxLanguage}
            PreTag="div"
            showLineNumbers={showLineNumbers}
            lineNumberStyle={{
              minWidth: "2.5em",
              paddingRight: "1em",
              color: isTerminalTheme
                ? "rgba(100,160,120,0.4)"
                : "rgba(148,163,184,0.55)",
              userSelect: "none",
              fontSize: "0.78em",
              paddingTop: "0.15rem",
            }}
            customStyle={{
              margin: 0,
              padding: isTerminalTheme
                ? "1.2rem 1.25rem 1.15rem"
                : "1.15rem 1.2rem",
              borderRadius: isTerminalTheme ? "0 0 1rem 1rem" : "1rem",
              background: isTerminalTheme ? "hsl(200 50% 3%)" : "#0f172a",
              border: isTerminalTheme
                ? "1px solid hsl(200 30% 12%)"
                : "1px solid rgba(15, 23, 42, 0.14)",
              boxShadow: isTerminalTheme
                ? "0 18px 40px rgba(0, 0, 0, 0.35)"
                : "0 18px 36px rgba(15, 23, 42, 0.12)",
              fontSize: "0.92rem",
              lineHeight: 1.75,
            }}
            codeTagProps={{
              style: {
                fontFamily:
                  "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace",
                fontSize: "0.92rem",
              },
            }}
            className={cn(
              "rounded-xl shadow-lg !overflow-x-auto",
              isTerminalTheme && "rounded-t-none !rounded-b-xl",
              !isTerminalTheme && "!pt-11",
            )}
            wrapLongLines={false}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>

        {/* Fade gradient overlay when collapsed */}
        {isLong && collapsed && (
          <div
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{
              background: isTerminalTheme
                ? "linear-gradient(to bottom, transparent, hsl(200 50% 3%))"
                : "linear-gradient(to bottom, transparent, #282c34)",
            }}
          />
        )}
      </div>

      {/* Expand/Collapse toggle button */}
      {isLong && (
        <button
          type="button"
          data-testid="code-collapse-toggle"
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2 text-xs font-medium transition-colors",
            "border-t",
            isTerminalTheme
              ? "bg-[hsl(var(--terminal-titlebar))] border-border text-primary hover:bg-primary/10 rounded-b-xl"
              : "bg-[#282c34] border-[#3e4451] text-gray-400 hover:text-gray-200 rounded-b-xl",
          )}
        >
          {collapsed ? (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              <span>{lineCount - COLLAPSE_THRESHOLD}줄 더 보기</span>
            </>
          ) : (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              <span>접기</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

function MarkdownRendererInner({
  content,
  className = "",
  inlineEnabled = false,
  postTitle = "",
  postPath = "",
}: MarkdownRendererProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const { isTerminal } = useTheme();
  const copyResetTimerRef = useRef<number | null>(null);

  const sanitizedContent = useMemo(() => {
    if (!postTitle) return content;
    const normalizedTitle = postTitle.trim().toLowerCase();
    const lines = content.split(/\r?\n/);
    while (lines.length) {
      const first = lines[0].trim();
      const plain = first
        .replace(/^#+\s*/, "")
        .trim()
        .toLowerCase();
      if (plain && plain === normalizedTitle) {
        lines.shift();
        continue;
      }
      break;
    }
    return lines.join("\n");
  }, [content, postTitle]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const copyToClipboard = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopiedCode(null);
      copyResetTimerRef.current = null;
    }, 2000);
  }, []);

  const markdownComponents = useMemo(() => {
    const headingSlugCounts = new Map<string, number>();
    const getHeadingId = (children: ReactNode): string => {
      const raw = normalizeHeadingText(extractTextFromNode(children));
      const base = createHeadingSlug(raw);
      const count = headingSlugCounts.get(base) ?? 0;
      headingSlugCounts.set(base, count + 1);
      return count === 0 ? base : `${base}-${count}`;
    };

    return {
      h1: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h1
            id={id}
            className={cn(
              "text-4xl font-bold mt-12 mb-6 scroll-mt-24 text-center max-w-4xl mx-auto",
              isTerminal && "terminal-glow",
            )}
          >
            {isTerminal && <span className="text-primary mr-2">#</span>}
            {children}
          </h1>
        );
      },
      h2: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h2
            id={id}
            className={cn(
              "text-3xl font-semibold mt-10 mb-5 scroll-mt-24 text-center max-w-4xl mx-auto",
              isTerminal && "terminal-glow",
            )}
          >
            {isTerminal && <span className="text-primary mr-2">##</span>}
            {children}
          </h2>
        );
      },
      h3: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h3
            id={id}
            className={cn(
              "text-2xl font-semibold mt-8 mb-4 scroll-mt-24 text-center max-w-4xl mx-auto",
              isTerminal && "terminal-glow",
            )}
          >
            {isTerminal && <span className="text-primary mr-2">###</span>}
            {children}
          </h3>
        );
      },
      h4: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h4 id={id} className="text-xl font-semibold mt-4 mb-2 scroll-mt-24">
            {children}
          </h4>
        );
      },
      h5: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h5 id={id} className="text-lg font-semibold mt-4 mb-2 scroll-mt-24">
            {children}
          </h5>
        );
      },
      h6: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h6
            id={id}
            className="text-base font-semibold mt-4 mb-2 scroll-mt-24"
          >
            {children}
          </h6>
        );
      },
      p: ({ children }: { children?: ReactNode }) => {
        const childArray = Children.toArray(children);
        const containsNonInlineContent = childArray.some((child) =>
          hasNonInlineNode(child),
        );

        if (containsNonInlineContent) {
          return (
            <div className="space-y-4 max-w-4xl mx-auto">
              {childArray.map((child, idx) => (
                <Fragment key={idx}>{child}</Fragment>
              ))}
            </div>
          );
        }

        if (inlineEnabled) {
          return (
            <SparkInline postTitle={postTitle} wrapperTag="p">
              {children}
            </SparkInline>
          );
        }

        return (
          <p
            className={cn(
              "mb-6 leading-8 text-justify max-w-4xl mx-auto",
              isTerminal && "border-l border-border/50 pl-4",
            )}
          >
            {children}
          </p>
        );
      },
      ul: ({ children }: { children?: ReactNode }) => (
        <ul
          className={cn(
            "list-disc pl-6 mb-6 space-y-3 max-w-4xl mx-auto",
            isTerminal && "list-none",
          )}
        >
          {children}
        </ul>
      ),
      ol: ({ children }: { children?: ReactNode }) => (
        <ol className="list-decimal pl-6 mb-6 space-y-3 max-w-4xl mx-auto">
          {children}
        </ol>
      ),
      li: ({ children }: { children?: ReactNode }) => (
        <li
          className={cn(
            "leading-8 text-justify",
            isTerminal && 'before:content-["-_"] before:text-primary',
          )}
        >
          {children}
        </li>
      ),
      blockquote: ({ children }: { children?: ReactNode }) => (
        <blockquote
          className={cn(
            "border-l-4 border-primary pl-6 my-8 italic bg-muted/30 py-4 rounded-r-lg max-w-4xl mx-auto",
            isTerminal &&
              "bg-[hsl(var(--terminal-code-bg))] border-primary/60 not-italic font-mono",
          )}
        >
          {children}
        </blockquote>
      ),
      pre({
        children,
        node,
        ...props
      }: React.ComponentProps<"pre"> & { node?: HastElement }) {
        const codeBlockData = extractCodeBlockDataFromPre(node, children);

        if (!codeBlockData) {
          return <pre {...props}>{children}</pre>;
        }

        const match = /language-([\w-]+)/.exec(codeBlockData.className || "");
        const resolvedLanguage = match
          ? normalizeCodeLanguage(match[1])
          : inferCodeLanguage(codeBlockData.codeString);

        return (
          <CodeBlock
            codeString={codeBlockData.codeString}
            syntaxLanguage={resolvedLanguage.syntaxLanguage}
            displayLanguage={resolvedLanguage.displayLanguage}
            isTerminalTheme={isTerminal}
            copiedCode={copiedCode}
            onCopy={copyToClipboard}
          />
        );
      },
      code({
        inline,
        className,
        children,
        node: _node,
        ...props
      }: React.ComponentProps<"code"> & {
        inline?: boolean;
        node?: unknown;
      }) {
        void inline;
        return (
          <code
            data-inline-code="true"
            className={cn(
              "bg-muted px-1.5 py-0.5 rounded text-sm",
              isTerminal &&
                "bg-[hsl(var(--terminal-code-bg))] text-primary font-mono",
              className,
            )}
            {...props}
          >
            {children}
          </code>
        );
      },
      a: ({ href, children }: { href?: string; children?: ReactNode }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "text-primary hover:underline",
            isTerminal &&
              "underline decoration-dotted underline-offset-4 hover:decoration-solid",
          )}
        >
          {children}
        </a>
      ),
      img: ({ src, alt }: { src?: string; alt?: string }) => (
        <ClickableImage
          src={src || ""}
          alt={alt}
          isTerminal={isTerminal}
          postPath={postPath}
        />
      ),
      video: ({
        src,
        children,
        ...props
      }: React.ComponentProps<"video"> & { children?: ReactNode }) => (
        <EmbeddedVideo
          {...props}
          src={typeof src === "string" ? src : ""}
          postPath={postPath}
          isTerminal={isTerminal}
        >
          {children}
        </EmbeddedVideo>
      ),
      source: ({ src, ...props }: React.ComponentProps<"source">) => (
        <NormalizedVideoSource
          {...props}
          src={typeof src === "string" ? src : undefined}
          postPath={postPath}
        />
      ),
      iframe: (props: React.ComponentProps<"iframe">) => (
        <EmbeddedIframe
          {...props}
          postPath={postPath}
          isTerminal={isTerminal}
        />
      ),
      cite: ({ children }: { children?: ReactNode }) => <cite>{children}</cite>,
      table: ({ children }: { children?: ReactNode }) => (
        <div className="overflow-x-auto my-8 max-w-4xl mx-auto">
          <table
            className={cn(
              "min-w-full divide-y divide-border rounded-lg shadow-sm",
              isTerminal && "font-mono text-sm",
            )}
          >
            {children}
          </table>
        </div>
      ),
      th: ({ children }: { children?: ReactNode }) => (
        <th
          className={cn(
            "px-4 py-2 text-left font-semibold bg-muted",
            isTerminal &&
              "bg-[hsl(var(--terminal-code-bg))] text-primary uppercase text-xs tracking-wider",
          )}
        >
          {children}
        </th>
      ),
      td: ({ children }: { children?: ReactNode }) => (
        <td className="px-4 py-2 border-t">{children}</td>
      ),
    };
  }, [
    copiedCode,
    copyToClipboard,
    inlineEnabled,
    isTerminal,
    postPath,
    postTitle,
  ]);

  return (
    <div
      className={cn(
        "prose prose-neutral dark:prose-invert max-w-none prose-lg content",
        isTerminal && "prose-headings:font-mono prose-headings:tracking-wide",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, blogMarkdownSanitizeSchema],
        ]}
        components={markdownComponents}
      >
        {sanitizedContent}
      </ReactMarkdown>
    </div>
  );
}

const MarkdownRenderer = memo(
  MarkdownRendererInner,
  (prev, next) =>
    prev.content === next.content &&
    prev.className === next.className &&
    prev.inlineEnabled === next.inlineEnabled &&
    prev.postTitle === next.postTitle &&
    prev.postPath === next.postPath,
);

export default MarkdownRenderer;
