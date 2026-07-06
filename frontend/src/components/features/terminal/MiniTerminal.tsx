import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostsIndex } from '@/hooks/content/usePostsIndex';
import { cn } from '@/lib/utils';

type CommandHandler = (args: string[]) => string | void;

interface MiniTerminalProps {
  className?: string;
  onClose?: () => void;
  label?: string;
  title?: string;
  inputLabel?: string;
  placeholder?: string;
}

type TerminalPost = {
  year: unknown;
  slug: unknown;
  title: unknown;
  category?: unknown;
  tags?: unknown;
};

type TerminalPostSummary = {
  year: string;
  slug: string;
  title: string;
  category: string;
  tags: string[];
  path: string;
  searchText: string;
};

const ANSI_ESCAPE_PATTERN =
  /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const TERMINAL_CONTROL_TEXT_PATTERN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const TERMINAL_ACCESSIBLE_TEXT_PATTERN = /[\u0000-\u001f\u007f-\u009f]/g;
const CONTROL_TEXT_DETECTOR = /[\u0000-\u001f\u007f-\u009f]/;
const UNSAFE_PATH_SEGMENT_PATTERN = /[\\/#?]/;
const DEFAULT_TERMINAL_LABEL = 'Mini terminal';
const DEFAULT_TERMINAL_INPUT_LABEL = 'Terminal command';
const DEFAULT_TERMINAL_PLACEHOLDER = 'Type a command...';

function sanitizeTerminalText(value: unknown, fallback = ''): string {
  const sanitized = String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(TERMINAL_CONTROL_TEXT_PATTERN, '')
    .trim();
  return sanitized || fallback;
}

function sanitizeTerminalAccessibleText(value: unknown, fallback = ''): string {
  const sanitized = String(value ?? '')
    .replace(ANSI_ESCAPE_PATTERN, '')
    .replace(TERMINAL_ACCESSIBLE_TEXT_PATTERN, '')
    .trim();
  return sanitized || fallback;
}

function sanitizeOptionalTerminalAccessibleText(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined;
  }

  const sanitized = sanitizeTerminalAccessibleText(value);

  return sanitized.length > 0 ? sanitized : undefined;
}

function normalizeBlogPathSegment(value: unknown): string | null {
  const segment = sanitizeTerminalText(value);
  if (!segment || UNSAFE_PATH_SEGMENT_PATTERN.test(segment)) return null;

  let decodedSegment: string;
  try {
    decodedSegment = decodeURIComponent(segment);
  } catch {
    return null;
  }

  if (
    !decodedSegment ||
    decodedSegment === '.' ||
    decodedSegment === '..' ||
    CONTROL_TEXT_DETECTOR.test(decodedSegment) ||
    UNSAFE_PATH_SEGMENT_PATTERN.test(decodedSegment)
  ) {
    return null;
  }

  return segment;
}

function toSafePostSummary(post: TerminalPost): TerminalPostSummary | null {
  const year = normalizeBlogPathSegment(post.year);
  const slug = normalizeBlogPathSegment(post.slug);
  if (!year || !slug) return null;

  const title = sanitizeTerminalText(post.title, 'Untitled');
  const category = sanitizeTerminalText(post.category);
  const tags = Array.isArray(post.tags)
    ? post.tags.map(tag => sanitizeTerminalText(tag)).filter(Boolean)
    : [];
  const path = `${year}/${slug}`;

  return {
    year,
    slug,
    title,
    category,
    tags,
    path,
    searchText: `${path} ${title}`.toLowerCase(),
  };
}

export function MiniTerminal({
  className,
  onClose,
  label = DEFAULT_TERMINAL_LABEL,
  title,
  inputLabel = DEFAULT_TERMINAL_INPUT_LABEL,
  placeholder = DEFAULT_TERMINAL_PLACEHOLDER,
}: MiniTerminalProps) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>(['Type "help" for available commands.']);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { posts, searchPosts } = usePostsIndex();
  const safeLabel = sanitizeTerminalAccessibleText(label, DEFAULT_TERMINAL_LABEL);
  const safeInputLabel = sanitizeTerminalAccessibleText(
    inputLabel,
    DEFAULT_TERMINAL_INPUT_LABEL
  );
  const safePlaceholder = sanitizeTerminalAccessibleText(
    placeholder,
    DEFAULT_TERMINAL_PLACEHOLDER
  );
  const safeTitle = sanitizeOptionalTerminalAccessibleText(title);

  const appendOutput = useCallback((lines: string | string[]) => {
    const newLines = Array.isArray(lines) ? lines : [lines];
    setOutput(prev => [...prev, ...newLines.map(line => sanitizeTerminalText(line))]);
  }, []);

  const commands: Record<string, CommandHandler> = useMemo(() => ({
    help: () => `Available commands:
  search <query>  - Search posts by keyword
  cat <slug>      - Open a post (e.g., cat hello-world)
  ls              - List recent posts
  ls -tags        - List all tags
  ls -cat         - List all categories
  clear           - Clear terminal output
  exit            - Close terminal`,

    search: (args) => {
      const query = sanitizeTerminalText(args.join(' '));
      if (!query) return 'Usage: search <query>';
      
      const results = searchPosts(query)
        .map(post => toSafePostSummary(post))
        .filter((post): post is TerminalPostSummary => post !== null);
      if (results.length === 0) return `No results found for "${query}"`;
      
      return [
        `Found ${results.length} result(s):`,
        ...results.slice(0, 5).map(p => `  ${p.path} - ${p.title}`),
        results.length > 5 ? `  ... and ${results.length - 5} more` : '',
      ].filter(Boolean).join('\n');
    },

    cat: (args) => {
      const slug = sanitizeTerminalText(args[0]);
      if (!slug) return 'Usage: cat <slug>';
      
      const post = posts
        .map(item => toSafePostSummary(item))
        .filter((item): item is TerminalPostSummary => item !== null)
        .find(p => 
        p.slug === slug || 
        p.path === slug ||
        p.searchText.includes(slug.toLowerCase())
      );
      
      if (post) {
        navigate(`/blog/${post.path}`);
        onClose?.();
        return `Opening: ${post.title}`;
      }
      return `Post not found: ${slug}`;
    },

    ls: (args) => {
      const safePosts = posts
        .map(post => toSafePostSummary(post))
        .filter((post): post is TerminalPostSummary => post !== null);

      if (args.includes('-tags')) {
        const tags = [...new Set(safePosts.flatMap(p => p.tags))].sort();
        if (tags.length === 0) return 'No tags found.';
        return ['Tags:', ...tags.slice(0, 20).map(t => `  #${t}`), tags.length > 20 ? `  ... and ${tags.length - 20} more` : ''].filter(Boolean).join('\n');
      }
      
      if (args.includes('-cat') || args.includes('-categories')) {
        const categories = [...new Set(safePosts.map(p => p.category).filter(Boolean))].sort();
        if (categories.length === 0) return 'No categories found.';
        return ['Categories:', ...categories.map(c => `  ${c}`)].join('\n');
      }
      
      const recent = safePosts.slice(0, 10);
      if (recent.length === 0) return 'No posts found.';
      return ['Recent posts:', ...recent.map(p => `  ${p.path}`)].join('\n');
    },

    clear: () => {
      setOutput([]);
    },

    exit: () => {
      onClose?.();
    },

    cd: (args) => {
      const path = sanitizeTerminalText(args[0]);
      if (!path) return 'Usage: cd <path>';
      if (path === '~' || path === '/') {
        navigate('/');
        onClose?.();
        return 'Navigating to home...';
      }
      if (path === 'blog' || path === '/blog') {
        navigate('/blog');
        onClose?.();
        return 'Navigating to blog...';
      }
      return `cd: ${path}: No such directory`;
    },

    pwd: () => sanitizeTerminalText(window.location.pathname, '/'),

    whoami: () => 'guest@blog',

    date: () => new Date().toLocaleString(),

    echo: (args) => sanitizeTerminalText(args.join(' ')),
  }), [navigate, onClose, posts, searchPosts]);

  const handleCommand = useCallback((cmd: string) => {
    const trimmed = sanitizeTerminalText(cmd);
    if (!trimmed) return;

    appendOutput(`$ ${trimmed}`);
    setHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);

    const [command, ...args] = trimmed.split(/\s+/);
    const handler = commands[command.toLowerCase()];

    if (handler) {
      const result = handler(args);
      if (result) appendOutput(result);
    } else {
      appendOutput(`Command not found: ${command}. Type "help" for available commands.`);
    }

    setInput('');
  }, [commands, appendOutput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        handleCommand(input);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (history.length > 0) {
          const newIndex = historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
          setHistoryIndex(newIndex);
          setInput(history[history.length - 1 - newIndex] || '');
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (historyIndex > 0) {
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(history[history.length - 1 - newIndex] || '');
        } else if (historyIndex === 0) {
          setHistoryIndex(-1);
          setInput('');
        }
        break;
      case 'Tab': {
        e.preventDefault();
        const partial = input.toLowerCase();
        const matches = Object.keys(commands).filter(c => c.startsWith(partial));
        if (matches.length === 1) {
          setInput(`${matches[0]} `);
        } else if (matches.length > 1) {
          appendOutput(`$ ${input}`);
          appendOutput(matches.join('  '));
        }
        break;
      }
      case 'Escape':
        onClose?.();
        break;
      case 'l':
        if (e.ctrlKey) {
          e.preventDefault();
          setOutput([]);
        }
        break;
    }
  }, [input, history, historyIndex, handleCommand, commands, appendOutput, onClose]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  return (
    <div className={cn(
      'font-mono text-xs bg-[hsl(var(--terminal-code-bg))] border border-border rounded-lg overflow-hidden',
      className
    )}
      role="region"
      aria-label={safeLabel}
      title={safeTitle}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-[hsl(var(--terminal-titlebar))]">
        <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" aria-hidden="true" />
        <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" aria-hidden="true" />
        <span className="flex-1 text-center text-muted-foreground text-[10px]">mini-terminal</span>
      </div>

      <div
        ref={outputRef}
        className="h-48 overflow-y-auto overscroll-contain p-3 space-y-0.5"
        role="log"
        aria-live="polite"
        aria-label={`${safeLabel} output`}
      >
        {output.map((line, i) => (
          <div 
            key={i} 
            className={cn(
              'whitespace-pre-wrap break-all',
              line.startsWith('$') ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            {line}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-border">
        <span className="text-primary">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
          placeholder={safePlaceholder}
          aria-label={safeInputLabel}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="terminal-cursor" aria-hidden="true" />
      </div>
    </div>
  );
}

export default MiniTerminal;
