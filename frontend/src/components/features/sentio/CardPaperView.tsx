import { useRef, type ReactNode, type RefObject } from 'react';
import { BookOpen, Maximize2, X } from 'lucide-react';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import './card-paper.css';

type PaperReadingContentProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  meta?: ReactNode;
  returnFocusRef?: RefObject<HTMLButtonElement>;
  children: ReactNode;
};

/** Shared document surface; live content and request state stay with their owner. */
export function PaperReadingContent({
  title,
  eyebrow = 'AI와 함께 읽기',
  description,
  meta,
  returnFocusRef,
  children,
}: PaperReadingContentProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  return (
    <DialogContent
      className='sentio-paper-dialog not-prose'
      hideClose
      {...(!description ? { 'aria-describedby': undefined } : {})}
      onKeyDown={event => event.stopPropagation()}
      onCloseAutoFocus={event => {
        if (returnFocusRef?.current?.isConnected) {
          event.preventDefault();
          returnFocusRef.current.focus({ preventScroll: true });
        }
      }}
      onOpenAutoFocus={event => {
        event.preventDefault();
        paperRef.current?.focus({ preventScroll: true });
      }}
    >
      <div className='sentio-paper-toolbar'>
        <span className='sentio-paper-toolbar-label'>
          <BookOpen size={16} aria-hidden='true' />
          읽기 노트
        </span>
        <div className='sentio-paper-toolbar-actions'>
          <span className='sentio-paper-key-hint'>Esc로 닫기</span>
          <DialogClose asChild>
            <button
              type='button'
              className='sentio-paper-close'
              aria-label='큰 화면 닫기'
            >
              <X size={20} aria-hidden='true' />
            </button>
          </DialogClose>
        </div>
      </div>
      <div className='sentio-paper-canvas'>
        <div ref={paperRef} tabIndex={-1} className='sentio-paper-sheet'>
          <header className='sentio-paper-heading'>
            <p className='sentio-paper-eyebrow'>{eyebrow}</p>
            <DialogTitle className='sentio-paper-title'>{title}</DialogTitle>
            {description && (
              <DialogDescription className='sentio-paper-description'>
                {description}
              </DialogDescription>
            )}
            {meta && <div className='sentio-paper-meta'>{meta}</div>}
          </header>
          <div className='sentio-paper-body'>{children}</div>
        </div>
      </div>
    </DialogContent>
  );
}

export default function CardPaperView(props: PaperReadingContentProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type='button'
          className='sentio-paper-trigger'
          aria-label={`${props.title} 크게 보기`}
        >
          <Maximize2 size={15} aria-hidden='true' />
          <span>크게 보기</span>
        </button>
      </DialogTrigger>
      <PaperReadingContent {...props} />
    </Dialog>
  );
}
