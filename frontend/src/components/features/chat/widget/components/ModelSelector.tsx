import React from 'react';
import { ChevronDown, Cpu, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { AIModel } from '../hooks/useModels';

type ModelSelectorProps = {
  models: AIModel[];
  modelsByProvider: Record<string, AIModel[]>;
  selectedModel: string;
  currentModel?: AIModel;
  loading: boolean;
  error: string | null;
  onSelect: (modelId: string) => void;
  onRefresh: () => void;
  isMobile?: boolean;
  isTerminal?: boolean;
  disabled?: boolean;
};

// Provider icons/colors
const providerStyles: Record<string, { color: string; bgColor: string }> = {
  Google: { color: 'text-blue-600', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  OpenAI: { color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  Anthropic: { color: 'text-orange-600', bgColor: 'bg-orange-100 dark:bg-orange-900/30' },
  Local: { color: 'text-purple-600', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  Alias: { color: 'text-gray-500', bgColor: 'bg-gray-100 dark:bg-gray-800/50' },
};

function getProviderStyle(provider: string) {
  return providerStyles[provider] || { color: 'text-gray-600', bgColor: 'bg-gray-100' };
}

export function ModelSelector({
  models,
  modelsByProvider,
  selectedModel,
  currentModel,
  loading,
  error,
  onSelect,
  onRefresh,
  isMobile = false,
  isTerminal = false,
  disabled = false,
}: ModelSelectorProps) {
  const providerOrder = ['Google', 'OpenAI', 'Anthropic', 'Local', 'Alias'];
  const sortedProviders = Object.keys(modelsByProvider).sort((a, b) => {
    const aIndex = providerOrder.indexOf(a);
    const bIndex = providerOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const displayName = currentModel?.name || selectedModel || 'Select Model';
  const displayProvider = currentModel?.provider;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || loading}
          className={cn(
            'h-7 px-2 gap-1.5 text-xs font-normal',
            isTerminal && 'font-mono text-primary hover:bg-primary/10',
            isMobile && 'h-8 px-3'
          )}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Cpu className="h-3 w-3" />
          )}
          <span className="max-w-[100px] truncate">
            {displayName}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className={cn(
          'w-56 max-h-80 overflow-y-auto z-[9999]',
          isTerminal && 'font-mono'
        )}
      >
        {/* Error state */}
        {error && (
          <>
            <div className="px-2 py-1.5 text-xs text-destructive">
              {error}
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Grouped models by provider */}
        {sortedProviders.map((provider, idx) => {
          const providerModels = modelsByProvider[provider];
          if (!providerModels?.length) return null;

          const style = getProviderStyle(provider);

          return (
            <React.Fragment key={provider}>
              {idx > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {provider}
              </DropdownMenuLabel>
              {providerModels.map((model) => (
                <DropdownMenuItem
                  key={model.id}
                  onSelect={() => onSelect(model.id)}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer',
                    selectedModel === model.id && 'bg-accent'
                  )}
                >
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      style.bgColor
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm">{model.name}</span>
                      {model.isDefault && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary shrink-0">
                          default
                        </span>
                      )}
                    </div>
                    {model.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {model.description}
                      </p>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </React.Fragment>
          );
        })}

        {/* Refresh button */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onRefresh();
          }}
          className="flex items-center gap-2 text-muted-foreground"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          <span className="text-xs">Refresh models</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
