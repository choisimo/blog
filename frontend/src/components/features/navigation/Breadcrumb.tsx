import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const lastIndex = items.length - 1;

  return (
    <nav
      aria-label='Breadcrumb'
      className={cn(
        'flex items-center space-x-1 text-sm text-muted-foreground',
        className
      )}
    >
      <Link to='/' className='hover:text-foreground transition-colors' aria-label='Home'>
        <Home className='h-4 w-4' />
      </Link>
      {items.map((item, index) => {
        const isCurrent = index === lastIndex;
        return (
          <div key={index} className='flex items-center space-x-1'>
            <ChevronRight className='h-4 w-4' aria-hidden='true' />
            {item.href && !isCurrent ? (
              <Link
                to={item.href}
                className='hover:text-foreground transition-colors'
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'transition-colors',
                  isCurrent
                    ? 'text-foreground font-medium'
                    : 'text-foreground'
                )}
              >
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;
