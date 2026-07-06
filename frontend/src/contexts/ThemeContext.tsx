import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "@/hooks/ui/use-toast";

type Theme = "light" | "dark" | "system" | "terminal";

const VALID_THEMES: Theme[] = ["light", "dark", "system", "terminal"];
const FALLBACK_THEME: Theme = "light";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isTerminal: boolean;
}

const THEME_LABELS: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
  terminal: "Terminal",
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const normalizeTheme = (value: unknown): Theme | undefined => {
  return typeof value === "string" && VALID_THEMES.includes(value as Theme)
    ? (value as Theme)
    : undefined;
};

const getThemeStorage = (): Storage | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

const readStoredTheme = (): Theme | undefined => {
  const storage = getThemeStorage();
  if (!storage) return undefined;

  try {
    return normalizeTheme(storage.getItem("theme"));
  } catch {
    return undefined;
  }
};

const readMetaDefaultTheme = (): Theme | undefined => {
  if (typeof document === "undefined") return undefined;

  return normalizeTheme(
    document.querySelector<HTMLMetaElement>('meta[name="theme-default"]')
      ?.content,
  );
};

const persistTheme = (theme: Theme) => {
  const storage = getThemeStorage();
  if (!storage) return;

  try {
    storage.setItem("theme", theme);
  } catch {
    // Ignore storage write failures so theme rendering remains available.
  }
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return readStoredTheme() ?? readMetaDefaultTheme() ?? FALLBACK_THEME;
  });
  const isInitialMount = useRef(true);

  const isTerminal = theme === "terminal";

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);

    // Show toast notification on theme change (not on initial mount)
    if (!isInitialMount.current) {
      const label = THEME_LABELS[newTheme];
      if (newTheme === "terminal") {
        toast({
          title: `>_ ${label} mode activated`,
          description: "Welcome to the matrix",
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
    root.classList.remove("light", "dark", "terminal");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else if (theme === "terminal") {
      // Terminal uses dark as base with additional terminal class
      root.classList.add("dark", "terminal");
    } else {
      root.classList.add(theme);
    }

    persistTheme(theme);

    // Mark initial mount as complete after first theme application
    if (isInitialMount.current) {
      isInitialMount.current = false;
    }
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark", "terminal");
        root.classList.add(mediaQuery.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
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
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
