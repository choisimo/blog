import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImageLightbox({ src, alt, open, onOpenChange }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  const handleReset = useCallback(() => {
    setScale(1);
    setRotation(0);
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  }, [onOpenChange, handleReset]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent 
        className="max-w-[95vw] max-h-[95vh] w-auto h-auto p-0 bg-black/95 border-none overflow-hidden"
        onPointerDownOutside={() => handleOpenChange(false)}
      >
        <VisuallyHidden>
          <DialogTitle>{alt || 'Image preview'}</DialogTitle>
          <DialogDescription>Click outside or press Escape to close</DialogDescription>
        </VisuallyHidden>
        
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
            disabled={scale <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
            disabled={scale >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRotate}
            className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleOpenChange(false)}
            className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div 
          className="flex items-center justify-center w-full h-full min-h-[50vh] p-8 cursor-zoom-out"
          onClick={() => handleOpenChange(false)}
        >
          <img
            src={src}
            alt={alt || ''}
            className={cn(
              'max-w-full max-h-[85vh] object-contain transition-transform duration-200',
              'select-none'
            )}
            style={{
              transform: `scale(${scale}) rotate(${rotation}deg)`,
            }}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </div>

        {alt && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <p className="text-white/90 text-sm text-center">{alt}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ClickableImageProps {
  src: string;
  alt?: string;
  className?: string;
  isTerminal?: boolean;
}

export function ClickableImage({ src, alt, className, isTerminal }: ClickableImageProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  let resolvedSrc = src;
  if (src) {
    if (src.startsWith('../../images/')) {
      resolvedSrc = src.replace('../../images/', '/images/');
    } else if (src.startsWith('../images/')) {
      resolvedSrc = src.replace('../images/', '/images/');
    } else if (src.startsWith('./images/')) {
      resolvedSrc = src.replace('./images/', '/images/');
    }
  }

  return (
    <>
      <figure className="my-8 text-center">
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-xl inline-block"
          aria-label={`View ${alt || 'image'} in full size`}
        >
          <img
            src={resolvedSrc}
            alt={alt || ''}
            className={cn(
              'rounded-xl shadow-lg mx-auto max-w-full h-auto transition-transform hover:scale-[1.02]',
              isTerminal && 'rounded-lg border border-border',
              className
            )}
          />
        </button>
        {alt && (
          <figcaption
            className={cn(
              'text-sm text-muted-foreground mt-2 italic',
              isTerminal && 'font-mono not-italic'
            )}
          >
            {isTerminal ? `// ${alt}` : alt}
          </figcaption>
        )}
      </figure>

      <ImageLightbox
        src={resolvedSrc}
        alt={alt}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </>
  );
}

export default ImageLightbox;
