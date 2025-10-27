import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/common';
import { Menu, X, Home, BookOpen, User, Mail, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { NavigationItem } from '@/components/molecules';

const baseNavigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Blog', href: '/blog', icon: BookOpen },
  { name: 'About', href: '/about', icon: User },
  { name: 'Contact', href: '/contact', icon: Mail },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasAdmin, setHasAdmin] = useState<boolean>(false);

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
    <header className='sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
      <nav
        className='container mx-auto px-4 sm:px-6 lg:px-8'
        aria-label='Global'
      >
        <div className='flex h-16 items-center justify-between'>
          <div className='flex items-center gap-x-12'>
            <Link to='/' className='flex items-center space-x-2'>
              <span className='text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent'>
                Nodove
              </span>
            </Link>
            <div className='hidden md:flex md:gap-x-8'>
              {navigation.map(item => (
                <NavigationItem
                  key={item.name}
                  name={item.name}
                  href={item.href}
                  icon={item.icon}
                />
              ))}
            </div>
          </div>
          <div className='flex items-center gap-x-4'>
            <ThemeToggle />
            <div className='flex md:hidden'>
              <Button
                variant='ghost'
                size='icon'
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label='Toggle main menu'
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
        <div className='space-y-1 px-4 pb-3 pt-2'>
          {navigation.map(item => (
            <NavigationItem
              key={item.name}
              name={item.name}
              href={item.href}
              icon={item.icon}
              isMobile
              onClick={closeMobileMenu}
            />
          ))}
        </div>
      </div>
    </header>
  );
}
