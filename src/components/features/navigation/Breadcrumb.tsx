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

export const Breadcrumb = ({ items, className }: BreadcrumbProps) => {
  return (
    <nav
      className={cn(
        'flex items-center space-x-1 text-sm text-muted-foreground',
        className
      )}
    >
      <Link to='/' className='hover:text-foreground transition-colors'>
        <Home className='h-4 w-4' />
      </Link>
      {items.map((item, index) => (
        <div key={index} className='flex items-center space-x-1'>
          <ChevronRight className='h-4 w-4' />
          {item.href ? (
            <Link
              to={item.href}
              className='hover:text-foreground transition-colors'
            >
              {item.label}
            </Link>
          ) : (
            <span className='text-foreground'>{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
};
