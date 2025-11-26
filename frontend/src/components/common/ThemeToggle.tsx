import { Moon, Sun, Monitor, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, setTheme, isTerminal } = useTheme();

  const handleThemeChange = (
    newTheme: 'light' | 'dark' | 'system' | 'terminal'
  ) => {
    setTheme(newTheme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className={cn(
            'h-9 w-9',
            isTerminal && 'text-primary hover:text-primary hover:bg-primary/10',
            className
          )}
          aria-label='Toggle theme'
        >
          {/* Light mode icon */}
          <Sun
            className={cn(
              'h-[1.2rem] w-[1.2rem] transition-all',
              theme === 'terminal'
                ? 'rotate-90 scale-0'
                : 'rotate-0 scale-100 dark:-rotate-90 dark:scale-0'
            )}
          />
          {/* Dark mode icon */}
          <Moon
            className={cn(
              'absolute h-[1.2rem] w-[1.2rem] transition-all',
              theme === 'terminal'
                ? 'rotate-90 scale-0'
                : 'rotate-90 scale-0 dark:rotate-0 dark:scale-100'
            )}
          />
          {/* Terminal mode icon */}
          <Terminal
            className={cn(
              'absolute h-[1.2rem] w-[1.2rem] transition-all',
              theme === 'terminal'
                ? 'rotate-0 scale-100'
                : 'rotate-90 scale-0'
            )}
          />
          <span className='sr-only'>Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuItem
          onClick={() => handleThemeChange('light')}
          className={cn(theme === 'light' && 'bg-accent')}
        >
          <Sun className='mr-2 h-4 w-4' />
          <span>Light</span>
          {theme === 'light' && <span className='ml-auto'>✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleThemeChange('dark')}
          className={cn(theme === 'dark' && 'bg-accent')}
        >
          <Moon className='mr-2 h-4 w-4' />
          <span>Dark</span>
          {theme === 'dark' && <span className='ml-auto'>✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleThemeChange('system')}
          className={cn(theme === 'system' && 'bg-accent')}
        >
          <Monitor className='mr-2 h-4 w-4' />
          <span>System</span>
          {theme === 'system' && <span className='ml-auto'>✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleThemeChange('terminal')}
          className={cn(
            theme === 'terminal' && 'bg-accent',
            'font-mono'
          )}
        >
          <Terminal
            className={cn(
              'mr-2 h-4 w-4',
              theme === 'terminal' && 'text-primary'
            )}
          />
          <span className={cn(theme === 'terminal' && 'text-primary')}>
            Terminal
          </span>
          {theme === 'terminal' && (
            <span className='ml-auto text-primary'>✓</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ThemeToggle;
