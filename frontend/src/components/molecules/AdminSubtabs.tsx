import type React from 'react';

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
}

export function AdminSubtabs<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  renderTab,
  className,
}: AdminSubtabsProps<T>) {
  return (
    <div
      className={`flex items-center gap-0.5 border-b border-zinc-100 dark:border-zinc-800 px-2 pt-1 overflow-x-auto scrollbar-hide${className ? ` ${className}` : ''}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            type="button"
            key={tab.id}
            onClick={() => onTabChange(tab.id as T)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-all outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-400 ${
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
