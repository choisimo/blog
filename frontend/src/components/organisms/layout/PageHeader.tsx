import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: ReactNode;
  id?: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
  level?: 1 | 2;
  className?: string;
}

export function PageHeader({ title, id, description, eyebrow, actions, level = 1, className }: PageHeaderProps) {
  const Heading = level === 1 ? 'h1' : 'h2';
  return (
    <div className={cn('ui-page-head', level === 2 && 'ui-page-head--section', className)}>
      <div className="ui-page-head__copy">
        {eyebrow && <p className="ui-page-head__eyebrow">{eyebrow}</p>}
        <Heading id={id} className="ui-page-head__title">{title}</Heading>
        {description && <p className="ui-page-head__description">{description}</p>}
      </div>
      {actions && <div className="ui-page-head__actions">{actions}</div>}
    </div>
  );
}
