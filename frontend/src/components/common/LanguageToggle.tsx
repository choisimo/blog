import { TouchIconButton } from '@/components/atoms/TouchIconButton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import type { SupportedLanguage } from '@/types/blog';
import { Globe } from 'lucide-react';

type LanguageToggleProps = {
  labels?: Partial<Record<SupportedLanguage, string>>;
};

const DEFAULT_LABELS: Record<SupportedLanguage, string> = {
  ko: '한국어',
  en: 'EN',
};

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

const sanitizeLanguageToggleText = (value: string): string =>
  value.replace(ANSI_ESCAPE_PATTERN, '').replace(CONTROL_TEXT_PATTERN, '').trim();

function normalizeLanguage(value: unknown): SupportedLanguage {
  return value === 'ko' || value === 'en' ? value : 'ko';
}

function resolveLanguageLabels(
  labels: LanguageToggleProps['labels']
): Record<SupportedLanguage, string> {
  return {
    ko:
      sanitizeLanguageToggleText(labels?.ko ?? DEFAULT_LABELS.ko) ||
      DEFAULT_LABELS.ko,
    en:
      sanitizeLanguageToggleText(labels?.en ?? DEFAULT_LABELS.en) ||
      DEFAULT_LABELS.en,
  };
}

export function LanguageToggle({ labels }: LanguageToggleProps = {}) {
  const { language, setLanguage } = useLanguage();
  const safeLanguage = normalizeLanguage(language);
  const displayLabels = resolveLanguageLabels(labels);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <TouchIconButton
          type='button'
          variant='ghost'
          aria-label={`언어 변경: 현재 ${displayLabels[safeLanguage]}`}
          className='h-9 w-9'
        >
          <Globe className='h-4 w-4' />
        </TouchIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-32 text-sm'>
        {(Object.keys(DEFAULT_LABELS) as SupportedLanguage[]).map(lang => (
          <DropdownMenuItem
            key={lang}
            onSelect={() => setLanguage(lang)}
            aria-checked={safeLanguage === lang}
            className='flex items-center justify-between'
          >
            <span>{displayLabels[lang]}</span>
            {safeLanguage === lang && (
              <span className='text-primary text-xs'>•</span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
