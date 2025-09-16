import { Calendar, Clock } from 'lucide-react';

interface DateDisplayProps {
  date: string;
  showIcon?: boolean;
  className?: string;
}

export function DateDisplay({ date, showIcon = true, className = '' }: DateDisplayProps) {
  return (
    <div className={`flex items-center text-sm text-muted-foreground ${className}`}>
      {showIcon && <Calendar className="h-3 w-3 mr-1" />}
      {date}
    </div>
  );
}

interface ReadTimeProps {
  readTime: number;
  showIcon?: boolean;
  className?: string;
}

export function ReadTime({ readTime, showIcon = true, className = '' }: ReadTimeProps) {
  return (
    <div className={`flex items-center text-sm text-muted-foreground ${className}`}>
      {showIcon && <Clock className="h-3 w-3 mr-1" />}
      {readTime} min read
    </div>
  );
}