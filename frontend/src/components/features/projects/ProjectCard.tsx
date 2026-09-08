import { ExternalLink, Eye, Github } from 'lucide-react';
import type { ProjectItem } from '@/types/project';

interface ProjectCardProps {
  project: ProjectItem;
  onPreview: (project: ProjectItem) => void;
  label?: string;
  title?: string;
  visitLabel?: string;
  codeLabel?: string;
  presentation?: 'card' | 'list';
  emphasized?: boolean;
  openExternally?: boolean;
}

const PROJECT_CARD_CONTROL_PATTERN = /[\u0000-\u001F\u007F]/g;
const PROJECT_CARD_CONTROL_TEST_PATTERN = /[\u0000-\u001F\u007F]/;
const PROJECT_CARD_ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const PROJECT_CARD_WHITESPACE_PATTERN = /\s+/g;
const PROJECT_CARD_ENCODED_CONTROL_PATTERN =
  /%(?:0[0-9A-Fa-f]|1[0-9A-Fa-f]|7[Ff])/;
const DEFAULT_CARD_LABEL = 'Project card';
const DEFAULT_VISIT_LABEL = 'Visit';
const DEFAULT_CODE_LABEL = 'Code';

export function normalizeProjectCardText(
  value: unknown,
  fallback = ''
): string {
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
  return `ui-project-status ui-project-status--${normalized === 'live' ? 'live' : normalized === 'archive' ? 'archive' : 'draft'}`;
}

const previewLabel: Record<ProjectItem['type'], string> = {
  console: '콘솔 열기',
  embed: '미리보기',
  link: '서비스 열기',
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
  presentation = 'card',
  emphasized = false,
  openExternally = false,
}: ProjectCardProps) {
  const projectUrl = normalizeProjectCardUrl(project.url);
  const codeUrl = normalizeProjectCardUrl(project.codeUrl);
  const thumbnailUrl = normalizeProjectCardUrl(project.thumbnail);
  const safeLabel = normalizeProjectCardText(label, DEFAULT_CARD_LABEL);
  const safeTitle = normalizeProjectCardText(project.title, 'Untitled project');
  const safeDescription = normalizeProjectCardText(project.description);
  const safeCategory = normalizeProjectCardText(project.category, 'Project');
  const safeStatus = normalizeProjectCardText(project.status, 'draft');
  const tags = [
    ...new Set(
      project.tags.map(tag => normalizeProjectCardText(tag)).filter(Boolean)
    ),
  ];
  const safeVisitLabel = normalizeProjectCardText(
    visitLabel,
    DEFAULT_VISIT_LABEL
  );
  const safeCodeLabel = normalizeProjectCardText(codeLabel, DEFAULT_CODE_LABEL);
  const previewAllowed = project.type === 'console' || !!projectUrl;
  const directLink = project.type === 'link' || openExternally;
  const safePreviewLabel = directLink
    ? safeVisitLabel
    : (previewLabel[project.type] ?? '미리보기');
  const actionClassName = emphasized
    ? 'ui-control'
    : 'ui-project-preview-button';

  return (
    <article
      className={`ui-project-item ui-project-item--${presentation}${emphasized ? ' ui-project-item--featured' : ''}`}
      aria-label={`${safeLabel}: ${safeTitle}`}
      title={normalizeOptionalProjectCardText(title)}
    >
      {thumbnailUrl && (
        <div className='ui-project-thumbnail'>
          <img
            src={thumbnailUrl}
            alt={`${safeTitle} 미리보기`}
            loading='lazy'
            onError={event => {
              event.currentTarget.hidden = true;
              event.currentTarget.parentElement?.setAttribute('hidden', '');
            }}
          />
        </div>
      )}
      <div className='ui-project-item-content'>
        <div className='ui-project-meta'>
          <span>{safeCategory}</span>
          <span className={getStatusClassName(safeStatus)}>{safeStatus}</span>
          {emphasized && (
            <span className='ui-project-recommended'>주목할 프로젝트</span>
          )}
        </div>
        <h3 className='ui-project-item-title'>{safeTitle}</h3>
        {safeDescription && (
          <p className='ui-project-item-description'>{safeDescription}</p>
        )}
        {tags.length > 0 && (
          <div className='ui-project-technologies' aria-label='기술과 주제'>
            {tags.slice(0, 6).map(tag => (
              <span key={tag}>{tag}</span>
            ))}
            {tags.length > 6 && (
              <details>
                <summary>기술 {tags.length - 6}개 더 보기</summary>
                <div>
                  {tags.slice(6).map(tag => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
        <div className='ui-project-item-actions'>
          {directLink && projectUrl ? (
            <a
              href={projectUrl}
              target='_blank'
              rel='noopener noreferrer'
              className={actionClassName}
              data-ui-variant={emphasized ? 'default' : undefined}
              aria-label={`${safePreviewLabel}: ${safeTitle} · 새 탭`}
            >
              <ExternalLink size={16} aria-hidden='true' />
              {safePreviewLabel}
              <span className='sr-only'> · 새 탭</span>
            </a>
          ) : (
            <button
              type='button'
              className={actionClassName}
              data-ui-variant={emphasized ? 'default' : undefined}
              disabled={!previewAllowed}
              onClick={() => onPreview(project)}
              aria-label={`${safePreviewLabel}: ${safeTitle}`}
            >
              <Eye size={16} aria-hidden='true' />
              {safePreviewLabel}
            </button>
          )}
          {projectUrl && !directLink && (
            <a
              href={projectUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='ui-project-text-link'
              aria-label={`${safeVisitLabel}: ${safeTitle} · 새 탭`}
            >
              <ExternalLink aria-hidden='true' size={15} />
              {safeVisitLabel}
              <span className='sr-only'> · 새 탭</span>
            </a>
          )}
          {codeUrl && (
            <a
              href={codeUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='ui-project-text-link'
              aria-label={`${safeCodeLabel}: ${safeTitle} · 새 탭`}
            >
              <Github aria-hidden='true' size={15} />
              {safeCodeLabel}
              <span className='sr-only'> · 새 탭</span>
            </a>
          )}
          {!previewAllowed && (
            <span className='ui-project-unavailable'>
              공개 주소가 아직 없습니다.
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
