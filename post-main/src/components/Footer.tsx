import { Link } from 'react-router-dom';
import { Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 md:py-12">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Nodove Blog</h3>
              <p className="text-sm text-muted-foreground">
                Sharing knowledge and experiences in software development.
              </p>
              <div className="flex space-x-4">
                <Button variant="ghost" size="icon" asChild>
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                    <Github className="h-5 w-5" />
                    <span className="sr-only">GitHub</span>
                  </a>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">
                    <Twitter className="h-5 w-5" />
                    <span className="sr-only">Twitter</span>
                  </a>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer">
                    <Linkedin className="h-5 w-5" />
                    <span className="sr-only">LinkedIn</span>
                  </a>
                </Button>
                <Button variant="ghost" size="icon" asChild>
                  <a href="mailto:contact@nodove.com">
                    <Mail className="h-5 w-5" />
                    <span className="sr-only">Email</span>
                  </a>
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Navigation</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="text-muted-foreground hover:text-primary transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="text-muted-foreground hover:text-primary transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Categories</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/blog?category=ai" className="text-muted-foreground hover:text-primary transition-colors">
                    AI & Machine Learning
                  </Link>
                </li>
                <li>
                  <Link to="/blog?category=web" className="text-muted-foreground hover:text-primary transition-colors">
                    Web Development
                  </Link>
                </li>
                <li>
                  <Link to="/blog?category=devops" className="text-muted-foreground hover:text-primary transition-colors">
                    DevOps
                  </Link>
                </li>
                <li>
                  <Link to="/blog?category=algorithms" className="text-muted-foreground hover:text-primary transition-colors">
                    Algorithms
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold">Subscribe</h4>
              <p className="text-sm text-muted-foreground">
                Get the latest posts delivered to your inbox.
              </p>
              <form className="space-y-2">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                />
                <Button type="submit" className="w-full">
                  Subscribe
                </Button>
              </form>
            </div>
          </div>

          <div className="mt-8 border-t pt-8">
            <p className="text-center text-sm text-muted-foreground">
              © {currentYear} Nodove Blog. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}