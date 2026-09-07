import type { HomeMarkdownCtaProps } from './home.types';
import { Link } from 'react-router-dom';
import { SafeDescriptionMarkdown } from '@/components/features/blog/SafeDescriptionMarkdown';
import { DEFAULT_HOME_AI_CTA_BLOCK } from '@/services/content/site-content';
import { cn } from '@/lib/utils';
import { ContentStatus } from '@/components/molecules/ContentStatus';

const ANSI_ESCAPE_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;
const CONTROL_TEXT_DETECTOR = /[\u0000-\u001f\u007f-\u009f]/;
const MARKDOWN_CONTROL_TEXT_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const EXTERNAL_CTA_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

type NormalizedCtaHref = {
  href: string;
  isExternal: boolean;
};

function sanitizeDisplayText(value: unknown): string {
  return String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
}

function sanitizeMarkdownText(value: unknown): string {
  return String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(MARKDOWN_CONTROL_TEXT_PATTERN, '')
    .trim();
}

function normalizeHrefInput(value: unknown): string | null {
  const href = String(value ?? '').replace(ANSI_ESCAPE_PATTERN, '').trim();
  if (!href || CONTROL_TEXT_DETECTOR.test(href) || href.includes('\\')) {
    return null;
  }

  let decodedHref: string;
  try {
    decodedHref = decodeURIComponent(href);
  } catch {
    return null;
  }

  if (CONTROL_TEXT_DETECTOR.test(decodedHref) || decodedHref.includes('\\')) {
    return null;
  }

  return href;
}

function containsTraversalPathSegment(path: string): boolean {
  return path.split('/').some(segment => segment === '.' || segment === '..');
}

function normalizeCtaHref(value: unknown): NormalizedCtaHref | null {
  const href = normalizeHrefInput(value);
  if (!href) return null;

  if (href.startsWith('/')) {
    if (href.startsWith('//')) return null;

    const decodedPath = decodeURIComponent(href).split(/[?#]/, 1)[0] || '/';
    if (containsTraversalPathSegment(decodedPath)) return null;

    return { href, isExternal: false };
  }

  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }

  if (!EXTERNAL_CTA_PROTOCOLS.has(url.protocol)) return null;
  if (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    (url.username || url.password)
  ) {
    return null;
  }

  return { href, isExternal: true };
}

export function HomeMarkdownCta({
  block,
  state,
  isTerminal,
}: HomeMarkdownCtaProps) {
  const content = block ?? DEFAULT_HOME_AI_CTA_BLOCK;
  if (!content.enabled) return null;

  const rawCtaHref = content.ctaHref || DEFAULT_HOME_AI_CTA_BLOCK.ctaHref;
  const ctaHref = normalizeCtaHref(rawCtaHref);
  const ctaLabel = sanitizeDisplayText(
    content.ctaLabel || DEFAULT_HOME_AI_CTA_BLOCK.ctaLabel
  );
  const markdown = sanitizeMarkdownText(content.markdown);

  return (
    <section className={cn('ui-home-cta', isTerminal && 'font-mono')} aria-label="블로그 안내">
      <div>
        {state === 'loading' && !block ? <ContentStatus kind="loading">안내를 불러오는 중입니다.</ContentStatus>
          : <SafeDescriptionMarkdown text={markdown} className="ui-home-cta__text" />}
      </div>
      {ctaHref && ctaLabel && (
        ctaHref.isExternal ? <a href={ctaHref.href} target="_blank" rel="noopener noreferrer" className="ui-inline-link">{ctaLabel}</a>
          : <Link to={ctaHref.href} className="ui-inline-link">{ctaLabel}</Link>
      )}
    </section>
  );
}
