import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useSessionStack } from '@/contexts/SessionStackContext';

interface BackButtonProps {
  fallbackPath?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'link' | 'destructive' | 'secondary';
}

export const BackButton: React.FC<BackButtonProps> = ({ 
  fallbackPath = '/blog',
  className = '',
  variant = 'ghost'
}) => {
  const navigate = useNavigate();
  const { canGoBack, previousPage, popPage } = useSessionStack();

  const handleBack = () => {
    if (canGoBack && previousPage) {
      popPage();
      navigate(previousPage.path);
      
      // Restore scroll position after navigation
      setTimeout(() => {
        if (previousPage.scrollPosition) {
          window.scrollTo({ top: previousPage.scrollPosition, behavior: 'smooth' });
        }
      }, 100);
    } else {
      navigate(fallbackPath);
    }
  };

  const getBackText = () => {
    if (canGoBack && previousPage) {
      // Truncate long titles
      const title = previousPage.title.length > 20 
        ? previousPage.title.substring(0, 20) + '...'
        : previousPage.title;
      return `Back to ${title}`;
    }
    return 'Back to Blog';
  };

  return (
    <Button 
      onClick={handleBack}
      variant={variant}
      className={`hover:bg-primary/10 ${className}`}
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      {getBackText()}
    </Button>
  );
};