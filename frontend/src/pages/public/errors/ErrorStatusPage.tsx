import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, BookOpenText, Home, LifeBuoy } from 'lucide-react';
import type { ButtonProps } from '@/components/ui/button';
import { Button } from '@/components/ui/button';
import { site } from '@/config/site';

type Tone = 'amber' | 'sky' | 'rose' | 'violet' | 'emerald' | 'slate';

export interface ErrorStatusAction {
  label: string;
  icon?: LucideIcon;
  to?: string;
  href?: string;
  onClick?: () => void;
  variant?: ButtonProps['variant'];
}

export interface ErrorStatusPageProps {
  statusCode: number | string;
  label: string;
  title: string;
  description: string;
  hints: string[];
  icon: LucideIcon;
  tone?: Tone;
  actions?: ErrorStatusAction[];
  footer?: ReactNode;
}

export interface NormalizedErrorActionHref {
  href: string;
  external: boolean;
  opensNewTab: boolean;
}

export function normalizeErrorActionHref(
  value: string,
): NormalizedErrorActionHref | null {
  const href = value.trim();
  if (!href || /[\u0000-\u001F\u007F\s]/.test(href)) {
    return null;
  }

  if (href.startsWith("//")) {
    return null;
  }

  if (href.startsWith("/") || href.startsWith("#")) {
    return { href, external: false, opensNewTab: false };
  }

  const scheme = href.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
  if (!scheme) {
    return null;
  }

  const protocol = `${scheme[1].toLowerCase()}:`;
  if (protocol === "mailto:") {
    return { href, external: true, opensNewTab: false };
  }

  if (protocol !== "http:" && protocol !== "https:") {
    return null;
  }

  try {
    const url = new URL(href);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return { href: url.href, external: true, opensNewTab: true };
  } catch {
    return null;
  }
}

function ErrorActionButton({ action }: { action: ErrorStatusAction }) {
  const Icon = action.icon ?? ArrowRight;
  const variant = action.variant ?? "default";

  if (action.to) {
    return (
      <Button
        className='ui-control'
        data-ui-variant={variant}
        asChild
        size='lg'
        variant={variant}
      >
        <Link to={action.to}>
          <Icon className='h-4 w-4 shrink-0' aria-hidden='true' />
          {action.label}
        </Link>
      </Button>
    );
  }

  if (action.href) {
    const normalizedHref = normalizeErrorActionHref(action.href);
    if (!normalizedHref) {
      return (
        <Button
          className='ui-control'
          data-ui-variant={variant}
          size='lg'
          variant={variant}
          onClick={action.onClick}
        >
          <Icon className='h-4 w-4 shrink-0' aria-hidden='true' />
          {action.label}
        </Button>
      );
    }

    return (
      <Button
        className='ui-control'
        data-ui-variant={variant}
        asChild
        size='lg'
        variant={variant}
      >
        <a
          href={normalizedHref.href}
          rel={normalizedHref.external ? 'noreferrer' : undefined}
          target={normalizedHref.opensNewTab ? '_blank' : undefined}
        >
          <Icon className='h-4 w-4 shrink-0' aria-hidden='true' />
          {action.label}
          {normalizedHref.opensNewTab && (
            <span className='sr-only'> · 새 탭</span>
          )}
        </a>
      </Button>
    );
  }

  return (
    <Button
      className='ui-control'
      data-ui-variant={variant}
      size='lg'
      variant={variant}
      onClick={action.onClick}
    >
      <Icon className='h-4 w-4 shrink-0' aria-hidden='true' />
      {action.label}
    </Button>
  );
}

export default function ErrorStatusPage({
  statusCode,
  label,
  title,
  description,
  hints,
  icon: Icon,
  tone = 'amber',
  actions = [],
  footer,
}: ErrorStatusPageProps) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const previousDescription = descriptionTag?.getAttribute("content") ?? null;

    document.title = `${statusCode} | nodove blog`;
    if (descriptionTag) {
      descriptionTag.setAttribute('content', description);
    }

    return () => {
      document.title = previousTitle;
      if (descriptionTag && previousDescription != null) {
        descriptionTag.setAttribute('content', previousDescription);
      }
    };
  }, [description, statusCode]);

  return (
    <div
      className='ui-page ui-error-page'
      data-ui-page={`error-${statusCode}`}
      data-tone={tone}
    >
      <section className='ui-error-content' aria-labelledby='error-page-title'>
        <div className='ui-error-meta'>
          <Icon className='h-5 w-5' aria-hidden='true' />
          <span>{label}</span>
          <code>{statusCode}</code>
        </div>
        <h1 id='error-page-title'>{title}</h1>
        <p className='ui-error-description'>{description}</p>
        {actions.length > 0 && (
          <div className='ui-error-actions'>
            {actions.map((action, index) => (
              <ErrorActionButton
                key={`${action.label}-${index}`}
                action={action}
              />
            ))}
          </div>
        )}
        <section className='ui-error-help' aria-label='다음에 할 수 있는 일'>
          <h2>다음에 할 수 있는 일</h2>
          <ul>
            {hints.map(hint => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </section>
        {footer && <div className='ui-error-footer'>{footer}</div>}
        <nav className='ui-error-navigation' aria-label='다른 페이지로 이동'>
          <Link to='/'>
            <Home className='h-4 w-4 shrink-0' aria-hidden='true' />
            홈으로
          </Link>
          <Link to='/blog'>
            <BookOpenText className='h-4 w-4 shrink-0' aria-hidden='true' />글
            목록 보기
          </Link>
          <a href={`mailto:${site.email}`}>
            <LifeBuoy className='h-4 w-4 shrink-0' aria-hidden='true' />
            문의하기
          </a>
        </nav>
      </section>
    </div>
  );
}
