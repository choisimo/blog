import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SupportedLanguage } from '@/types/blog';
import { Globe } from 'lucide-react';

const LABELS: Record<SupportedLanguage, string> = {
  ko: '한국어',
  en: 'EN',
};

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          aria-label={`언어 변경: 현재 ${LABELS[language]}`}
          className='h-9 w-9'
        >
          <Globe className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-32 text-sm'>
        {(Object.keys(LABELS) as SupportedLanguage[]).map(lang => (
          <DropdownMenuItem
            key={lang}
            onSelect={() => setLanguage(lang)}
            aria-checked={language === lang}
            className='flex items-center justify-between'
          >
            <span>{LABELS[lang]}</span>
            {language === lang && <span className='text-primary text-xs'>•</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
