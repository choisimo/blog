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

function isSafeDescriptionHref(href: string): boolean {
  return (
    href.startsWith("https://") ||
    href.startsWith("http://") ||
    href.startsWith("mailto:") ||
    href.startsWith("#") ||
    /^\/(?!\/)/.test(href)
  );
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
}

export function SafeDescriptionMarkdown({
  text,
  className,
}: SafeDescriptionMarkdownProps) {
  if (!text) {
    return null;
  }

  return (
    <div className={className}>
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
            if (typeof href !== "string" || !isSafeDescriptionHref(href)) {
              return <>{children}</>;
            }

            const isExternal =
              href.startsWith("http://") ||
              href.startsWith("https://") ||
              href.startsWith("mailto:");

            return (
              <a
                href={href}
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
        {text}
      </ReactMarkdown>
    </div>
  );
}
