import { useRef } from 'react';
import { ExternalLink, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { AIConsole } from '@/components/molecules/AIConsole';
import type { ProjectItem } from '@/types/project';

interface ProjectModalProps {
  open: boolean;
  project: ProjectItem | null;
  onOpenChange: (open: boolean) => void;
  label?: string;
  title?: string;
  defaultTitle?: string;
  openLabel?: string;
  fullscreenLabel?: string;
  closeLabel?: string;
  unavailableMessage?: string;
}

const PROJECT_MODAL_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const PROJECT_MODAL_CONTROL_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const PROJECT_MODAL_ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const PROJECT_MODAL_WHITESPACE_PATTERN = /\s+/g;
const PROJECT_MODAL_ENCODED_CONTROL_PATTERN = /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const DEFAULT_MODAL_LABEL = 'Project preview';
const DEFAULT_PREVIEW_TITLE = 'Project Preview';
const DEFAULT_OPEN_LABEL = 'Open';
const DEFAULT_FULLSCREEN_LABEL = 'Fullscreen';
const DEFAULT_CLOSE_LABEL = 'Close preview';
const DEFAULT_UNAVAILABLE_MESSAGE =
  'This project cannot be embedded due to security policy. Use the Open button.';

export function normalizeProjectModalText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;

  const normalized = String(value)
    .replace(PROJECT_MODAL_ANSI_ESCAPE_PATTERN, ' ')
    .replace(PROJECT_MODAL_CONTROL_PATTERN, ' ')
    .replace(PROJECT_MODAL_WHITESPACE_PATTERN, ' ')
    .trim();

  return normalized || fallback;
}

function normalizeOptionalProjectModalText(value: unknown): string | undefined {
  return normalizeProjectModalText(value) || undefined;
}

export function normalizeProjectPreviewUrl(
  value?: string | null
): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (
    PROJECT_MODAL_CONTROL_TEST_PATTERN.test(raw) ||
    PROJECT_MODAL_ENCODED_CONTROL_PATTERN.test(raw) ||
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

export function ProjectModal({
  open,
  project,
  onOpenChange,
  label = DEFAULT_MODAL_LABEL,
  title,
  defaultTitle = DEFAULT_PREVIEW_TITLE,
  openLabel = DEFAULT_OPEN_LABEL,
  fullscreenLabel = DEFAULT_FULLSCREEN_LABEL,
  closeLabel = DEFAULT_CLOSE_LABEL,
  unavailableMessage = DEFAULT_UNAVAILABLE_MESSAGE,
}: ProjectModalProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const projectUrl = normalizeProjectPreviewUrl(project?.url);
  const safeDefaultTitle = normalizeProjectModalText(defaultTitle, DEFAULT_PREVIEW_TITLE);
  const safeProjectTitle = project
    ? normalizeProjectModalText(project.title, safeDefaultTitle)
    : safeDefaultTitle;
  const safeDialogLabel = `${normalizeProjectModalText(label, DEFAULT_MODAL_LABEL)}: ${safeProjectTitle}`;
  const safeDialogTitle = normalizeOptionalProjectModalText(title);
  const safeOpenLabel = normalizeProjectModalText(openLabel, DEFAULT_OPEN_LABEL);
  const safeFullscreenLabel = normalizeProjectModalText(
    fullscreenLabel,
    DEFAULT_FULLSCREEN_LABEL
  );
  const safeCloseLabel = normalizeProjectModalText(closeLabel, DEFAULT_CLOSE_LABEL);
  const safeUnavailableMessage = normalizeProjectModalText(
    unavailableMessage,
    DEFAULT_UNAVAILABLE_MESSAGE
  );

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
        aria-label={safeDialogLabel}
        title={safeDialogTitle}
        className='h-[88vh] w-[96vw] max-w-6xl overflow-hidden border-border/60 bg-background p-0'
      >
        <div className='flex items-center justify-between border-b border-border/60 px-4 py-3'>
          <DialogTitle className='truncate text-base font-semibold'>
            {safeProjectTitle}
          </DialogTitle>
          <div className='flex items-center gap-2'>
            {projectUrl && (
              <Button variant='outline' size='sm' asChild>
                <a
                  href={projectUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-label={`${safeOpenLabel}: ${safeProjectTitle}`}
                >
                  <ExternalLink aria-hidden='true' className='h-4 w-4' />
                  {safeOpenLabel}
                </a>
              </Button>
            )}
            {project?.type === 'embed' && projectUrl && (
              <Button
                variant='outline'
                size='sm'
                onClick={handleFullscreen}
                aria-label={`${safeFullscreenLabel}: ${safeProjectTitle}`}
              >
                <Maximize2 aria-hidden='true' className='h-4 w-4' />
                {safeFullscreenLabel}
              </Button>
            )}
            <Button variant='ghost' size='icon' onClick={close} aria-label={safeCloseLabel}>
              <X aria-hidden='true' className='h-4 w-4' />
            </Button>
          </div>
        </div>

        <div className='h-[calc(88vh-57px)]'>
          {project?.type === 'console' ? (
            <AIConsole className='h-full rounded-none border-0 shadow-none' onClose={close} />
          ) : project?.type === 'embed' && projectUrl ? (
            <iframe
              ref={iframeRef}
              src={projectUrl}
              title={`${safeProjectTitle} preview`}
              className='h-full w-full border-0'
              loading='lazy'
              allow='clipboard-read; clipboard-write; fullscreen'
              allowFullScreen
            />
          ) : (
            <div className='flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground'>
              {safeUnavailableMessage}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
