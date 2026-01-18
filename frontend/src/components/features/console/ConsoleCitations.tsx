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
}

function CitationItem({ citation, index }: { citation: Citation; index: number }) {
  const href = citation.url || (citation.year && citation.slug 
    ? `/blog/${citation.year}/${citation.slug}` 
    : undefined);

  const scorePercent = Math.round(citation.score * 100);
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
                className="text-sm font-medium text-foreground hover:text-primary truncate transition-colors flex items-center gap-1"
              >
                <span className="truncate">{citation.title}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 flex-shrink-0 transition-opacity" />
              </a>
            ) : (
              <span className="text-sm font-medium text-foreground truncate">
                {citation.title}
              </span>
            )}
          </div>
          
          {citation.snippet && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {citation.snippet}
            </p>
          )}
          
          <div className="mt-1.5 flex items-center gap-3 text-[10px] font-mono">
            <span className={cn('flex items-center gap-1', scoreColor)}>
              <Hash className="w-3 h-3" />
              {scorePercent}%
            </span>
            {citation.category && (
              <span className="text-zinc-500 flex items-center gap-1">
                <ChevronRight className="w-3 h-3" />
                {citation.category}
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
}: ConsoleCitationsProps) {
  if (citations.length === 0 && !isLoading) return null;

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2 px-1 py-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
          Sources
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
