import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from '@/hooks/use-toast';

type Theme = 'light' | 'dark' | 'system' | 'terminal';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isTerminal: boolean;
}

const THEME_LABELS: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
  terminal: 'Terminal',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme || 'light';
  });
  const isInitialMount = useRef(true);

  const isTerminal = theme === 'terminal';

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);

    // Show toast notification on theme change (not on initial mount)
    if (!isInitialMount.current) {
      const label = THEME_LABELS[newTheme];
      if (newTheme === 'terminal') {
        toast({
          title: `>_ ${label} mode activated`,
          description: 'Welcome to the matrix',
        });
      } else {
        toast({
          title: `Theme: ${label}`,
          description: `Switched to ${label.toLowerCase()} mode`,
        });
      }
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'terminal');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else if (theme === 'terminal') {
      // Terminal uses dark as base with additional terminal class
      root.classList.add('dark', 'terminal');
    } else {
      root.classList.add(theme);
    }

    localStorage.setItem('theme', theme);

    // Mark initial mount as complete after first theme application
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark', 'terminal');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isTerminal }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
