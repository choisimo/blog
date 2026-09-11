import { cn } from '@/lib/utils';
import type { DockAction } from '../types';
import { Ellipsis } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type DefaultDockProps = {
  dockActions: DockAction[];
  isMobile: boolean;
  isLeft?: boolean;
  language?: string;
  onMenuOpenChange?: (open: boolean) => void;
};

const ANSI_ESCAPE_PATTERN = /\u001B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
const DEFAULT_DOCK_CONTROL_TEXT_PATTERN =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function normalizeDockLabel(value: unknown, fallback = 'Action'): string {
  if (typeof value !== 'string') return fallback;
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(DEFAULT_DOCK_CONTROL_TEXT_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

export function DefaultDock({
  dockActions,
  isMobile,
  isLeft,
  language = 'ko',
  onMenuOpenChange,
}: DefaultDockProps) {
  if (isMobile) {
    const primaryActions = dockActions.filter(
      action => action.primary || action.key === 'chat' || action.key === 'memo'
    );
    const moreActions = dockActions.filter(
      action => !primaryActions.includes(action)
    );
    return (
      <div className='mobile-action-bar__items'>
        {primaryActions.map(action => {
          const Icon = action.icon;
          const label = normalizeDockLabel(action.label, action.key);
          return (
            <button
              key={action.key}
              type='button'
              className='mobile-action-bar__button'
              data-primary={action.primary || undefined}
              onClick={action.onClick}
              ref={action.triggerRef}
              disabled={action.disabled}
              aria-disabled={action.disabled}
              aria-label={label}
              title={normalizeDockLabel(
                action.title || action.desktopLabel || action.label,
                label
              )}
            >
              <Icon aria-hidden='true' focusable='false' />
              <span>{label}</span>
              {action.badge && (
                <span aria-hidden='true' className='mobile-action-bar__badge' />
              )}
            </button>
          );
        })}
        <button
          type='button'
          className='mobile-action-bar__button'
          aria-label={language === 'ko' ? '읽기 설정' : 'Reading settings'}
          onClick={() =>
            window.dispatchEvent(new Event('fieldnotes:reading-settings'))
          }
        >
          <span className='mobile-action-bar__settings' aria-hidden='true'>
            Aa
          </span>
        </button>
        {moreActions.length > 0 && (
          <DropdownMenu modal={false} onOpenChange={onMenuOpenChange}>
            <DropdownMenuTrigger asChild>
              <button
                type='button'
                className='mobile-action-bar__button'
                aria-label={language === 'ko' ? '더 많은 도구' : 'More tools'}
                ref={moreActions.find(action => action.triggerRef)?.triggerRef}
              >
                <Ellipsis aria-hidden='true' />
                {moreActions.some(action => action.badge) && (
                  <span
                    aria-hidden='true'
                    className='mobile-action-bar__badge'
                  />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side='top' align='end'>
              {moreActions.map(action => {
                const Icon = action.icon;
                return (
                  <DropdownMenuItem
                    key={action.key}
                    disabled={action.disabled}
                    onSelect={action.onClick}
                    title={
                      action.title
                        ? normalizeDockLabel(action.title)
                        : undefined
                    }
                  >
                    <Icon aria-hidden='true' />
                    {normalizeDockLabel(
                      action.desktopLabel || action.label,
                      action.key
                    )}
                    {action.disabled && action.title && (
                      <span className='sr-only'>
                        {normalizeDockLabel(action.title)}
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex items-center justify-center backdrop-blur-xl',
        isLeft
          ? 'flex-col w-auto rounded-[20px] border border-white/20 bg-background/75 px-2 py-3 shadow-[4px_0_24px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-background/65'
          : 'w-auto max-w-full rounded-[28px] border border-white/20 bg-background/75 px-4 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.08),_0_2px_8px_rgba(0,0,0,0.04)] dark:border-white/10 dark:bg-background/65 dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]'
      )}
    >
      {isLeft ? (
        // PC Left sidebar: vertical icon-only pill
        <div className='flex flex-col items-center gap-1 py-1'>
          {dockActions.map(action => {
            const Icon = action.icon;
            const displayLabel = normalizeDockLabel(
              action.desktopLabel || action.label,
              action.key
            );
            const title = normalizeDockLabel(
              action.title || action.desktopLabel || action.label,
              displayLabel
            );
            return (
              <button
                key={action.key}
                type='button'
                onClick={action.onClick}
                ref={action.triggerRef}
                disabled={action.disabled}
                aria-disabled={action.disabled}
                aria-label={displayLabel}
                title={title}
                className={cn(
                  'group relative flex items-center justify-center rounded-xl p-3 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 hover:scale-105',
                  action.primary
                    ? 'bg-gradient-to-b from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30'
                    : 'text-foreground/75 hover:bg-muted/70 hover:text-foreground dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white'
                )}
              >
                <Icon
                  aria-hidden='true'
                  className='h-5 w-5'
                  focusable='false'
                />
                {action.badge && (
                  <span
                    className='absolute -top-0.5 -right-0.5 inline-flex h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse'
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        // PC: Premium hover effects and labels
        <div className='flex flex-wrap items-center justify-center gap-2'>
          {dockActions.map(action => {
            const Icon = action.icon;
            const displayLabel = normalizeDockLabel(
              action.desktopLabel || action.label,
              action.key
            );
            const title = normalizeDockLabel(
              action.title || action.desktopLabel || action.label,
              displayLabel
            );
            return (
              <button
                key={action.key}
                type='button'
                onClick={action.onClick}
                ref={action.triggerRef}
                disabled={action.disabled}
                aria-label={displayLabel}
                aria-disabled={action.disabled}
                title={title}
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-2xl px-4 py-2.5 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
                  action.primary
                    ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 hover:scale-[1.02]'
                    : 'text-foreground/75 hover:bg-muted/70 hover:text-foreground dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white'
                )}
              >
                <Icon
                  aria-hidden='true'
                  className={cn(
                    'h-[18px] w-[18px]',
                    action.primary && 'text-primary-foreground'
                  )}
                  focusable='false'
                />
                <span
                  className={cn(
                    'text-sm font-medium tracking-wide',
                    action.primary
                      ? 'text-primary-foreground'
                      : 'text-foreground/80 dark:text-white/80'
                  )}
                >
                  {displayLabel}
                </span>
                {action.badge && (
                  <span
                    className='absolute -top-1 -right-1 inline-flex h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse'
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
