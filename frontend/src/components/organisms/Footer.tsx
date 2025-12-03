import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { site } from '@/config/site';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const { isTerminal } = useTheme();

  return (
    <footer className={cn(
      'border-t bg-background',
      isTerminal && 'border-primary/30'
    )}>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='py-10 md:py-14'>
          <div className='grid grid-cols-1 gap-8 md:grid-cols-4'>
            <div className='space-y-4'>
              <h3 className={cn(
                'text-lg font-semibold',
                isTerminal && 'font-mono text-primary'
              )}>
                {isTerminal ? '>_ Nodove Blog' : 'Nodove Blog'}
              </h3>
              <p className='text-sm text-muted-foreground'>
                최신 기술 트렌드를 놓치지 마세요!
              </p>
              <p className='text-sm text-muted-foreground'>
                유용한 글을 메일로 보내드려요.
              </p>
              <div className='flex space-x-4'>
                <Button 
                  variant='ghost' 
                  size='icon' 
                  asChild
                  className={cn(isTerminal && 'text-primary hover:text-primary hover:bg-primary/10')}
                >
                  <a
                    href={site.social.github}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <Github className='h-5 w-5' />
                    <span className='sr-only'>GitHub</span>
                  </a>
                </Button>
                <Button 
                  variant='ghost' 
                  size='icon' 
                  asChild
                  className={cn(isTerminal && 'text-primary hover:text-primary hover:bg-primary/10')}
                >
                  <a
                    href={site.social.twitter}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <Twitter className='h-5 w-5' />
                    <span className='sr-only'>Twitter</span>
                  </a>
                </Button>
                <Button 
                  variant='ghost' 
                  size='icon' 
                  asChild
                  className={cn(isTerminal && 'text-primary hover:text-primary hover:bg-primary/10')}
                >
                  <a
                    href={site.social.linkedin}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <Linkedin className='h-5 w-5' />
                    <span className='sr-only'>LinkedIn</span>
                  </a>
                </Button>
                <Button 
                  variant='ghost' 
                  size='icon' 
                  asChild
                  className={cn(isTerminal && 'text-primary hover:text-primary hover:bg-primary/10')}
                >
                  <a href={`mailto:${site.email}`}>
                    <Mail className='h-5 w-5' />
                    <span className='sr-only'>Email</span>
                  </a>
                </Button>
              </div>
            </div>

            <div className='space-y-4'>
              <h4 className={cn(
                'text-sm font-semibold',
                isTerminal && 'font-mono text-primary'
              )}>
                {isTerminal ? '$ nav' : 'Navigation'}
              </h4>
              <ul className={cn(
                'space-y-2 text-sm',
                isTerminal && 'font-mono'
              )}>
                <li>
                  <Link
                    to='/'
                    className='text-muted-foreground hover:text-primary transition-colors'
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    to='/blog'
                    className='text-muted-foreground hover:text-primary transition-colors'
                  >
                    Blog
                  </Link>
                </li>
                <li>
                  <Link
                    to='/about'
                    className='text-muted-foreground hover:text-primary transition-colors'
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    to='/contact'
                    className='text-muted-foreground hover:text-primary transition-colors'
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div className='space-y-4'>
              <h4 className={cn(
                'text-sm font-semibold',
                isTerminal && 'font-mono text-primary'
              )}>
                {isTerminal ? '$ categories' : 'Categories'}
              </h4>
              <ul className={cn(
                'space-y-2 text-sm',
                isTerminal && 'font-mono'
              )}>
                <li>
                  <Link
                    to='/blog?category=ai'
                    className='text-muted-foreground hover:text-primary transition-colors'
                  >
                    AI & Machine Learning
                  </Link>
                </li>
                <li>
                  <Link
                    to='/blog?category=web'
                    className='text-muted-foreground hover:text-primary transition-colors'
                  >
                    Web Development
                  </Link>
                </li>
                <li>
                  <Link
                    to='/blog?category=devops'
                    className='text-muted-foreground hover:text-primary transition-colors'
                  >
                    DevOps
                  </Link>
                </li>
                <li>
                  <Link
                    to='/blog?category=algorithms'
                    className='text-muted-foreground hover:text-primary transition-colors'
                  >
                    Algorithms
                  </Link>
                </li>
              </ul>
            </div>

            <div className='space-y-4'>
              <h4 className={cn(
                'text-sm font-semibold',
                isTerminal && 'font-mono text-primary'
              )}>
                {isTerminal ? '$ subscribe' : 'Subscribe'}
              </h4>
              <p className={cn(
                'text-sm text-muted-foreground',
                isTerminal && 'font-mono'
              )}>
                최신 글을 메일로 받아보세요.
              </p>
              <form className='space-y-2'>
                <input
                  type='email'
                  placeholder={isTerminal ? 'email@example.com' : 'Enter your email'}
                  className={cn(
                    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    isTerminal && 'font-mono border-primary/40 bg-primary/5 text-primary placeholder:text-primary/50 focus:ring-primary/50 focus:border-primary/60'
                  )}
                />
                <Button 
                  type='submit' 
                  className={cn(
                    'w-full',
                    isTerminal && 'font-mono bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 hover:shadow-[0_0_10px_rgba(0,255,65,0.3)]'
                  )}
                  variant={isTerminal ? 'outline' : 'default'}
                >
                  {isTerminal ? '> Subscribe' : 'Subscribe'}
                </Button>
              </form>
            </div>
          </div>

          <div className={cn(
            'mt-8 border-t pt-8',
            isTerminal && 'border-primary/30'
          )}>
            <p className={cn(
              'text-center text-sm text-muted-foreground',
              isTerminal && 'font-mono'
            )}>
              © {currentYear} Nodove Blog. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
