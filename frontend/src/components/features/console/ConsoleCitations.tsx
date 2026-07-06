/**
 * Console Citations Panel
 * 
 * Displays RAG search results as citations
 * High-fidelity cyberpunk industrial style
 */

import { memo } from 'react';
import { FileText, ExternalLink, Hash, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Citation } from './types';

interface ConsoleCitationsProps {
  citations: Citation[];
  isLoading?: boolean;
  className?: string;
  label?: string;
  title?: string;
  sourcesLabel?: string;
}

const ANSI_ESCAPE_PATTERN =
  /\u001B(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001B\\))/g;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/g;
const HAS_CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;
const MALFORMED_PERCENT_PATTERN = /%(?![0-9A-Fa-f]{2})/;
const ENCODED_CONTROL_PATTERN = /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const ENCODED_SEPARATOR_PATTERN = /%(?:2[Ff]|5[Cc])/;
const WHITESPACE_PATTERN = /\s+/g;
const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:']);
const DEFAULT_CITATIONS_LABEL = 'Console sources';
const DEFAULT_SOURCES_LABEL = 'Sources';

function normalizeCitationText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return fallback;
  }

  const normalized = String(value)
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(CONTROL_CHAR_PATTERN, ' ')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizePathSegment(value: unknown): string | undefined {
  const normalized = normalizeCitationText(value);
  if (
    !normalized ||
    normalized.includes('/') ||
    normalized.includes('\\') ||
    MALFORMED_PERCENT_PATTERN.test(normalized)
  ) {
    return undefined;
  }

  let decoded = normalized;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    return undefined;
  }

  if (
    !decoded.trim() ||
    decoded === '.' ||
    decoded === '..' ||
    HAS_CONTROL_CHAR_PATTERN.test(decoded) ||
    decoded.includes('/') ||
    decoded.includes('\\')
  ) {
    return undefined;
  }

  return encodeURIComponent(decoded.trim());
}

function normalizeDirectHref(value: unknown): string | undefined {
  const href = normalizeCitationText(value);
  if (!href) return undefined;
  if (
    href.includes('\\') ||
    MALFORMED_PERCENT_PATTERN.test(href) ||
    ENCODED_CONTROL_PATTERN.test(href) ||
    ENCODED_SEPARATOR_PATTERN.test(href)
  ) {
    return undefined;
  }

  if (href.startsWith('/') && !href.startsWith('//')) {
    return href;
  }

  try {
    const parsed = new URL(href);
    if (parsed.username || parsed.password) return undefined;
    return SAFE_LINK_PROTOCOLS.has(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

function buildCitationHref(citation: Citation): string | undefined {
  const directHref = normalizeDirectHref(citation.url);
  if (directHref) return directHref;

  const year = normalizePathSegment(citation.year);
  const slug = normalizePathSegment(citation.slug);
  return year && slug ? `/blog/${year}/${slug}` : undefined;
}

function normalizeScorePercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function CitationItem({ citation, index }: { citation: Citation; index: number }) {
  const href = buildCitationHref(citation);
  const title = normalizeCitationText(citation.title, 'Untitled source');
  const snippet = normalizeCitationText(citation.snippet);
  const category = normalizeCitationText(citation.category);

  const scorePercent = normalizeScorePercent(citation.score);
  const scoreColor = scorePercent >= 70 
    ? 'text-emerald-400' 
    : scorePercent >= 40 
      ? 'text-amber-400' 
      : 'text-zinc-500';

  return (
    <div className="group border-l-2 border-zinc-700 hover:border-primary/60 pl-3 py-2 transition-colors">
      <div className="flex items-start gap-2">
        <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-zinc-800 text-[10px] font-mono text-zinc-400 mt-0.5">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Open source: ${title}`}
                title={title}
                className="text-sm font-medium text-foreground hover:text-primary truncate transition-colors flex items-center gap-1"
              >
                <span className="truncate">{title}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 flex-shrink-0 transition-opacity" aria-hidden="true" />
              </a>
            ) : (
              <span className="text-sm font-medium text-foreground truncate">
                {title}
              </span>
            )}
          </div>
          
          {snippet && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {snippet}
            </p>
          )}
          
          <div className="mt-1.5 flex items-center gap-3 text-[10px] font-mono">
            <span className={cn('flex items-center gap-1', scoreColor)}>
              <Hash className="w-3 h-3" aria-hidden="true" />
              {scorePercent}%
            </span>
            {category && (
              <span className="text-zinc-500 flex items-center gap-1">
                <ChevronRight className="w-3 h-3" aria-hidden="true" />
                {category}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const ConsoleCitations = memo(function ConsoleCitations({
  citations,
  isLoading,
  className,
  label = DEFAULT_CITATIONS_LABEL,
  title,
  sourcesLabel = DEFAULT_SOURCES_LABEL,
}: ConsoleCitationsProps) {
  if (citations.length === 0 && !isLoading) return null;
  const safeLabel = normalizeCitationText(label, DEFAULT_CITATIONS_LABEL);
  const safeTitle = normalizeCitationText(title);
  const safeSourcesLabel = normalizeCitationText(sourcesLabel, DEFAULT_SOURCES_LABEL);

  return (
    <div
      className={cn('space-y-1', className)}
      role="region"
      aria-label={safeLabel}
      title={safeTitle || undefined}
    >
      <div className="flex items-center gap-2 px-1 py-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden="true" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          {safeSourcesLabel}
        </span>
        <span className="text-[10px] font-mono text-zinc-600">
          [{citations.length}]
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2 pl-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-zinc-800 rounded w-3/4 mb-1" />
              <div className="h-3 bg-zinc-800/50 rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {citations.map((citation, idx) => (
            <CitationItem key={citation.id} citation={citation} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
});
