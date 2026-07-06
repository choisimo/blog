import { ExternalLink, Eye, Github } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ProjectItem } from '@/types/project';

interface ProjectCardProps {
  project: ProjectItem;
  onPreview: (project: ProjectItem) => void;
  label?: string;
  title?: string;
  visitLabel?: string;
  codeLabel?: string;
}

const PROJECT_CARD_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const PROJECT_CARD_CONTROL_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const PROJECT_CARD_ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const PROJECT_CARD_WHITESPACE_PATTERN = /\s+/g;
const PROJECT_CARD_ENCODED_CONTROL_PATTERN = /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const DEFAULT_CARD_LABEL = 'Project card';
const DEFAULT_VISIT_LABEL = 'Visit';
const DEFAULT_CODE_LABEL = 'Code';

export function normalizeProjectCardText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(PROJECT_CARD_ANSI_ESCAPE_PATTERN, ' ')
    .replace(PROJECT_CARD_CONTROL_PATTERN, ' ')
    .replace(PROJECT_CARD_WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalProjectCardText(value: unknown): string | undefined {
  return normalizeProjectCardText(value) || undefined;
}

function getStatusClassName(status: unknown): string {
  const normalized = normalizeProjectCardText(status).toLowerCase();
  if (normalized === 'live') {
    return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
  }
  if (normalized === 'archive') {
    return 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30';
  }
  return 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30';
}

const previewLabel: Record<ProjectItem['type'], string> = {
  console: 'Preview',
  embed: 'Preview',
  link: 'Preview',
};

export function normalizeProjectCardUrl(
  value?: string | null
): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (
    PROJECT_CARD_CONTROL_TEST_PATTERN.test(raw) ||
    PROJECT_CARD_ENCODED_CONTROL_PATTERN.test(raw) ||
    /\s/.test(raw)
  ) {
    return undefined;
  }

  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return raw;
  }

  try {
    const url = new URL(raw);
    return (url.protocol === 'http:' || url.protocol === 'https:') &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function ProjectCard({
  project,
  onPreview,
  label = DEFAULT_CARD_LABEL,
  title,
  visitLabel = DEFAULT_VISIT_LABEL,
  codeLabel = DEFAULT_CODE_LABEL,
}: ProjectCardProps) {
  const projectUrl = normalizeProjectCardUrl(project.url);
  const codeUrl = normalizeProjectCardUrl(project.codeUrl);
  const thumbnailUrl = normalizeProjectCardUrl(project.thumbnail);
  const safeLabel = normalizeProjectCardText(label, DEFAULT_CARD_LABEL);
  const safeTitle = normalizeProjectCardText(project.title, 'Untitled project');
  const safeCardTitle = normalizeOptionalProjectCardText(title);
  const safeDescription = normalizeProjectCardText(project.description);
  const safeCategory = normalizeProjectCardText(project.category, 'Project');
  const safeStatus = normalizeProjectCardText(project.status, 'draft');
  const safeTags = project.tags.flatMap(tag => {
    const safeTag = normalizeProjectCardText(tag);
    return safeTag ? [safeTag] : [];
  });
  const safeVisitLabel = normalizeProjectCardText(visitLabel, DEFAULT_VISIT_LABEL);
  const safeCodeLabel = normalizeProjectCardText(codeLabel, DEFAULT_CODE_LABEL);
  const safePreviewLabel = normalizeProjectCardText(
    previewLabel[project.type] ?? 'Preview',
    'Preview'
  );

  return (
    <Card
      aria-label={`${safeLabel}: ${safeTitle}`}
      title={safeCardTitle}
      className='group flex h-full flex-col overflow-hidden border-border/60 bg-card/70 backdrop-blur'
    >
      <div className='relative aspect-[16/9] overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/20 via-background to-accent/40'>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`${safeTitle} thumbnail`}
            loading='lazy'
            className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
          />
        ) : (
          <div className='flex h-full w-full items-center justify-center'>
            <div className='rounded-xl border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground'>
              {safeCategory}
            </div>
          </div>
        )}
        <Badge
          variant='outline'
          className={cn(
            'absolute right-3 top-3 border px-2 py-0.5 text-[11px] font-medium',
            getStatusClassName(project.status)
          )}
        >
          {safeStatus}
        </Badge>
      </div>

      <CardHeader className='space-y-2 pb-3'>
        <CardTitle className='text-lg'>{safeTitle}</CardTitle>
        <CardDescription className='line-clamp-2 text-sm leading-relaxed text-muted-foreground'>
          {safeDescription}
        </CardDescription>
      </CardHeader>

      <CardContent className='mt-auto space-y-4'>
        <div className='flex flex-wrap gap-1.5'>
          {safeTags.map(tag => (
            <Badge key={`${project.id}-${tag}`} variant='secondary' className='text-[11px]'>
              {tag}
            </Badge>
          ))}
        </div>

        <div className='flex flex-wrap gap-2'>
          {projectUrl ? (
            <Button asChild size='sm' className='flex-1 min-w-[96px]'>
              <a href={projectUrl} target='_blank' rel='noopener noreferrer'>
                <ExternalLink aria-hidden='true' className='h-4 w-4' />
                {safeVisitLabel}
              </a>
            </Button>
          ) : (
            <Button size='sm' className='flex-1 min-w-[96px]' disabled>
              <ExternalLink aria-hidden='true' className='h-4 w-4' />
              {safeVisitLabel}
            </Button>
          )}

          <Button
            type='button'
            variant='outline'
            size='sm'
            className='flex-1 min-w-[96px]'
            aria-label={`${safePreviewLabel}: ${safeTitle}`}
            onClick={() => onPreview(project)}
          >
            <Eye aria-hidden='true' className='h-4 w-4' />
            {safePreviewLabel}
          </Button>

          {codeUrl ? (
            <Button asChild variant='ghost' size='sm' className='flex-1 min-w-[96px]'>
              <a href={codeUrl} target='_blank' rel='noopener noreferrer'>
                <Github aria-hidden='true' className='h-4 w-4' />
                {safeCodeLabel}
              </a>
            </Button>
          ) : (
            <Button type='button' variant='ghost' size='sm' className='flex-1 min-w-[96px]' disabled>
              <Github aria-hidden='true' className='h-4 w-4' />
              {safeCodeLabel}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
