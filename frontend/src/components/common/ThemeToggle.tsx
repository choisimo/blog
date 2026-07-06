import { Moon, Sun, Monitor, Terminal } from 'lucide-react';
import { TouchIconButton } from '@/components/atoms/TouchIconButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
  labels?: Partial<Record<ThemeMode, string>>;
  triggerLabel?: string;
}

type ThemeMode = 'light' | 'dark' | 'system' | 'terminal';

const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system', 'terminal'];
const DEFAULT_TRIGGER_LABEL = 'Toggle theme';
const DEFAULT_THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  terminal: 'Terminal',
};
const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeThemeToggleText = (value: string): string =>
  value.replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_TEXT_PATTERN, '').trim();

function normalizeTheme(value: unknown): ThemeMode {
  return value === 'light' ||
    value === 'dark' ||
    value === 'system' ||
    value === 'terminal'
    ? value
    : 'system';
}

function resolveThemeLabels(
  labels: ThemeToggleProps['labels']
): Record<ThemeMode, string> {
  return {
    light:
      sanitizeThemeToggleText(labels?.light ?? DEFAULT_THEME_LABELS.light) ||
      DEFAULT_THEME_LABELS.light,
    dark:
      sanitizeThemeToggleText(labels?.dark ?? DEFAULT_THEME_LABELS.dark) ||
      DEFAULT_THEME_LABELS.dark,
    system:
      sanitizeThemeToggleText(labels?.system ?? DEFAULT_THEME_LABELS.system) ||
      DEFAULT_THEME_LABELS.system,
    terminal:
      sanitizeThemeToggleText(
        labels?.terminal ?? DEFAULT_THEME_LABELS.terminal
      ) || DEFAULT_THEME_LABELS.terminal,
  };
}

export function ThemeToggle({
  className,
  labels,
  triggerLabel = DEFAULT_TRIGGER_LABEL,
}: ThemeToggleProps) {
  const { theme, setTheme, isTerminal } = useTheme();
  const safeTheme = normalizeTheme(theme);
  const displayLabels = resolveThemeLabels(labels);
  const sanitizedTriggerLabel =
    sanitizeThemeToggleText(triggerLabel) || DEFAULT_TRIGGER_LABEL;

  const handleThemeChange = (newTheme: ThemeMode) => {
    setTheme(newTheme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TouchIconButton
          variant='ghost'
          className={cn(
            'h-9 w-9',
            isTerminal && 'text-primary hover:text-primary hover:bg-primary/10',
            className
          )}
          aria-label={sanitizedTriggerLabel}
        >
          {/* Light mode icon */}
          <Sun
            className={cn(
              'h-[1.2rem] w-[1.2rem] transition-all',
              safeTheme === 'terminal'
                ? 'rotate-90 scale-0'
                : 'rotate-0 scale-100 dark:-rotate-90 dark:scale-0'
            )}
          />
          {/* Dark mode icon */}
          <Moon
            className={cn(
              'absolute h-[1.2rem] w-[1.2rem] transition-all',
              safeTheme === 'terminal'
                ? 'rotate-90 scale-0'
                : 'rotate-90 scale-0 dark:rotate-0 dark:scale-100'
            )}
          />
          {/* Terminal mode icon */}
          <Terminal
            className={cn(
              'absolute h-[1.2rem] w-[1.2rem] transition-all',
              safeTheme === 'terminal'
                ? 'rotate-0 scale-100'
                : 'rotate-90 scale-0'
            )}
          />
          <span className='sr-only'>{sanitizedTriggerLabel}</span>
        </TouchIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align='end'
        className={cn(
          isTerminal && 'border-primary/40 bg-background/95 backdrop-blur'
        )}
      >
        {THEME_MODES.map(mode => {
          const Icon =
            mode === 'light'
              ? Sun
              : mode === 'dark'
                ? Moon
                : mode === 'system'
                  ? Monitor
                  : Terminal;

          return (
            <DropdownMenuItem
              key={mode}
              onClick={() => handleThemeChange(mode)}
              className={cn(
                safeTheme === mode &&
                  (mode === 'terminal' ? 'bg-primary/15' : 'bg-accent'),
                mode === 'terminal' && 'font-mono',
                isTerminal &&
                  'font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary'
              )}
              aria-checked={safeTheme === mode}
            >
              <Icon
                className={cn(
                  'mr-2 h-4 w-4',
                  mode === 'terminal' && safeTheme === 'terminal' && 'text-primary'
                )}
              />
              <span
                className={cn(
                  mode === 'terminal' && safeTheme === 'terminal' && 'text-primary'
                )}
              >
                {displayLabels[mode]}
              </span>
              {safeTheme === mode && (
                <span
                  className={cn(
                    'ml-auto',
                    (isTerminal || mode === 'terminal') && 'text-primary'
                  )}
                >
                  ✓
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ThemeToggle;
