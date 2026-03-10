import { ExternalLink, Eye, Github } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ProjectItem } from '@/types/project';

interface ProjectCardProps {
  project: ProjectItem;
  onPreview: (project: ProjectItem) => void;
}

function getStatusClassName(status: ProjectItem['status']): string {
  const normalized = status.toLowerCase();
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

export function ProjectCard({ project, onPreview }: ProjectCardProps) {
  return (
    <Card className='group flex h-full flex-col overflow-hidden border-border/60 bg-card/70 backdrop-blur'>
      <div className='relative aspect-[16/9] overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/20 via-background to-accent/40'>
        {project.thumbnail ? (
          <img
            src={project.thumbnail}
            alt={`${project.title} thumbnail`}
            loading='lazy'
            className='h-full w-full object-cover transition-transform duration-300 group-hover:scale-105'
          />
        ) : (
          <div className='flex h-full w-full items-center justify-center'>
            <div className='rounded-xl border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground'>
              {project.category}
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
          {project.status}
        </Badge>
      </div>

      <CardHeader className='space-y-2 pb-3'>
        <CardTitle className='text-lg'>{project.title}</CardTitle>
        <CardDescription className='line-clamp-2 text-sm leading-relaxed text-muted-foreground'>
          {project.description}
        </CardDescription>
      </CardHeader>

      <CardContent className='mt-auto space-y-4'>
        <div className='flex flex-wrap gap-1.5'>
          {project.tags.map(tag => (
            <Badge key={`${project.id}-${tag}`} variant='secondary' className='text-[11px]'>
              {tag}
            </Badge>
          ))}
        </div>

        <div className='flex flex-wrap gap-2'>
          <Button asChild size='sm' className='flex-1 min-w-[96px]'>
            <a href={project.url} target='_blank' rel='noopener noreferrer'>
              <ExternalLink className='h-4 w-4' />
              Visit
            </a>
          </Button>

          <Button
            type='button'
            variant='outline'
            size='sm'
            className='flex-1 min-w-[96px]'
            onClick={() => onPreview(project)}
          >
            <Eye className='h-4 w-4' />
            {previewLabel[project.type]}
          </Button>

          {project.codeUrl ? (
            <Button asChild variant='ghost' size='sm' className='flex-1 min-w-[96px]'>
              <a href={project.codeUrl} target='_blank' rel='noopener noreferrer'>
                <Github className='h-4 w-4' />
                Code
              </a>
            </Button>
          ) : (
            <Button type='button' variant='ghost' size='sm' className='flex-1 min-w-[96px]' disabled>
              <Github className='h-4 w-4' />
              Code
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
