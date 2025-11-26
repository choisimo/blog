import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageToggle, ThemeToggle } from '@/components/common';
import { Menu, X, Home, BookOpen, User, Mail, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { NavigationItem } from '@/components/molecules';
import { useTheme } from '@/contexts/ThemeContext';

const baseNavigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Blog', href: '/blog', icon: BookOpen },
  { name: 'About', href: '/about', icon: User },
  { name: 'Contact', href: '/contact', icon: Mail },
];

// Terminal window buttons component
function TerminalWindowButtons() {
  return (
    <div className='flex items-center gap-1.5 mr-4'>
      <span className='w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-close))]' />
      <span className='w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]' />
      <span className='w-3 h-3 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]' />
    </div>
  );
}

// Terminal path display component
function TerminalPath() {
  const location = useLocation();
  const path = location.pathname === '/' ? '~' : `~${location.pathname}`;

  return (
    <div className='hidden sm:flex items-center gap-2 font-mono text-xs text-muted-foreground'>
      <span className='text-primary'>user@blog:</span>
      <span>{path}</span>
      <span className='terminal-cursor' />
    </div>
  );
}

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean>(false);
  const { isTerminal } = useTheme();

  useEffect(() => {
    const check = () => {
      try {
        setHasAdmin(!!localStorage.getItem('admin.token'));
      } catch {
        setHasAdmin(false);
      }
    };
    check();
    const handler = () => check();
    window.addEventListener('admin-auth-changed', handler);
    return () => window.removeEventListener('admin-auth-changed', handler);
  }, []);

  const navigation = hasAdmin
    ? [
        ...baseNavigation,
        { name: 'Admin', href: '/admin/new-post', icon: Shield },
      ]
    : baseNavigation;

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        isTerminal && 'bg-[hsl(var(--terminal-titlebar))] border-border'
      )}
    >
      <nav
        className='container mx-auto px-4 sm:px-6 lg:px-8'
        aria-label='Global'
      >
        <div className='flex h-16 items-center justify-between'>
          <div className='flex items-center gap-x-12'>
            {/* Terminal window buttons - only show in terminal mode */}
            {isTerminal && <TerminalWindowButtons />}

            <Link
              to='/'
              className={cn(
                'flex items-center space-x-2 no-terminal-style',
                isTerminal && 'no-underline'
              )}
            >
              <span
                className={cn(
                  'text-2xl font-bold',
                  isTerminal
                    ? 'font-mono text-primary terminal-glow'
                    : 'bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent'
                )}
              >
                {isTerminal ? '>_Nodove' : 'Nodove'}
              </span>
            </Link>

            {/* Terminal path - only show in terminal mode */}
            {isTerminal && <TerminalPath />}

            <div className='hidden md:flex md:gap-x-8'>
              {navigation.map(item => (
                <NavigationItem
                  key={item.name}
                  name={item.name}
                  href={item.href}
                  icon={item.icon}
                  className={cn(
                    isTerminal && 'font-mono text-sm no-terminal-style'
                  )}
                />
              ))}
            </div>
          </div>
          <div className='flex items-center gap-x-4'>
            <LanguageToggle />
            <ThemeToggle />
            <div className='flex md:hidden'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label='Toggle main menu'
                className={cn(isTerminal && 'text-primary hover:text-primary')}
              >
                <span className='sr-only'>Open main menu</span>
                {mobileMenuOpen ? (
                  <X className='h-6 w-6' aria-hidden='true' />
                ) : (
                  <Menu className='h-6 w-6' aria-hidden='true' />
                )}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      <div className={cn('md:hidden', mobileMenuOpen ? 'block' : 'hidden')}>
        <div
          className={cn(
            'space-y-1 px-4 pb-3 pt-2',
            isTerminal && 'bg-[hsl(var(--terminal-code-bg))]'
          )}
        >
          {navigation.map(item => (
            <NavigationItem
              key={item.name}
              name={item.name}
              href={item.href}
              icon={item.icon}
              isMobile
              onClick={closeMobileMenu}
              className={cn(isTerminal && 'font-mono no-terminal-style')}
            />
          ))}
        </div>
      </div>
    </header>
  );
}
