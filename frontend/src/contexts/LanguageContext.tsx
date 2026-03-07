import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { SupportedLanguage } from '@/types/blog';

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

const STORAGE_KEY = 'site.language';
const DEFAULT_LANGUAGE: SupportedLanguage = 'ko';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>(
    DEFAULT_LANGUAGE
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'ko' || stored === 'en') {
        setLanguageState(stored);
        return;
      }
      const browserLanguage = navigator.language?.toLowerCase() ?? '';
      if (browserLanguage.startsWith('en')) {
        setLanguageState('en');
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const value = event.newValue === 'en' ? 'en' : 'ko';
      setLanguageState(prev => (prev === value ? prev : value));
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const persistLanguage = (lang: SupportedLanguage) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage errors
    }
  };

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(prev => (prev === lang ? prev : lang));
    persistLanguage(lang);
  };

  const toggleLanguage = () => {
    const next = language === 'ko' ? 'en' : 'ko';
    setLanguageState(next);
    persistLanguage(next);
  };

  const value = useMemo(
    () => ({ language, setLanguage, toggleLanguage }),
    [language]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
