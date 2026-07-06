import { Calendar, Clock } from 'lucide-react';

interface DateDisplayProps {
  date: string;
  showIcon?: boolean;
  className?: string;
  label?: string;
  title?: string;
}

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const CONTROL_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;

function sanitizeDisplayText(value: unknown): string {
  return String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(CONTROL_TEXT_PATTERN, '')
    .trim();
}

function sanitizeOptionalDisplayText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeDisplayText(value);

  return sanitized.length > 0 ? sanitized : undefined;
}

function normalizeReadTime(value: unknown): number {
  const numericValue =
    typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(numericValue) || numericValue < 0) return 0;
  return Math.round(numericValue);
}

export function DateDisplay({
  date,
  showIcon = true,
  className = '',
  label,
  title,
}: DateDisplayProps) {
  const safeDate = sanitizeDisplayText(date);

  return (
    <div
      className={`flex items-center text-sm text-muted-foreground ${className}`}
      aria-label={sanitizeOptionalDisplayText(label)}
      title={sanitizeOptionalDisplayText(title)}
    >
      {showIcon && <Calendar className='h-3 w-3 mr-1' aria-hidden='true' />}
      {safeDate}
    </div>
  );
}

interface ReadTimeProps {
  readTime: number;
  showIcon?: boolean;
  className?: string;
  label?: string;
  title?: string;
}

export function ReadTime({
  readTime,
  showIcon = true,
  className = '',
  label,
  title,
}: ReadTimeProps) {
  const safeReadTime = normalizeReadTime(readTime);

  return (
    <div
      className={`flex items-center text-sm text-muted-foreground ${className}`}
      aria-label={sanitizeOptionalDisplayText(label)}
      title={sanitizeOptionalDisplayText(title)}
    >
      {showIcon && <Clock className='h-3 w-3 mr-1' aria-hidden='true' />}
      {safeReadTime} min read
    </div>
  );
}
