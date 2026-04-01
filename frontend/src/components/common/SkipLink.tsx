import { cn } from '@/lib/utils';

interface SkipLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
}

export const SkipLink = ({ href, children, className }: SkipLinkProps) => {
  return (
    <a
      href={href}
      className={cn(
        'skip-link',
        'absolute -top-10 left-6 z-[var(--z-tooltip)] bg-background px-4 py-2 text-foreground',
        'focus:top-6 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'transition-all duration-200 font-medium rounded-md shadow-lg',
        className
      )}
    >
      {children}
    </a>
  );
};
