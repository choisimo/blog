import type React from 'react';
import { useId } from 'react';

export interface AdminSubtabsTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface AdminSubtabsProps<T extends string = string> {
  tabs: readonly AdminSubtabsTab[] | AdminSubtabsTab[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  renderTab?: (tab: AdminSubtabsTab, isActive: boolean) => React.ReactNode;
  className?: string;
  ariaLabel?: string;
  title?: string;
}

const DEFAULT_ADMIN_SUBTABS_LABEL = 'Admin section tabs';
const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;

function normalizeAdminSubtabId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (
    !normalized ||
    /[\u0000-\u001F\u007F/\\]/.test(normalized) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c)/i.test(normalized) ||
    !/^[a-z0-9-]+$/.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function normalizeAdminSubtabLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value
    .replace(ANSI_ESCAPE_PATTERN, ' ')
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized ? normalized.slice(0, 120) : null;
}

function normalizeOptionalAdminSubtabText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  return normalizeAdminSubtabLabel(String(value)) ?? undefined;
}

export function AdminSubtabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  renderTab,
  className,
  ariaLabel = DEFAULT_ADMIN_SUBTABS_LABEL,
  title,
}: AdminSubtabsProps<T>) {
  const tabListId = useId();
  const safeAriaLabel =
    normalizeOptionalAdminSubtabText(ariaLabel) ?? DEFAULT_ADMIN_SUBTABS_LABEL;
  const safeTitle = normalizeOptionalAdminSubtabText(title);
  const normalizedTabs = tabs.flatMap(tab => {
    const id = normalizeAdminSubtabId(tab.id);
    const label = normalizeAdminSubtabLabel(tab.label);
    return id && label ? [{ ...tab, id, label }] : [];
  });
  const normalizedActiveTab = normalizeAdminSubtabId(activeTab);
  const activeIndex = Math.max(
    0,
    normalizedTabs.findIndex(tab => normalizedActiveTab === tab.id),
  );

  const emitTabChange = (tabId: string) => {
    const normalizedTabId = normalizeAdminSubtabId(tabId);
    if (!normalizedTabId || normalizedTabId === normalizedActiveTab) return;
    onTabChange(normalizedTabId as T);
  };

  const moveToTab = (index: number, container: HTMLElement | null) => {
    const nextTab = normalizedTabs[index];
    if (!nextTab) return;

    emitTabChange(nextTab.id);

    const focusNextButton = () => {
      const nextButton = container?.querySelectorAll<HTMLButtonElement>(
        '[data-admin-subtab]',
      )[index];
      nextButton?.focus();
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(focusNextButton);
    } else {
      setTimeout(focusNextButton, 0);
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const lastIndex = normalizedTabs.length - 1;
    if (lastIndex < 0) return;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      moveToTab(
        index >= lastIndex ? 0 : index + 1,
        event.currentTarget.parentElement,
      );
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveToTab(
        index <= 0 ? lastIndex : index - 1,
        event.currentTarget.parentElement,
      );
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      moveToTab(0, event.currentTarget.parentElement);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      moveToTab(lastIndex, event.currentTarget.parentElement);
    }
  };

  return (
    <div
      role="tablist"
      aria-label={safeAriaLabel}
      aria-orientation="horizontal"
      title={safeTitle}
      className={`flex items-center gap-0.5 border-b border-zinc-100 dark:border-zinc-800 px-2 pt-1 overflow-x-auto scrollbar-hide${className ? ` ${className}` : ''}`}
    >
      {normalizedTabs.map((tab, index) => {
        const isActive = normalizedActiveTab === tab.id;
        const tabId = `${tabListId}-${tab.id}`;
        return (
          <button
            type="button"
            key={tab.id}
            id={tabId}
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            tabIndex={isActive || (activeIndex === 0 && index === 0) ? 0 : -1}
            data-admin-subtab
            onClick={() => emitTabChange(tab.id)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={`flex min-h-[44px] items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 ${
              isActive
                ? 'border-zinc-900 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            }`}
          >
            {renderTab ? renderTab(tab, isActive) : (
              <>
                {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
                {tab.label}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
