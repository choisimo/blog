import { useRef } from 'react';
import { ExternalLink, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AIConsole } from '@/components/features/console';
import type { ProjectItem } from '@/types/project';

interface ProjectModalProps {
  open: boolean;
  project: ProjectItem | null;
  onOpenChange: (open: boolean) => void;
}

export function ProjectModal({ open, project, onOpenChange }: ProjectModalProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const handleFullscreen = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    if (iframe.requestFullscreen) {
      void iframe.requestFullscreen();
    }
  };

  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className='h-[88vh] w-[96vw] max-w-6xl overflow-hidden border-border/60 bg-background p-0'
      >
        <div className='flex items-center justify-between border-b border-border/60 px-4 py-3'>
          <DialogTitle className='truncate text-base font-semibold'>
            {project?.title ?? 'Project Preview'}
          </DialogTitle>
          <div className='flex items-center gap-2'>
            {project?.url && (
              <Button variant='outline' size='sm' asChild>
                <a href={project.url} target='_blank' rel='noopener noreferrer'>
                  <ExternalLink className='h-4 w-4' />
                  Open
                </a>
              </Button>
            )}
            {project?.type === 'embed' && (
              <Button variant='outline' size='sm' onClick={handleFullscreen}>
                <Maximize2 className='h-4 w-4' />
                Fullscreen
              </Button>
            )}
            <Button variant='ghost' size='icon' onClick={close} aria-label='Close preview'>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </div>

        <div className='h-[calc(88vh-57px)]'>
          {project?.type === 'console' ? (
            <AIConsole className='h-full rounded-none border-0 shadow-none' onClose={close} />
          ) : project?.type === 'embed' ? (
            <iframe
              ref={iframeRef}
              src={project.url}
              title={`${project.title} preview`}
              className='h-full w-full border-0'
              loading='lazy'
              allow='clipboard-read; clipboard-write; fullscreen'
              allowFullScreen
            />
          ) : (
            <div className='flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground'>
              This project cannot be embedded due to security policy. Use the Open button.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
