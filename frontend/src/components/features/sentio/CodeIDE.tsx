import { useEffect, useRef, useState, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { python } from '@codemirror/lang-python';
import { javascript } from '@codemirror/lang-javascript';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';
import { Play, Loader2, ChevronDown } from 'lucide-react';

const LANGUAGE_OPTIONS = [
  { label: 'Python', value: 'python', pistonLang: 'python', pistonVersion: '3.10.0' },
  { label: 'JavaScript', value: 'javascript', pistonLang: 'javascript', pistonVersion: '18.15.0' },
  { label: 'TypeScript', value: 'typescript', pistonLang: 'typescript', pistonVersion: '5.0.3' },
  { label: 'Java', value: 'java', pistonLang: 'java', pistonVersion: '15.0.2' },
  { label: 'C++', value: 'cpp', pistonLang: 'c++', pistonVersion: '10.2.0' },
  { label: 'C', value: 'c', pistonLang: 'c', pistonVersion: '10.2.0' },
] as const;

type LanguageValue = (typeof LANGUAGE_OPTIONS)[number]['value'];

function getLanguageExtension(lang: LanguageValue) {
  switch (lang) {
    case 'python':
      return python();
    case 'javascript':
    case 'typescript':
      return javascript({ typescript: lang === 'typescript' });
    case 'java':
      return java();
    case 'cpp':
    case 'c':
      return cpp();
    default:
      return javascript();
  }
}

function detectLanguage(question: string): LanguageValue {
  const q = question.toLowerCase();
  if (q.includes('python') || q.includes('.py') || q.includes('def ') || q.includes('print(')) return 'python';
  if (q.includes('typescript') || q.includes('.ts') || q.includes(': number') || q.includes(': string')) return 'typescript';
  if (q.includes('java') && !q.includes('javascript')) return 'java';
  if (q.includes('c++') || q.includes('cpp') || q.includes('#include')) return 'cpp';
  return 'javascript';
}

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCode(code: string, lang: LanguageValue): Promise<RunResult> {
  const opt = LANGUAGE_OPTIONS.find(l => l.value === lang)!;
  const res = await fetch('https://emkc.org/api/v2/piston/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: opt.pistonLang,
      version: opt.pistonVersion,
      files: [{ content: code }],
    }),
  });
  if (!res.ok) throw new Error(`Execution API error: ${res.status}`);
  const data = (await res.json()) as {
    run: { stdout: string; stderr: string; code: number };
  };
  return {
    stdout: data.run.stdout,
    stderr: data.run.stderr,
    exitCode: data.run.code,
  };
}

interface CodeIDEProps {
  value: string;
  onChange: (code: string) => void;
  question: string;
  className?: string;
}

export default function CodeIDE({ value, onChange, question, className }: CodeIDEProps) {
  const { isTerminal } = useTheme();
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  const [lang, setLang] = useState<LanguageValue>(() => detectLanguage(question));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  // Build editor on mount and when language changes
  useEffect(() => {
    if (!editorRef.current) return;

    // Destroy existing view
    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const startDoc = value || '';

    const state = EditorState.create({
      doc: startDoc,
      extensions: [
        basicSetup,
        getLanguageExtension(lang),
        oneDark,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            fontSize: '12px',
            height: '180px',
            borderRadius: '0 0 12px 12px',
          },
          '.cm-scroller': {
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            overflow: 'auto',
          },
          '.cm-content': { caretColor: '#3cff96' },
          '&.cm-focused .cm-cursor': { borderLeftColor: '#3cff96' },
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: editorRef.current });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // Sync external value changes (e.g., reset) without re-creating the editor
  const lastExternal = useRef(value);
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (value !== current && value !== lastExternal.current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
    lastExternal.current = value;
  }, [value]);

  const handleRun = useCallback(async () => {
    const code = viewRef.current?.state.doc.toString() ?? value;
    if (!code.trim()) return;
    setRunning(true);
    setResult(null);
    setRunError(null);
    try {
      const res = await runCode(code, lang);
      setResult(res);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRunning(false);
    }
  }, [lang, value]);

  const selectedLang = LANGUAGE_OPTIONS.find(l => l.value === lang)!;

  return (
    <div className={cn('rounded-xl overflow-hidden border', isTerminal ? 'border-primary/20' : 'border-border/50', className)}>
      {/* Header toolbar */}
      <div
        className={cn(
          'flex items-center justify-between px-3 py-1.5 text-xs',
          isTerminal ? 'bg-[hsl(var(--terminal-code-bg))]' : 'bg-muted/50',
        )}
      >
        <span
          className={cn(
            'font-mono uppercase tracking-wide',
            isTerminal ? 'text-primary/70' : 'text-muted-foreground',
          )}
        >
          code editor
        </span>

        <div className='flex items-center gap-2'>
          {/* Language selector */}
          <div className='relative'>
            <button
              type='button'
              onClick={() => setLangOpen(o => !o)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono transition',
                isTerminal
                  ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                  : 'bg-background text-foreground/80 hover:bg-muted border border-border/60',
              )}
            >
              {selectedLang.label}
              <ChevronDown className='h-3 w-3' />
            </button>
            {langOpen && (
              <div
                className={cn(
                  'absolute right-0 top-full mt-1 z-50 rounded-lg border shadow-lg overflow-hidden min-w-[110px]',
                  isTerminal
                    ? 'bg-[hsl(var(--terminal-code-bg))] border-primary/20'
                    : 'bg-popover border-border',
                )}
              >
                {LANGUAGE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type='button'
                    onClick={() => {
                      setLang(opt.value);
                      setLangOpen(false);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-1.5 text-xs font-mono transition',
                      opt.value === lang
                        ? isTerminal
                          ? 'bg-primary/20 text-primary'
                          : 'bg-primary/10 text-primary font-semibold'
                        : isTerminal
                          ? 'text-foreground/80 hover:bg-primary/10'
                          : 'text-foreground/80 hover:bg-muted',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Run button */}
          <button
            type='button'
            onClick={handleRun}
            disabled={running}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isTerminal
                ? 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 font-mono'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
            )}
          >
            {running ? <Loader2 className='h-3 w-3 animate-spin' /> : <Play className='h-3 w-3' />}
            {running ? '실행 중...' : '실행'}
          </button>
        </div>
      </div>

      {/* CodeMirror editor mount point */}
      <div ref={editorRef} className='w-full' />

      {/* Output panel */}
      {(result || runError) && (
        <div
          className={cn(
            'border-t px-3 py-2 text-xs font-mono max-h-[140px] overflow-auto',
            isTerminal ? 'border-primary/20 bg-[hsl(var(--terminal-code-bg))]' : 'border-border/50 bg-muted/30',
          )}
        >
          <div
            className={cn(
              'mb-1 text-[10px] uppercase tracking-wider',
              isTerminal ? 'text-primary/50' : 'text-muted-foreground',
            )}
          >
            output{result ? ` · exit ${result.exitCode}` : ''}
          </div>

          {runError && <pre className='text-destructive whitespace-pre-wrap break-words'>{runError}</pre>}

          {result?.stdout && (
            <pre className={cn('whitespace-pre-wrap break-words', isTerminal ? 'text-primary/90' : 'text-foreground/90')}>
              {result.stdout}
            </pre>
          )}

          {result?.stderr && (
            <pre className='text-destructive/80 whitespace-pre-wrap break-words'>{result.stderr}</pre>
          )}

          {result && !result.stdout && !result.stderr && (
            <span className={cn(isTerminal ? 'text-primary/40' : 'text-muted-foreground')}>
              (no output)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
