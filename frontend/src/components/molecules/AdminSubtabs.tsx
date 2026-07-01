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
}

export function AdminSubtabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  renderTab,
  className,
  ariaLabel = 'Admin section tabs',
}: AdminSubtabsProps<T>) {
  const tabListId = useId();
  const activeIndex = Math.max(
    0,
    tabs.findIndex(tab => activeTab === tab.id),
  );

  const moveToTab = (index: number, container: HTMLElement | null) => {
    const nextTab = tabs[index];
    if (!nextTab) return;

    onTabChange(nextTab.id as T);

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
    const lastIndex = tabs.length - 1;
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
      aria-label={ariaLabel}
      aria-orientation="horizontal"
      className={`flex items-center gap-0.5 border-b border-zinc-100 dark:border-zinc-800 px-2 pt-1 overflow-x-auto scrollbar-hide${className ? ` ${className}` : ''}`}
    >
      {tabs.map((tab, index) => {
        const isActive = activeTab === tab.id;
        const tabId = `${tabListId}-${tab.id}`;
        return (
          <button
            type="button"
            key={tab.id}
            id={tabId}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive || (activeIndex === 0 && index === 0) ? 0 : -1}
            data-admin-subtab
            onClick={() => onTabChange(tab.id as T)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={`flex min-h-[44px] items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 ${
              isActive
                ? 'border-zinc-900 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100'
                : 'border-transparent text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            }`}
          >
            {renderTab ? renderTab(tab, isActive) : (
              <>
                {tab.icon}
                {tab.label}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
