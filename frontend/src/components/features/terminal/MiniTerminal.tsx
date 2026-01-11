import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePostsIndex } from '@/hooks/usePostsIndex';
import { cn } from '@/lib/utils';

type CommandHandler = (args: string[]) => string | void;

interface MiniTerminalProps {
  className?: string;
  onClose?: () => void;
}

export function MiniTerminal({ className, onClose }: MiniTerminalProps) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState<string[]>(['Type "help" for available commands.']);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { posts, searchPosts } = usePostsIndex();

  const appendOutput = useCallback((lines: string | string[]) => {
    const newLines = Array.isArray(lines) ? lines : [lines];
    setOutput(prev => [...prev, ...newLines]);
  }, []);

  const commands: Record<string, CommandHandler> = {
    help: () => `Available commands:
  search <query>  - Search posts by keyword
  cat <slug>      - Open a post (e.g., cat hello-world)
  ls              - List recent posts
  ls -tags        - List all tags
  ls -cat         - List all categories
  clear           - Clear terminal output
  exit            - Close terminal`,

    search: (args) => {
      const query = args.join(' ');
      if (!query) return 'Usage: search <query>';
      
      const results = searchPosts(query);
      if (results.length === 0) return `No results found for "${query}"`;
      
      return [
        `Found ${results.length} result(s):`,
        ...results.slice(0, 5).map(p => `  ${p.year}/${p.slug} - ${p.title}`),
        results.length > 5 ? `  ... and ${results.length - 5} more` : '',
      ].filter(Boolean).join('\n');
    },

    cat: (args) => {
      const slug = args[0];
      if (!slug) return 'Usage: cat <slug>';
      
      const post = posts.find(p => 
        p.slug === slug || 
        `${p.year}/${p.slug}` === slug ||
        p.title.toLowerCase().includes(slug.toLowerCase())
      );
      
      if (post) {
        navigate(`/blog/${post.year}/${post.slug}`);
        onClose?.();
        return `Opening: ${post.title}`;
      }
      return `Post not found: ${slug}`;
    },

    ls: (args) => {
      if (args.includes('-tags')) {
        const tags = [...new Set(posts.flatMap(p => p.tags || []))].sort();
        if (tags.length === 0) return 'No tags found.';
        return ['Tags:', ...tags.slice(0, 20).map(t => `  #${t}`), tags.length > 20 ? `  ... and ${tags.length - 20} more` : ''].filter(Boolean).join('\n');
      }
      
      if (args.includes('-cat') || args.includes('-categories')) {
        const categories = [...new Set(posts.map(p => p.category))].sort();
        if (categories.length === 0) return 'No categories found.';
        return ['Categories:', ...categories.map(c => `  ${c}`)].join('\n');
      }
      
      const recent = posts.slice(0, 10);
      if (recent.length === 0) return 'No posts found.';
      return ['Recent posts:', ...recent.map(p => `  ${p.year}/${p.slug}`)].join('\n');
    },

    clear: () => {
      setOutput([]);
    },

    exit: () => {
      onClose?.();
    },

    cd: (args) => {
      const path = args[0];
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

    pwd: () => window.location.pathname,

    whoami: () => 'guest@blog',

    date: () => new Date().toLocaleString(),

    echo: (args) => args.join(' '),
  };

  const handleCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
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
    )}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border bg-[hsl(var(--terminal-titlebar))]">
        <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-close))]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-minimize))]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--terminal-window-btn-maximize))]" />
        <span className="flex-1 text-center text-muted-foreground text-[10px]">mini-terminal</span>
      </div>

      <div ref={outputRef} className="h-48 overflow-y-auto p-3 space-y-0.5">
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
          placeholder="Type a command..."
          autoComplete="off"
          spellCheck={false}
        />
        <span className="terminal-cursor" />
      </div>
    </div>
  );
}

export default MiniTerminal;
