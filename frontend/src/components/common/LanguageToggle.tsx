import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SupportedLanguage } from '@/types/blog';

const LABELS: Record<SupportedLanguage, string> = {
  ko: '한국어',
  en: 'EN',
};

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className='flex items-center gap-1' role='group' aria-label='Language toggle'>
      {(Object.keys(LABELS) as SupportedLanguage[]).map(lang => (
        <Button
          key={lang}
          type='button'
          variant={language === lang ? 'default' : 'ghost'}
          size='sm'
          className='px-3 text-xs'
          onClick={() => setLanguage(lang)}
          aria-pressed={language === lang}
        >
          {LABELS[lang]}
        </Button>
      ))}
      <span className='sr-only'>Current language: {LABELS[language]}</span>
    </div>
  );
}
