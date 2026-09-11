import { Portal, Arrow } from '@radix-ui/react-tooltip';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type LensViewToggleProps = {
  showEvidence: boolean;
  onToggle: () => void;
  controls: string;
};

/** One persistent button exposes both the current view and its next action. */
export default function LensViewToggle({
  showEvidence,
  onToggle,
  controls,
}: LensViewToggleProps) {
  const hint = showEvidence ? '눌러서 요점 보기' : '눌러서 근거 보기';
  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            className='sentio-lens-view-toggle'
            aria-label={
              showEvidence
                ? '분석 근거, 눌러서 요점 보기'
                : '분석 요점, 눌러서 근거 보기'
            }
            aria-pressed={showEvidence}
            aria-controls={controls}
            onClick={onToggle}
          >
            {showEvidence ? '분석 근거' : '분석 요점'}
          </button>
        </TooltipTrigger>
        <Portal>
          <TooltipContent
            className='sentio-lens-view-tooltip'
            side='top'
            sideOffset={8}
          >
            {hint}
            <Arrow className='sentio-lens-tooltip-arrow' />
          </TooltipContent>
        </Portal>
      </Tooltip>
    </TooltipProvider>
  );
}
