import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const ALLOWED_DESCRIPTION_ELEMENTS = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "li",
  "ol",
  "p",
  "strong",
  "ul",
] as const;

const SINGLE_LINE_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const MULTILINE_CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const WHITESPACE_PATTERN = /\s+/g;
const ENCODED_DESCRIPTION_HREF_CONTROL_PATTERN = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;
const ENCODED_DESCRIPTION_HREF_SEPARATOR_PATTERN = /%(?:2f|5c)/i;
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

function normalizeDescriptionText(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";

  return String(value)
    .replace(ANSI_ESCAPE_PATTERN, " ")
    .replace(/\r\n?/g, "\n")
    .replace(MULTILINE_CONTROL_PATTERN, " ")
    .trim();
}

function normalizeDescriptionLine(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number") return "";

  return String(value)
    .replace(ANSI_ESCAPE_PATTERN, " ")
    .replace(SINGLE_LINE_CONTROL_PATTERN, " ")
    .replace(WHITESPACE_PATTERN, " ")
    .trim();
}

function hasUnsafeEncodedHref(value: string): boolean {
  if (
    ENCODED_DESCRIPTION_HREF_CONTROL_PATTERN.test(value) ||
    ENCODED_DESCRIPTION_HREF_SEPARATOR_PATTERN.test(value)
  ) {
    return true;
  }

  try {
    decodeURI(value);
    return false;
  } catch {
    return true;
  }
}

export function normalizeDescriptionHref(href: unknown): string | null {
  if (typeof href !== "string") return null;

  const normalized = normalizeDescriptionLine(href);
  if (!normalized) return null;
  if (hasUnsafeEncodedHref(normalized)) return null;

  if (normalized.startsWith("#")) {
    return normalized;
  }

  if (normalized.startsWith("/") && !normalized.startsWith("//") && !normalized.includes("\\")) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (!SAFE_LINK_PROTOCOLS.has(parsed.protocol)) return null;
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.username || parsed.password)
    ) {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function DescriptionHeading({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <strong className={cn("block font-semibold", className)}>{children}</strong>
  );
}

interface SafeDescriptionMarkdownProps {
  text: string;
  className?: string;
  label?: string;
  title?: string;
}

export function SafeDescriptionMarkdown({
  text,
  className,
  label,
  title,
}: SafeDescriptionMarkdownProps) {
  const markdown = normalizeDescriptionText(text);
  if (!markdown) {
    return null;
  }
  const safeLabel = normalizeDescriptionLine(label);
  const safeTitle = normalizeDescriptionLine(title) || undefined;

  return (
    <div
      className={className}
      role={safeLabel ? "region" : undefined}
      aria-label={safeLabel || undefined}
      title={safeTitle}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        unwrapDisallowed
        allowedElements={ALLOWED_DESCRIPTION_ELEMENTS}
        components={{
          p: ({ children }) => <p className="m-0 not-first:mt-3">{children}</p>,
          h1: ({ children }) => (
            <DescriptionHeading>{children}</DescriptionHeading>
          ),
          h2: ({ children }) => (
            <DescriptionHeading>{children}</DescriptionHeading>
          ),
          h3: ({ children }) => (
            <DescriptionHeading>{children}</DescriptionHeading>
          ),
          h4: ({ children }) => (
            <DescriptionHeading>{children}</DescriptionHeading>
          ),
          h5: ({ children }) => (
            <DescriptionHeading>{children}</DescriptionHeading>
          ),
          h6: ({ children }) => (
            <DescriptionHeading>{children}</DescriptionHeading>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-primary/20 pl-3 italic">
              {children}
            </blockquote>
          ),
          code({
            inline,
            children,
            className: codeClassName,
            ...props
          }: React.ComponentProps<"code"> & { inline?: boolean }) {
            return (
              <code
                className={cn(
                  "rounded bg-muted px-1.5 py-0.5 text-sm",
                  !inline && "block overflow-x-auto px-3 py-2",
                  codeClassName,
                )}
                {...props}
              >
                {children}
              </code>
            );
          },
          a: ({ href, children }) => {
            const safeHref = normalizeDescriptionHref(href);
            if (!safeHref) {
              return <>{children}</>;
            }

            const isExternal =
              safeHref.startsWith("http://") ||
              safeHref.startsWith("https://") ||
              safeHref.startsWith("mailto:");

            return (
              <a
                href={safeHref}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="text-primary hover:underline"
              >
                {children}
              </a>
            );
          },
          img: () => null,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
