import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { LanguageToggle, ThemeToggle } from '@/components/common';
import { Menu, X, Home, BookOpen, User, Mail, Shield, Settings, Globe, Moon, Sun, Monitor, Terminal } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { NavigationItem } from '@/components/molecules';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePostsIndex } from '@/hooks/usePostsIndex';
import { HeaderSearchBar } from '@/components/features/search/HeaderSearchBar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

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

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean>(false);
  const { theme, setTheme, isTerminal } = useTheme();
  const { language, setLanguage } = useLanguage();
  const isMobile = useIsMobile();
  const { posts } = usePostsIndex();

  useEffect(() => {
    const check = () => {
      try {
        // Check both new auth system (admin.auth) and legacy token (admin.token)
        const hasNewAuth = !!localStorage.getItem('admin.auth');
        const hasLegacyToken = !!localStorage.getItem('admin.token');
        setHasAdmin(hasNewAuth || hasLegacyToken);
      } catch {
        setHasAdmin(false);
      }
    };
    check();
    const handler = () => check();
    window.addEventListener('admin-auth-changed', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('admin-auth-changed', handler);
      window.removeEventListener('storage', handler);
    };
  }, []);

  const navigation = hasAdmin
    ? [
        ...baseNavigation,
        { name: 'Admin', href: '/admin/config', icon: Shield },
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

          <div className='hidden md:block flex-1 max-w-xs lg:max-w-sm mx-4'>
            <HeaderSearchBar posts={posts} />
          </div>

          <div className='flex items-center gap-x-2 sm:gap-x-4'>
            {!isMobile && (
              <>
                <LanguageToggle />
                <ThemeToggle />
              </>
            )}
            
            {/* 모바일: 통합 설정 드롭다운 */}
            {isMobile && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant='ghost'
                    size='icon'
                    className={cn(
                      'h-11 w-11',
                      isTerminal && 'text-primary hover:text-primary hover:bg-primary/10'
                    )}
                    aria-label='설정'
                  >
                    <Settings className='h-5 w-5' />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align='end' 
                  className={cn(
                    'w-48',
                    isTerminal && 'border-primary/40 bg-background/95 backdrop-blur'
                  )}
                >
                  <DropdownMenuLabel className={cn(
                    'text-xs text-muted-foreground',
                    isTerminal && 'font-mono text-primary/70'
                  )}>
                    {isTerminal ? '$ language' : '언어 설정'}
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => setLanguage('ko')}
                    className={cn(
                      'flex items-center justify-between',
                      isTerminal && 'font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary',
                      isTerminal && language === 'ko' && 'bg-primary/15 text-primary'
                    )}
                  >
                    <span className='flex items-center gap-2'>
                      <Globe className='h-4 w-4' />
                      한국어
                    </span>
                    {language === 'ko' && <span className='text-primary'>✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLanguage('en')}
                    className={cn(
                      'flex items-center justify-between',
                      isTerminal && 'font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary',
                      isTerminal && language === 'en' && 'bg-primary/15 text-primary'
                    )}
                  >
                    <span className='flex items-center gap-2'>
                      <Globe className='h-4 w-4' />
                      English
                    </span>
                    {language === 'en' && <span className='text-primary'>✓</span>}
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className={cn(isTerminal && 'bg-primary/30')} />
                  
                  <DropdownMenuLabel className={cn(
                    'text-xs text-muted-foreground',
                    isTerminal && 'font-mono text-primary/70'
                  )}>
                    {isTerminal ? '$ theme' : '테마 설정'}
                  </DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() => setTheme('light')}
                    className={cn(
                      'flex items-center justify-between', 
                      theme === 'light' && 'bg-accent',
                      isTerminal && 'font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary'
                    )}
                  >
                    <span className='flex items-center gap-2'>
                      <Sun className='h-4 w-4' />
                      Light
                    </span>
                    {theme === 'light' && <span className='text-primary'>✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme('dark')}
                    className={cn(
                      'flex items-center justify-between', 
                      theme === 'dark' && 'bg-accent',
                      isTerminal && 'font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary'
                    )}
                  >
                    <span className='flex items-center gap-2'>
                      <Moon className='h-4 w-4' />
                      Dark
                    </span>
                    {theme === 'dark' && <span className='text-primary'>✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme('system')}
                    className={cn(
                      'flex items-center justify-between', 
                      theme === 'system' && 'bg-accent',
                      isTerminal && 'font-mono hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary'
                    )}
                  >
                    <span className='flex items-center gap-2'>
                      <Monitor className='h-4 w-4' />
                      System
                    </span>
                    {theme === 'system' && <span className='text-primary'>✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setTheme('terminal')}
                    className={cn(
                      'flex items-center justify-between font-mono',
                      theme === 'terminal' && 'bg-primary/15',
                      isTerminal && 'hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary'
                    )}
                  >
                    <span className='flex items-center gap-2'>
                      <Terminal className={cn('h-4 w-4', theme === 'terminal' && 'text-primary')} />
                      <span className={cn(theme === 'terminal' && 'text-primary')}>Terminal</span>
                    </span>
                    {theme === 'terminal' && <span className='text-primary'>✓</span>}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            <div className='flex md:hidden'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label='Toggle main menu'
                className={cn(
                  'h-11 w-11',
                  isTerminal && 'text-primary hover:text-primary'
                )}
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
