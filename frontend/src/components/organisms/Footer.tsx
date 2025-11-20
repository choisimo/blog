import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { site } from '@/config/site';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className='border-t bg-background'>
      <div className='container mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='py-10 md:py-14'>
          <div className='grid grid-cols-1 gap-8 md:grid-cols-4'>
            <div className='space-y-4'>
              <h3 className='text-lg font-semibold'>Nodove Blog</h3>
              <p className='text-sm text-muted-foreground'>
                최신 기술 트렌드를 놓치지 마세요!
              </p>
              <p className='text-sm text-muted-foreground'>
                유용한 글을 메일로 보내드려요.
              </p>
              <div className='flex space-x-4'>
                <Button variant='ghost' size='icon' asChild>
                  <a
                    href={site.social.github}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <Github className='h-5 w-5' />
                    <span className='sr-only'>GitHub</span>
                  </a>
                </Button>
                <Button variant='ghost' size='icon' asChild>
                  <a
                    href={site.social.twitter}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <Twitter className='h-5 w-5' />
                    <span className='sr-only'>Twitter</span>
                  </a>
                </Button>
                <Button variant='ghost' size='icon' asChild>
                  <a
                    href={site.social.linkedin}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    <Linkedin className='h-5 w-5' />
                    <span className='sr-only'>LinkedIn</span>
                  </a>
                </Button>
                <Button variant='ghost' size='icon' asChild>
                  <a href={`mailto:${site.email}`}>
                    <Mail className='h-5 w-5' />
                    <span className='sr-only'>Email</span>
                  </a>
                </Button>
              </div>
            </div>

            <div className='space-y-4'>
              <h4 className='text-sm font-semibold'>Navigation</h4>
              <ul className='space-y-2 text-sm'>
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
              <h4 className='text-sm font-semibold'>Categories</h4>
              <ul className='space-y-2 text-sm'>
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
              <h4 className='text-sm font-semibold'>Subscribe</h4>
              <p className='text-sm text-muted-foreground'>
                최신 글을 메일로 받아보세요.
              </p>
              <form className='space-y-2'>
                <input
                  type='email'
                  placeholder='Enter your email'
                  className='w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
                />
                <Button type='submit' className='w-full'>
                  Subscribe
                </Button>
              </form>
            </div>
          </div>

          <div className='mt-8 border-t pt-8'>
            <p className='text-center text-sm text-muted-foreground'>
              © {currentYear} Nodove Blog. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
