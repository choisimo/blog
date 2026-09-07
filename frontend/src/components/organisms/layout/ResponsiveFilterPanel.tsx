import { useEffect, useId, useState, type PropsWithChildren } from 'react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface ResponsiveFilterPanelProps extends PropsWithChildren {
  label: string;
  activeCount: number;
}

export function ResponsiveFilterPanel({ label, activeCount, children }: ResponsiveFilterPanelProps) {
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  const helpId = useId();
  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => { setCompact(query.matches); if (!query.matches) setOpen(false); };
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (!compact) return <aside className="ui-filter-responsive" aria-label={label}>{children}</aside>;
  return <div className="ui-filter-responsive">
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><button type="button" className="ui-filter-trigger">
        {label}{activeCount > 0 && <span>{activeCount}개 적용</span>}
      </button></SheetTrigger>
      <SheetContent side="bottom" className="ui-sheet ui-filter-sheet" aria-describedby={helpId}>
        <SheetTitle>{label}</SheetTitle><p id={helpId}>조건을 바꾸면 목록에 바로 반영됩니다. 입력한 검색어는 유지됩니다.</p>
        <div className="ui-filter-sheet-body">{children}</div>
        <button type="button" className="ui-primary-button" onClick={() => setOpen(false)}>결과 보기</button>
      </SheetContent>
    </Sheet>
  </div>;
}
