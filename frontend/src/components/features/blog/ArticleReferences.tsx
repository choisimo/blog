import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react';

/** Native disclosure keeps references available to keyboards, deep links and print. */
export function ArticleReferences({
  node: _node,
  ...props
}: ComponentPropsWithoutRef<'details'> & { node?: unknown }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const isReferences = props.className
    ?.split(/\s+/)
    .includes('article-references');

  useEffect(() => {
    const panel = ref.current;
    if (!panel || !isReferences) return;
    let beforePrint: boolean | undefined;
    const openForPrint = () => {
      if (beforePrint === undefined) beforePrint = panel.open;
      panel.open = true;
    };
    const restoreAfterPrint = () => {
      if (beforePrint !== undefined) panel.open = beforePrint;
      beforePrint = undefined;
    };
    const revealHashTarget = () => {
      let id: string;
      try {
        id = decodeURIComponent(window.location.hash.slice(1));
      } catch {
        return;
      }
      const target = id ? document.getElementById(id) : null;
      if (!target || !panel.contains(target)) return;
      panel.open = true;
      target.scrollIntoView({ block: 'center' });
    };
    revealHashTarget();
    window.addEventListener('hashchange', revealHashTarget);
    window.addEventListener('beforeprint', openForPrint);
    window.addEventListener('afterprint', restoreAfterPrint);
    return () => {
      window.removeEventListener('hashchange', revealHashTarget);
      window.removeEventListener('beforeprint', openForPrint);
      window.removeEventListener('afterprint', restoreAfterPrint);
      restoreAfterPrint();
    };
  }, [isReferences]);

  return <details {...props} ref={ref} />;
}
