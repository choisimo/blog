import React, { useMemo, useState } from 'react';
import {
  sketch,
  prism,
  chain,
  SketchResult,
  PrismResult,
  ChainResult,
} from '@/services/ai';

// Minimal telemetry to localStorage for future learning
function logEvent(event: Record<string, unknown>) {
  try {
    const key = 'aiMemo.events';
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    prev.push({ t: Date.now(), ...event });
    localStorage.setItem(key, JSON.stringify(prev.slice(-500))); // cap
  } catch {
    void 0;
  }
}

function extractText(children: React.ReactNode): string {
  const parts: string[] = [];
  const walk = (node: React.ReactNode) => {
    if (node == null || node === false) return;
    if (typeof node === 'string' || typeof node === 'number') {
      parts.push(String(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (React.isValidElement(node)) {
      walk(node.props.children);
    }
  };
  walk(children);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

type Mode = 'idle' | 'sketch' | 'prism' | 'chain';

export default function SparkInline({
  children,
  postTitle,
}: {
  children: React.ReactNode;
  postTitle?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Mode>('idle');
  const [error, setError] = useState<string | null>(null);
  const [sketchRes, setSketchRes] = useState<SketchResult | null>(null);
  const [prismRes, setPrismRes] = useState<PrismResult | null>(null);
  const [chainRes, setChainRes] = useState<ChainResult | null>(null);

  const text = useMemo(() => extractText(children), [children]);
  const hasText = text && text.length > 0;

  const run = async (which: Mode) => {
    if (!hasText) return;
    setOpen(true);
    setError(null);
    setLoading(which);
    // clear previous
    setSketchRes(null);
    setPrismRes(null);
    setChainRes(null);
    try {
      if (which === 'sketch') {
        const res = await sketch({ paragraph: text, postTitle });
        setSketchRes(res);
        logEvent({ type: 'sketch', len: text.length });
      } else if (which === 'prism') {
        const res = await prism({ paragraph: text, postTitle });
        setPrismRes(res);
        logEvent({ type: 'prism', len: text.length });
      } else if (which === 'chain') {
        const res = await chain({ paragraph: text, postTitle });
        setChainRes(res);
        logEvent({ type: 'chain', len: text.length });
      }
    } catch (e: unknown) {
      const msg =
        e instanceof Error
          ? e.message
          : 'AI 호출 실패. 우측 하단 AI 메모에서 키를 설정하세요.';
      setError(msg);
    } finally {
      setLoading('idle');
    }
  };

  return (
    <>
      <p className='mb-4 leading-relaxed inline-block w-full group'>
        {children}
        {hasText && (
          <button
            type='button'
            title='문단 확장'
            aria-label='문단 확장'
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
            className='ml-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-base opacity-60 transition-colors transition-opacity hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 group-hover:opacity-100 md:min-h-[36px] md:min-w-[36px] md:text-sm'
          >
            <span aria-hidden className='select-none'>✨</span>
          </button>
        )}
      </p>
      {open && (
        <div
          className='-mt-2 mb-6 rounded-lg border bg-card/30 p-3 text-sm'
          role='region'
          aria-label='AI inline expansion'
        >
          <div className='flex flex-wrap gap-2 mb-2'>
            <button
              className='px-2 py-1 rounded border text-xs hover:bg-primary/10'
              disabled={loading !== 'idle'}
              onClick={() => run('sketch')}
            >
              Sketch
            </button>
            <button
              className='px-2 py-1 rounded border text-xs hover:bg-primary/10'
              disabled={loading !== 'idle'}
              onClick={() => run('prism')}
            >
              Prism
            </button>
            <button
              className='px-2 py-1 rounded border text-xs hover:bg-primary/10'
              disabled={loading !== 'idle'}
              onClick={() => run('chain')}
            >
              Chain
            </button>
            <button
              className='ml-auto px-2 py-1 rounded border text-xs hover:bg-muted'
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
          {loading !== 'idle' && (
            <div className='text-muted-foreground'>AI {loading} 중…</div>
          )}
          {error && <div className='text-red-500'>{error}</div>}

          {sketchRes && (
            <div className='mt-2'>
              <div className='font-semibold'>Mood: {sketchRes.mood}</div>
              <ul className='list-disc ml-6 mt-1'>
                {sketchRes.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {prismRes && (
            <div className='mt-2 grid gap-2'>
              {prismRes.facets.map((f, i) => (
                <div key={i} className=''>
                  <div className='font-semibold'>{f.title}</div>
                  <ul className='list-disc ml-6 mt-1'>
                    {f.points.map((p, j) => (
                      <li key={j}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {chainRes && (
            <div className='mt-2'>
              <ul className='list-disc ml-6'>
                {chainRes.questions.map((q, i) => (
                  <li key={i}>
                    <span className='font-medium'>{q.q}</span>
                    {q.why ? (
                      <span className='text-muted-foreground'> — {q.why}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
