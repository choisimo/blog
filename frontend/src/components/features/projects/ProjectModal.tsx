import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
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
const PROJECT_MODAL_ENCODED_CONTROL_PATTERN =
  /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const DEFAULT_MODAL_LABEL = 'Project preview';
const DEFAULT_PREVIEW_TITLE = 'Project Preview';
const DEFAULT_OPEN_LABEL = 'Open';
const DEFAULT_FULLSCREEN_LABEL = 'Fullscreen';
const DEFAULT_CLOSE_LABEL = 'Close preview';
const DEFAULT_UNAVAILABLE_MESSAGE =
  'This project cannot be embedded due to security policy. Use the Open button.';

export function normalizeProjectModalText(
  value: unknown,
  fallback = ''
): string {
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
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<
    'loading' | 'loaded' | 'error'
  >('loading');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const projectUrl = normalizeProjectPreviewUrl(project?.url);
  const safeDefaultTitle = normalizeProjectModalText(
    defaultTitle,
    DEFAULT_PREVIEW_TITLE
  );
  const safeProjectTitle = project
    ? normalizeProjectModalText(project.title, safeDefaultTitle)
    : safeDefaultTitle;
  const safeDialogLabel = `${normalizeProjectModalText(label, DEFAULT_MODAL_LABEL)}: ${safeProjectTitle}`;
  const safeDialogTitle = normalizeOptionalProjectModalText(title);
  const safeOpenLabel = normalizeProjectModalText(
    openLabel,
    DEFAULT_OPEN_LABEL
  );
  const safeFullscreenLabel = normalizeProjectModalText(
    fullscreenLabel,
    DEFAULT_FULLSCREEN_LABEL
  );
  const safeCloseLabel = normalizeProjectModalText(
    closeLabel,
    DEFAULT_CLOSE_LABEL
  );
  const safeUnavailableMessage = normalizeProjectModalText(
    unavailableMessage,
    DEFAULT_UNAVAILABLE_MESSAGE
  );

  useEffect(() => {
    if (open) {
      setPreviewState('loading');
      setFullscreenError(null);
    }
  }, [open, project?.id, projectUrl]);

  const handleFullscreen = async () => {
    const iframe = iframeRef.current;
    setFullscreenError(null);
    if (!iframe?.requestFullscreen) {
      setFullscreenError(
        '이 환경에서는 전체 화면을 지원하지 않습니다. 새 탭에서 열기를 이용해 주세요.'
      );
      return;
    }
    try {
      await iframe.requestFullscreen();
    } catch {
      setFullscreenError(
        '전체 화면을 열지 못했습니다. 새 탭에서 열기를 이용해 주세요.'
      );
    }
  };

  const close = () => {
    setFullscreenError(null);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) setFullscreenError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent
        hideClose
        aria-label={safeDialogLabel}
        title={safeDialogTitle}
        className='ui-dialog ui-project-modal'
        onOpenAutoFocus={() => {
          returnFocusRef.current =
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null;
        }}
        onCloseAutoFocus={event => {
          if (returnFocusRef.current?.isConnected) {
            event.preventDefault();
            returnFocusRef.current.focus();
          }
        }}
      >
        <div className='ui-project-modal-heading'>
          <div className='ui-project-modal-copy'>
            <DialogTitle className='ui-project-modal-title'>
              {safeProjectTitle}
            </DialogTitle>
            <DialogDescription className='ui-project-modal-description'>
              {normalizeProjectModalText(project?.description) ||
                '프로젝트 미리보기'}
            </DialogDescription>
          </div>
          <Button
            className='ui-control ui-project-modal-close'
            data-ui-variant='ghost'
            variant='ghost'
            size='icon'
            onClick={close}
            aria-label={safeCloseLabel}
          >
            <X aria-hidden='true' className='h-4 w-4' />
          </Button>
          <div className='ui-project-modal-actions'>
            {projectUrl && (
              <Button
                className='ui-control'
                data-ui-variant='outline'
                variant='outline'
                size='sm'
                asChild
              >
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
                className='ui-control'
                data-ui-variant='outline'
                variant='outline'
                size='sm'
                onClick={handleFullscreen}
                aria-label={`${safeFullscreenLabel}: ${safeProjectTitle}`}
              >
                <Maximize2 aria-hidden='true' className='h-4 w-4' />
                {safeFullscreenLabel}
              </Button>
            )}
          </div>
          {project?.type === 'embed' && projectUrl && (
            <p className='ui-project-modal-help'>
              미리보기가 표시되지 않으면 새 탭에서 열어 주세요.
            </p>
          )}
        </div>

        {fullscreenError && (
          <p className='ui-inline-error' role='alert'>
            {fullscreenError}
          </p>
        )}
        <div className='ui-project-modal-body'>
          {project?.type === 'console' ? (
            <AIConsole
              className='h-full rounded-none border-0 shadow-none'
              onClose={close}
            />
          ) : project?.type === 'embed' && projectUrl ? (
            <div className='ui-project-embed'>
              {previewState === 'loading' && (
                <div className='ui-project-preview-status' role='status'>
                  <span className='ui-spinner' aria-hidden='true' />
                  <span>미리보기를 불러오는 중입니다.</span>
                </div>
              )}
              {previewState === 'error' && (
                <p
                  className='ui-project-preview-status ui-inline-error'
                  role='alert'
                >
                  미리보기를 불러오지 못했습니다. 새 탭에서 열어 주세요.
                </p>
              )}
              <iframe
                ref={iframeRef}
                src={projectUrl}
                title={`${safeProjectTitle} preview`}
                className='h-full w-full border-0'
                loading='lazy'
                allow='clipboard-read; clipboard-write; fullscreen'
                allowFullScreen
                onLoad={() => setPreviewState('loaded')}
                onError={() => setPreviewState('error')}
              />
            </div>
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
