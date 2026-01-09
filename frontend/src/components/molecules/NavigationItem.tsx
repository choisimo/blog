import { Link, useLocation } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavigationItemProps {
  name: string;
  href: string;
  icon: LucideIcon;
  isMobile?: boolean;
  onClick?: () => void;
  className?: string;
}

export function NavigationItem({
  name,
  href,
  icon: Icon,
  isMobile = false,
  onClick,
  className = '',
}: NavigationItemProps) {
  const location = useLocation();
  const isActive = location.pathname === href;

  const baseClasses = isMobile
    ? 'flex items-center gap-3 rounded-md px-4 py-3 text-base font-medium transition-colors min-h-[44px]'
    : 'flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary';

  const activeClasses = isMobile
    ? 'bg-primary/10 text-primary'
    : 'text-primary';

  const inactiveClasses = isMobile
    ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    : 'text-muted-foreground';

  return (
    <Link
      to={href}
      className={cn(
        baseClasses,
        isActive ? activeClasses : inactiveClasses,
        className
      )}
      onClick={onClick}
    >
      <Icon className={isMobile ? 'h-5 w-5' : 'h-4 w-4'} />
      {name}
    </Link>
  );
}
