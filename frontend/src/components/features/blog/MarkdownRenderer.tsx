import ReactMarkdown from 'react-markdown';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Copy, Check, ChevronDown, ChevronUp, WrapText } from 'lucide-react';
import {
  Children,
  Fragment,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { Element as HastElement, ElementContent } from 'hast';
import { Button } from '@/components/ui/button';
import MarkdownRenderBoundary from '@/components/molecules/MarkdownRenderBoundary';
import { MarkdownTable } from '@/components/molecules/MarkdownTable';
import SparkInline from '@/components/molecules/SparkInline';
import { getMarkdownSanitizeSchema } from './markdownSanitizeSchema';
import { ArticleDiagram } from './visualization/ArticleDiagram';
import { parseArticleDiagram } from './visualization/articleDiagram';
import {
  ClickableImage,
  EmbeddedVideo,
  NormalizedVideoSource,
  type ArticleMediaLayout,
} from './ImageLightbox';
import { useTheme } from '@/contexts/ThemeContext';
import { writeTextToClipboard } from '@/lib/markdown/clipboard';
import {
  getMarkdownLinkPresentation,
  normalizeMarkdownHrefForProfile,
  normalizeMarkdownSource,
  resolveMarkdownMediaPath,
  type MarkdownRenderProfileName,
} from '@/lib/markdown/markdownPolicy';
import { cn } from '@/lib/utils';
import {
  createHeadingSlug,
  normalizeHeadingText,
} from '@/utils/content/markdownHeadings';

// Language modules are loaded on-demand the first time a code block using
// that language is rendered. This keeps the initial markdown chunk small.
const LANGUAGE_LOADERS: Record<string, () => Promise<{ default: unknown }>> = {
  bash: () => import('react-syntax-highlighter/dist/esm/languages/hljs/bash'),
  cpp: () => import('react-syntax-highlighter/dist/esm/languages/hljs/cpp'),
  css: () => import('react-syntax-highlighter/dist/esm/languages/hljs/css'),
  dockerfile: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/dockerfile'),
  go: () => import('react-syntax-highlighter/dist/esm/languages/hljs/go'),
  java: () => import('react-syntax-highlighter/dist/esm/languages/hljs/java'),
  javascript: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/javascript'),
  json: () => import('react-syntax-highlighter/dist/esm/languages/hljs/json'),
  kotlin: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/kotlin'),
  markdown: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/markdown'),
  plaintext: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/plaintext'),
  python: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/python'),
  rust: () => import('react-syntax-highlighter/dist/esm/languages/hljs/rust'),
  shell: () => import('react-syntax-highlighter/dist/esm/languages/hljs/shell'),
  sql: () => import('react-syntax-highlighter/dist/esm/languages/hljs/sql'),
  typescript: () =>
    import('react-syntax-highlighter/dist/esm/languages/hljs/typescript'),
  vim: () => import('react-syntax-highlighter/dist/esm/languages/hljs/vim'),
  yaml: () => import('react-syntax-highlighter/dist/esm/languages/hljs/yaml'),
};

// Aliases that map to the same loader key
const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  sh: 'shell',
  text: 'plaintext',
  tsx: 'typescript',
  ts: 'typescript',
};

const registeredLanguages = new Set<string>();

async function ensureLanguageRegistered(lang: string): Promise<boolean> {
  const canonical = LANGUAGE_ALIASES[lang] ?? lang;
  if (registeredLanguages.has(canonical)) return true;
  const loader = LANGUAGE_LOADERS[canonical];
  if (!loader) return false;
  try {
    const mod = await loader();
    const definition = mod.default as Parameters<
      typeof SyntaxHighlighter.registerLanguage
    >[1];
    SyntaxHighlighter.registerLanguage(canonical, definition);
    registeredLanguages.add(canonical);
    return true;
  } catch {
    // A failed optional highlighter must not hide the original code.
    return false;
  }
}

// Terminal-style syntax highlighting theme
const terminalTheme: { [key: string]: React.CSSProperties } = {
  ...atomOneDark,
  hljs: {
    ...atomOneDark['hljs'],
    color: '#c6f7d4',
    background: 'hsl(200 50% 3%)',
    border: '1px solid hsl(200 30% 12%)',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  'hljs-comment': { color: '#4e5953', fontStyle: 'italic' },
  'hljs-keyword': { color: '#3cff96' },
  'hljs-string': { color: '#3cb8ff' },
  'hljs-title': { color: '#3cff96' },
  'hljs-number': { color: '#ffb02e' },
  'hljs-operator': { color: '#3cff96' },
  'hljs-punctuation': { color: '#7f8f87' },
  'hljs-variable': { color: '#e4f4e8' },
  'hljs-class .hljs-title': { color: '#3cb8ff' },
  'hljs-literal': { color: '#ffb02e' },
  'hljs-built_in': { color: '#ffb02e' },
};

interface MarkdownRendererProps {
  content: string;
  className?: string;
  inlineEnabled?: boolean;
  postTitle?: string;
  postPath?: string; // e.g., "2025/future-tech-six-insights" for resolving relative image paths
  profile?: Extract<MarkdownRenderProfileName, 'article' | 'preview'>;
}

const IFRAME_AUTO_HEIGHT_MESSAGE_TYPE = 'blog-iframe-auto-height';
const IFRAME_AUTO_HEIGHT_REQUEST_TYPE = 'blog-iframe-request-height';
const IFRAME_AUTO_HEIGHT_SOURCE = 'nodove-blog-embed';
const DEFAULT_EMBED_HEIGHT = 760;
const MIN_EMBED_HEIGHT = 320;
const MAX_EMBED_HEIGHT = 6000;

function clampEmbedHeight(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_EMBED_HEIGHT;
  return Math.max(
    MIN_EMBED_HEIGHT,
    Math.min(MAX_EMBED_HEIGHT, Math.round(value))
  );
}

function parseEmbedHeight(
  value: React.ComponentProps<'iframe'>['height']
): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampEmbedHeight(value);
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(px)?$/i);
  if (!match) return null;
  return clampEmbedHeight(Number(match[1]));
}

function normalizeIframeSrc(
  src: string | undefined,
  postPath: string
): string | undefined {
  return resolveMarkdownMediaPath(src, postPath) ?? undefined;
}

export function normalizeMarkdownLinkHref(
  href: string | undefined
): string | undefined {
  return normalizeMarkdownHrefForProfile(href, 'article') ?? undefined;
}

function extractEmbedHeightMessage(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null;

  const payload = data as Record<string, unknown>;
  if (payload.type !== IFRAME_AUTO_HEIGHT_MESSAGE_TYPE) return null;

  const value = payload.height;
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return null;

  return clampEmbedHeight(numeric);
}

interface EmbeddedIframeProps extends React.ComponentProps<'iframe'> {
  postPath: string;
  isTerminal: boolean;
  profile: Extract<MarkdownRenderProfileName, 'article' | 'preview'>;
}

function EmbeddedIframe({
  src,
  height,
  style,
  className,
  postPath,
  isTerminal,
  profile,
  loading,
  title,
  onLoad,
  ...rest
}: EmbeddedIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const resolvedSrc = useMemo(
    () =>
      normalizeIframeSrc(typeof src === 'string' ? src : undefined, postPath),
    [postPath, src]
  );

  const initialHeight = useMemo(
    () => parseEmbedHeight(height) ?? DEFAULT_EMBED_HEIGHT,
    [height]
  );
  const [frameHeight, setFrameHeight] = useState(initialHeight);

  useEffect(() => {
    setFrameHeight(initialHeight);
  }, [initialHeight, resolvedSrc]);

  useEffect(() => {
    if (profile === 'preview') return undefined;

    const onMessage = (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;

      const nextHeight = extractEmbedHeightMessage(event.data);
      if (!nextHeight) return;

      setFrameHeight(prev =>
        Math.abs(prev - nextHeight) < 2 ? prev : nextHeight
      );
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [profile]);

  if (!resolvedSrc) {
    return null;
  }

  if (profile === 'preview') {
    return (
      <div
        role='note'
        data-preview-blocked-embed='true'
        className={cn(
          'article-readable my-8 rounded-2xl border border-dashed border-border/70 bg-muted/30 px-5 py-6 text-sm text-muted-foreground',
          isTerminal &&
            'rounded border-primary/30 bg-[hsl(var(--terminal-code-bg))] font-mono',
          className
        )}
      >
        <strong className='block text-foreground'>외부 임베드 미리보기 제한</strong>
        <span className='mt-1 block'>
          편집 중에는 외부 문서를 실행하지 않습니다. 공개 본문에서 허용된 경우에만 로드됩니다.
        </span>
        <code className='mt-3 block overflow-x-auto whitespace-nowrap rounded bg-background/70 px-3 py-2 text-xs'>
          {resolvedSrc}
        </code>
      </div>
    );
  }

  return (
    <div className='my-8 max-w-5xl mx-auto'>
      <iframe
        {...rest}
        ref={iframeRef}
        src={resolvedSrc}
        title={title ?? 'Embedded content'}
        loading={loading ?? 'lazy'}
        className={cn(
          'w-full rounded-2xl border border-border/50 bg-card shadow-sm',
          isTerminal &&
            'rounded border-primary/35 bg-[hsl(var(--terminal-code-bg))]',
          className
        )}
        style={{
          border: 'none',
          minHeight: `${MIN_EMBED_HEIGHT}px`,
          width: '100%',
          ...style,
          height: `${frameHeight}px`,
        }}
        onLoad={event => {
          const targetWindow = iframeRef.current?.contentWindow;
          if (targetWindow) {
            targetWindow.postMessage(
              {
                type: IFRAME_AUTO_HEIGHT_REQUEST_TYPE,
                source: IFRAME_AUTO_HEIGHT_SOURCE,
              },
              '*'
            );
          }
          onLoad?.(event);
        }}
      />
    </div>
  );
}

function extractTextFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractTextFromNode).join(' ');
  }

  if (!isValidElement(node)) {
    return '';
  }

  const props = (node as ReactElement<{ children?: ReactNode }>).props ?? {};
  return Children.toArray(props.children).map(extractTextFromNode).join(' ');
}

function extractRawTextFromNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractRawTextFromNode).join('');
  }

  if (!isValidElement(node)) {
    return '';
  }

  const props = (node as ReactElement<{ children?: ReactNode }>).props ?? {};
  return Children.toArray(props.children).map(extractRawTextFromNode).join('');
}

function extractTextFromHastNode(node: ElementContent | undefined): string {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  if ('children' in node) {
    return node.children.map(extractTextFromHastNode).join('');
  }
  return '';
}

function normalizeClassNames(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .join(' ');
  }
  return '';
}

function extractCodeBlockDataFromPre(
  node: HastElement | undefined,
  fallbackChildren: ReactNode
): { className?: string; codeString: string } | null {
  const codeNode = node?.children.find(
    (child): child is HastElement =>
      child.type === 'element' && child.tagName === 'code'
  );

  if (codeNode) {
    const codeString = codeNode.children
      .map(extractTextFromHastNode)
      .join('')
      .replace(/\n$/, '');

    if (codeString) {
      const className = normalizeClassNames(codeNode.properties?.className);
      return {
        className: className || undefined,
        codeString,
      };
    }
  }

  const codeElement = Children.toArray(fallbackChildren).find(
    (
      child
    ): child is ReactElement<{ className?: string; children?: ReactNode }> =>
      isValidElement(child) && child.type === 'code'
  );

  if (!codeElement) {
    return null;
  }

  const codeString = extractRawTextFromNode(codeElement.props.children).replace(
    /\n$/,
    ''
  );

  if (!codeString) {
    return null;
  }

  return {
    className: codeElement.props.className,
    codeString,
  };
}

const SHELL_SNIPPET_PATTERN =
  /(^#!\/bin\/(?:ba|z|k)?sh)|(^|\n)\s*(sudo\s+)?(apt|awk|cat|chmod|cp|curl|docker|git|grep|journalctl|kubectl|logger|mail|mv|npm|pvecm|rm|sed|ssh|systemctl|tail|tee|ufw)\b|(\|\s*grep\b)/m;

function normalizeCodeLanguage(rawLanguage: string): {
  syntaxLanguage?: string;
  displayLanguage: string;
} {
  const normalized = rawLanguage.trim().toLowerCase();
  const aliasMap: Record<
    string,
    { syntaxLanguage?: string; displayLanguage: string }
  > = {
    bash: { syntaxLanguage: 'bash', displayLanguage: 'bash' },
    cpp: { syntaxLanguage: 'cpp', displayLanguage: 'cpp' },
    dockerfile: { syntaxLanguage: 'dockerfile', displayLanguage: 'dockerfile' },
    go: { syntaxLanguage: 'go', displayLanguage: 'go' },
    java: { syntaxLanguage: 'java', displayLanguage: 'java' },
    javascript: { syntaxLanguage: 'javascript', displayLanguage: 'javascript' },
    js: { syntaxLanguage: 'javascript', displayLanguage: 'javascript' },
    json: { syntaxLanguage: 'json', displayLanguage: 'json' },
    jsx: { syntaxLanguage: 'jsx', displayLanguage: 'jsx' },
    kotlin: { syntaxLanguage: 'kotlin', displayLanguage: 'kotlin' },
    markdown: { syntaxLanguage: 'markdown', displayLanguage: 'markdown' },
    md: { syntaxLanguage: 'markdown', displayLanguage: 'markdown' },
    plaintext: { syntaxLanguage: 'plaintext', displayLanguage: 'text' },
    py: { syntaxLanguage: 'python', displayLanguage: 'python' },
    python: { syntaxLanguage: 'python', displayLanguage: 'python' },
    rust: { syntaxLanguage: 'rust', displayLanguage: 'rust' },
    sh: { syntaxLanguage: 'shell', displayLanguage: 'shell' },
    shell: { syntaxLanguage: 'shell', displayLanguage: 'shell' },
    sql: { syntaxLanguage: 'sql', displayLanguage: 'sql' },
    text: { syntaxLanguage: 'plaintext', displayLanguage: 'text' },
    ts: { syntaxLanguage: 'typescript', displayLanguage: 'typescript' },
    tsx: { syntaxLanguage: 'tsx', displayLanguage: 'tsx' },
    typescript: { syntaxLanguage: 'typescript', displayLanguage: 'typescript' },
    vim: { syntaxLanguage: 'vim', displayLanguage: 'vim' },
    yaml: { syntaxLanguage: 'yaml', displayLanguage: 'yaml' },
    yml: { syntaxLanguage: 'yaml', displayLanguage: 'yaml' },
  };

  return aliasMap[normalized] ?? { displayLanguage: normalized || 'code' };
}

function inferCodeLanguage(codeString: string): {
  syntaxLanguage?: string;
  displayLanguage: string;
} {
  const trimmed = codeString.trim();

  if (!trimmed) {
    return { displayLanguage: 'code' };
  }

  if (SHELL_SNIPPET_PATTERN.test(trimmed)) {
    return { syntaxLanguage: 'shell', displayLanguage: 'shell' };
  }

  return { displayLanguage: 'code' };
}

type MarkdownCodeBlockPresentation =
  | { kind: 'text-panel' }
  | { kind: 'code-block'; syntaxLanguage?: string; displayLanguage: string };

const CJK_PROSE_PATTERN =
  /[\u1100-\u11FF\u3130-\u318F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;

const NATURAL_LANGUAGE_LETTER_PATTERN =
  /[A-Za-z\u1100-\u11FF\u3130-\u318F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;

const MARKDOWN_PROSE_MARKER_PATTERN =
  /(^|\s)(\*\*[^*\n]+\*\*|__[^_\n]+__|\[[^\]\n]+\]\([^)\n]+\)|`[^`\n]+`)/;

const CODE_LINE_START_PATTERN =
  /^(import|export|const|let|var|function|class|interface|type|enum|return|if|else|for|while|switch|case|try|catch|finally|throw|new|await|async|def|from|package|public|private|protected|select|insert|update|delete|create|alter|drop)\b/i;

const CODE_OPERATOR_PATTERN = /(=>|===|!==|==|!=|&&|\|\||[{};])/;
const ASSIGNMENT_LINE_PATTERN = /^[\w.$-]+\s*=\s*\S+/;
const STRUCTURED_KEY_VALUE_PATTERN =
  /^["']?[\w.-]+["']?\s*:\s*(?:["'{[\d]|true\b|false\b|null\b|$|[\w.-]+$)/i;

function isLikelyCodeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (CODE_LINE_START_PATTERN.test(trimmed)) return true;
  if (CODE_OPERATOR_PATTERN.test(trimmed)) return true;
  if (ASSIGNMENT_LINE_PATTERN.test(trimmed)) return true;
  if (
    !CJK_PROSE_PATTERN.test(trimmed) &&
    STRUCTURED_KEY_VALUE_PATTERN.test(trimmed)
  ) {
    return true;
  }

  return false;
}

function hasNaturalLanguageFlow(line: string): boolean {
  const words = line.trim().split(/\s+/).filter(Boolean);
  return words.length >= 3 && NATURAL_LANGUAGE_LETTER_PATTERN.test(line);
}

function isProseLikeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isLikelyCodeLine(trimmed)) return false;

  if (CJK_PROSE_PATTERN.test(trimmed)) {
    return /[\s.,:;!?()[\]{}'"“”‘’…·-]/.test(trimmed) || trimmed.length >= 12;
  }

  return (
    MARKDOWN_PROSE_MARKER_PATTERN.test(trimmed) &&
    hasNaturalLanguageFlow(trimmed)
  );
}

function isProseLikeUnlabeledBlock(codeString: string): boolean {
  const meaningfulLines = codeString
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (meaningfulLines.length === 0) return false;

  const proseLineCount = meaningfulLines.filter(isProseLikeLine).length;
  if (proseLineCount === 0) return false;

  const codeLineCount = meaningfulLines.filter(isLikelyCodeLine).length;
  if (codeLineCount > 0 && codeLineCount >= proseLineCount) return false;

  return proseLineCount >= Math.ceil(meaningfulLines.length / 2);
}

function classifyMarkdownCodeBlock(
  codeString: string,
  explicitLanguage: string | undefined
): MarkdownCodeBlockPresentation {
  if (explicitLanguage === 'text') {
    return { kind: 'text-panel' };
  }

  if (explicitLanguage) {
    return { kind: 'code-block', ...normalizeCodeLanguage(explicitLanguage) };
  }

  const inferredLanguage = inferCodeLanguage(codeString);
  if (inferredLanguage.displayLanguage === 'shell') {
    return { kind: 'code-block', ...inferredLanguage };
  }

  if (isProseLikeUnlabeledBlock(codeString)) {
    return { kind: 'text-panel' };
  }

  return { kind: 'code-block', ...inferredLanguage };
}

const TEXT_FENCE_PANEL_STYLES = {
  panel:
    'article-readable article-text-panel my-8 max-w-full whitespace-pre-wrap break-words rounded-xl border border-border/70 bg-muted/30 px-4 py-5 font-mono text-sm leading-7 text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-5 sm:py-6 sm:text-base sm:leading-8',
  terminalPanel:
    'border-primary/30 bg-[hsl(var(--terminal-code-bg))] text-primary/90 shadow-[0_0_24px_hsl(var(--primary)/0.08)]',
} as const;

const TEXT_FENCE_PANEL_INLINE_STYLE = {
  overflowX: 'visible',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'break-word',
  wordBreak: 'keep-all',
} as const;

const CODE_BLOCK_WRAPPING_STYLE = {
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
} satisfies React.CSSProperties;

const CODE_BLOCK_NO_WRAP_STYLE = {
  whiteSpace: 'pre',
  overflowWrap: 'normal',
  wordBreak: 'normal',
} satisfies React.CSSProperties;

const ARTICLE_EMPHASIS_STYLES = {
  strong: 'article-emphasis-strong',
  em: 'article-emphasis-em',
} as const;

interface TextFencePanelProps {
  codeString: string;
  isTerminalTheme: boolean;
}

function TextFencePanel({
  codeString,
  isTerminalTheme,
}: TextFencePanelProps) {
  return (
    <pre
      aria-label='Preformatted article panel'
      data-testid='markdown-text-panel'
      style={TEXT_FENCE_PANEL_INLINE_STYLE}
      className={cn(
        TEXT_FENCE_PANEL_STYLES.panel,
        isTerminalTheme && TEXT_FENCE_PANEL_STYLES.terminalPanel
      )}
    >
      {codeString}
    </pre>
  );
}

const INLINE_SAFE_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'br',
  'cite',
  'code',
  'del',
  'em',
  'i',
  'kbd',
  'mark',
  'q',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'time',
  'u',
  'var',
  'wbr',
]);

function hasNonInlineNode(node: unknown): boolean {
  if (!isValidElement(node)) return false;

  const props =
    (node as ReactElement<{ children?: ReactNode; src?: string }>).props ?? {};
  if (node.type === Fragment) {
    return Children.toArray(props.children).some(child =>
      hasNonInlineNode(child)
    );
  }

  if (
    node.type === CodeBlock ||
    node.type === TextFencePanel ||
    node.type === ClickableImage ||
    node.type === EmbeddedVideo ||
    node.type === NormalizedVideoSource ||
    node.type === EmbeddedIframe
  ) {
    return true;
  }

  if (typeof props.src === 'string' && props.src.length > 0) return true;

  if (typeof node.type === 'string' && !INLINE_SAFE_TAGS.has(node.type)) {
    return true;
  }

  const children = Children.toArray(props.children);
  return children.some(child => hasNonInlineNode(child));
}

function hasMeaningfulInlineContent(children: ReactNode[]): boolean {
  return children.some(child => {
    if (child == null || child === false) return false;
    if (typeof child === 'string' || typeof child === 'number') {
      return String(child).trim().length > 0;
    }
    if (!isValidElement(child)) return true;
    return extractRawTextFromNode(child).trim().length > 0;
  });
}

function splitMixedParagraphChildren(children: ReactNode[]): ReactNode[][] {
  const segments: ReactNode[][] = [];
  let inlineSegment: ReactNode[] = [];

  const flushInlineSegment = () => {
    if (hasMeaningfulInlineContent(inlineSegment)) {
      segments.push(inlineSegment);
    }
    inlineSegment = [];
  };

  children.forEach(child => {
    if (hasNonInlineNode(child)) {
      flushInlineSegment();
      segments.push([child]);
      return;
    }

    inlineSegment.push(child);
  });

  flushInlineSegment();

  return segments;
}

const DEFAULT_MEDIA_LAYOUT: ArticleMediaLayout = 'wide';

const MEDIA_LAYOUT_ALIASES: Record<string, ArticleMediaLayout> = {
  center: 'center',
  compact: 'compact',
  full: 'full',
  'full-width': 'full',
  left: 'aside-left',
  right: 'aside-right',
  'aside-left': 'aside-left',
  'aside-right': 'aside-right',
  wide: 'wide',
};

function normalizeMediaLayout(value: string | undefined): ArticleMediaLayout {
  if (!value) return DEFAULT_MEDIA_LAYOUT;
  return (
    MEDIA_LAYOUT_ALIASES[value.trim().toLowerCase()] ?? DEFAULT_MEDIA_LAYOUT
  );
}

function extractLayoutToken(rawValue: string | undefined): {
  value: string;
  layout?: ArticleMediaLayout;
} {
  const value = rawValue?.trim() ?? '';
  if (!value) return { value };

  const match = value.match(
    /\s*(?:\||#|\{|\[)\s*(wide|full-width|full|center|compact|left|right|aside-left|aside-right)\s*(?:\}|\])?\s*$/i
  );

  if (!match?.[1]) return { value };

  return {
    value: value.slice(0, match.index).trim(),
    layout: normalizeMediaLayout(match[1]),
  };
}

function extractLayoutFromClassName(className: string | undefined) {
  if (!className) return undefined;
  const tokens = className.split(/\s+/);
  const layoutToken = tokens
    .map(token => token.replace(/^article-(?:media-|image-)?/, ''))
    .find(token => MEDIA_LAYOUT_ALIASES[token.toLowerCase()]);

  return normalizeMediaLayout(layoutToken);
}

function normalizeDimension(
  value: React.ComponentProps<'img'>['width']
): string | number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function getMediaPresentation({
  alt,
  title,
  className,
}: {
  alt?: string;
  title?: string;
  className?: string;
}): {
  alt?: string;
  caption?: string;
  layout: ArticleMediaLayout;
} {
  const altToken = extractLayoutToken(alt);
  const titleToken = extractLayoutToken(title);
  const classLayout = extractLayoutFromClassName(className);
  const caption = altToken.value || titleToken.value || undefined;

  return {
    alt: caption,
    caption,
    layout:
      titleToken.layout ??
      altToken.layout ??
      classLayout ??
      DEFAULT_MEDIA_LAYOUT,
  };
}

// ============================================================================
// CodeBlock component — exact copy + wrapping + collapsible plain fallback
// ============================================================================
interface CodeBlockProps {
  codeString: string;
  syntaxLanguage?: string;
  displayLanguage: string;
  isTerminalTheme: boolean;
}

type CodeCopyState = 'idle' | 'copied' | 'failed';

const COLLAPSE_THRESHOLD = 25;
const COLLAPSED_MAX_LINES = 480; // ~25 lines worth of height in px

function CodeBlock({
  codeString,
  syntaxLanguage,
  displayLanguage,
  isTerminalTheme,
}: CodeBlockProps) {
  const lineCount = codeString.split('\n').length;
  const isLong = lineCount > COLLAPSE_THRESHOLD;
  const [collapsed, setCollapsed] = useState(isLong);
  const [wrapped, setWrapped] = useState(true);
  const [copyState, setCopyState] = useState<CodeCopyState>('idle');
  const [highlightReady, setHighlightReady] = useState(
    Boolean(
      syntaxLanguage &&
        registeredLanguages.has(LANGUAGE_ALIASES[syntaxLanguage] ?? syntaxLanguage)
    )
  );
  const copyResetTimerRef = useRef<number | null>(null);
  const copyRequestRef = useRef(0);
  const codeRegionId = useId();
  const label = displayLanguage || 'code';
  const showLineNumbers = lineCount > 1;
  const canonicalLanguage = syntaxLanguage
    ? (LANGUAGE_ALIASES[syntaxLanguage] ?? syntaxLanguage)
    : undefined;
  const wrappingStyle = wrapped
    ? CODE_BLOCK_WRAPPING_STYLE
    : CODE_BLOCK_NO_WRAP_STYLE;

  useEffect(() => {
    if (!canonicalLanguage) {
      setHighlightReady(false);
      return;
    }

    let live = true;
    setHighlightReady(registeredLanguages.has(canonicalLanguage));
    void ensureLanguageRegistered(canonicalLanguage).then(loaded => {
      if (live) setHighlightReady(loaded);
    });
    return () => {
      live = false;
    };
  }, [canonicalLanguage]);

  useEffect(() => {
    if (!isLong) setCollapsed(false);
  }, [isLong]);

  useEffect(() => {
    copyRequestRef.current += 1;
    setCopyState('idle');
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
      copyResetTimerRef.current = null;
    }
  }, [codeString]);

  useEffect(
    () => () => {
      copyRequestRef.current += 1;
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    },
    []
  );

  const copyCode = useCallback(async () => {
    const request = ++copyRequestRef.current;
    const copied = await writeTextToClipboard(codeString);
    if (request !== copyRequestRef.current) return;
    setCopyState(copied ? 'copied' : 'failed');
    if (copyResetTimerRef.current !== null) {
      window.clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = window.setTimeout(() => {
      setCopyState('idle');
      copyResetTimerRef.current = null;
    }, 2000);
  }, [codeString]);

  const copyLabel =
    copyState === 'copied'
      ? '코드 복사 완료'
      : copyState === 'failed'
        ? '코드 복사 실패'
        : '코드 복사';

  return (
    <div
      className='article-code-card group relative my-8'
      data-wrapped={wrapped}
      data-code-highlight-state={
        canonicalLanguage
          ? highlightReady
            ? 'ready'
            : 'plain-fallback'
          : 'plain'
      }
    >
      <div className='article-code-toolbar'>
        <span className='article-code-toolbar__label'>{isTerminalTheme ? `$ ${label}` : label}</span>
        <div className='article-code-toolbar__actions' role='group' aria-label='코드 도구'>
          <Button size='icon' variant='ghost' type='button'
            aria-label={wrapped ? '코드 줄 바꿈 끄기' : '코드 줄 바꿈 켜기'}
            aria-pressed={wrapped} aria-controls={codeRegionId}
            title={wrapped ? '줄 바꿈 끄기' : '줄 바꿈 켜기'}
            onClick={() => setWrapped(current => !current)}>
            <WrapText className='h-4 w-4' aria-hidden='true' />
          </Button>
          <Button size='icon' variant='ghost' type='button' data-testid='code-copy-btn'
            aria-label={copyLabel} title={copyLabel} onClick={() => { void copyCode(); }}>
            {copyState === 'copied' ? <Check className='h-4 w-4' aria-hidden='true' /> : <Copy className='h-4 w-4' aria-hidden='true' />}
          </Button>
        </div>
      </div>

      <div className='relative overflow-hidden'>
        <div
          id={codeRegionId}
          role='region'
          aria-label={`${label} 코드`}
          tabIndex={0}
          className={cn(
            'article-code-region ui-scroll-region transition-[max-height] motion-reduce:transition-none duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
            wrapped ? 'overflow-x-hidden' : 'overflow-x-auto',
            collapsed ? 'overflow-y-hidden' : 'overflow-y-visible'
          )}
          style={
            collapsed
              ? { maxHeight: `${COLLAPSED_MAX_LINES}px` }
              : { maxHeight: 'none' }
          }
        >
          {canonicalLanguage && highlightReady ? (
            <SyntaxHighlighter
              style={isTerminalTheme ? terminalTheme : atomOneDark}
              language={canonicalLanguage}
              PreTag='div'
              showLineNumbers={showLineNumbers}
              lineNumberStyle={{
                minWidth: '2.5em',
                paddingRight: '1em',
                color: isTerminalTheme
                  ? 'rgba(100,160,120,0.4)'
                  : 'rgba(148,163,184,0.55)',
                userSelect: 'none',
                fontSize: '0.78em',
                paddingTop: '0.15rem',
              }}
              customStyle={{
                margin: 0,
                padding: isTerminalTheme
                  ? '1.2rem 1.25rem 1.15rem'
                  : '1.15rem 1.2rem',
                borderRadius: 0,
                background: isTerminalTheme ? 'hsl(200 50% 3%)' : '#0f172a',
                border: 'none',
                boxShadow: 'none',
                fontSize: '0.92rem',
                lineHeight: 1.75,
                overflowX: 'visible',
                ...wrappingStyle,
              }}
              codeTagProps={{
                style: {
                  fontFamily:
                    "'JetBrains Mono', 'Fira Code', 'SFMono-Regular', Consolas, monospace",
                  fontSize: '0.92rem',
                  ...wrappingStyle,
                },
              }}
              className={cn(
                'article-code-highlighter !overflow-x-visible'
              )}
              wrapLongLines={wrapped}
            >
              {codeString}
            </SyntaxHighlighter>
          ) : (
            <pre
              data-testid='plain-code-fallback'
              data-language={canonicalLanguage}
              className={cn(
                'article-code-highlighter !overflow-x-visible m-0 p-5 font-mono text-[0.92rem] leading-7',
                wrapped
                  ? 'whitespace-pre-wrap [overflow-wrap:anywhere]'
                  : 'whitespace-pre',
                isTerminalTheme
                  ? 'rounded-t-none border-border bg-[hsl(var(--terminal-code-bg))] text-primary/90'
                  : 'border-slate-900/15 bg-slate-900 text-slate-100'
              )}
              style={wrappingStyle}
            >
              <code>{codeString}</code>
            </pre>
          )}
        </div>

        {isLong && collapsed && (
          <div
            className='pointer-events-none absolute bottom-0 left-0 right-0 h-24'
            style={{
              background: isTerminalTheme
                ? 'linear-gradient(to bottom, transparent, hsl(200 50% 3%))'
                : 'linear-gradient(to bottom, transparent, #282c34)',
            }}
          />
        )}
      </div>

      {isLong && (
        <button
          type='button'
          data-testid='code-collapse-toggle'
          aria-expanded={!collapsed}
          aria-controls={codeRegionId}
          onClick={() => setCollapsed(current => !current)}
          className={cn(
            'flex min-h-10 w-full items-center justify-center gap-2 border-t py-2 text-xs font-medium transition-colors',
            isTerminalTheme
              ? 'rounded-b-xl border-border bg-[hsl(var(--terminal-titlebar))] text-primary hover:bg-primary/10'
              : 'rounded-b-xl border-[#3e4451] bg-[#282c34] text-gray-400 hover:text-gray-200'
          )}
        >
          {collapsed ? (
            <>
              <ChevronDown className='h-3.5 w-3.5' aria-hidden='true' />
              <span>{lineCount - COLLAPSE_THRESHOLD}줄 더 보기</span>
            </>
          ) : (
            <>
              <ChevronUp className='h-3.5 w-3.5' aria-hidden='true' />
              <span>접기</span>
            </>
          )}
        </button>
      )}

      <span className='sr-only' aria-live='polite'>
        {copyState === 'copied'
          ? '코드를 복사했습니다.'
          : copyState === 'failed'
            ? '코드를 복사하지 못했습니다.'
            : ''}
      </span>
    </div>
  );
}

function MarkdownRendererInner({
  content,
  className = '',
  inlineEnabled = false,
  postTitle = '',
  postPath = '',
  profile = 'article',
}: MarkdownRendererProps) {
  const { isTerminal } = useTheme();
  const normalizedSource = useMemo(
    () => normalizeMarkdownSource(content),
    [content]
  );
  const sanitizeSchema = useMemo(
    () => getMarkdownSanitizeSchema(profile),
    [profile]
  );

  const sanitizedContent = useMemo(() => {
    if (!postTitle) return normalizedSource;
    const normalizedTitle = postTitle.trim().toLowerCase();
    const lines = normalizedSource.split(/\r?\n/);
    while (lines.length) {
      const first = lines[0].trim();
      const plain = first
        .replace(/^#+\s*/, '')
        .trim()
        .toLowerCase();
      if (plain && plain === normalizedTitle) {
        lines.shift();
        continue;
      }
      break;
    }
    return lines.join('\n');
  }, [normalizedSource, postTitle]);

  const markdownComponents = useMemo(() => {
    const headingSlugCounts = new Map<string, number>();
    const getHeadingId = (children: ReactNode): string => {
      const raw = normalizeHeadingText(extractTextFromNode(children));
      const base = createHeadingSlug(raw);
      const count = headingSlugCounts.get(base) ?? 0;
      headingSlugCounts.set(base, count + 1);
      return count === 0 ? base : `${base}-${count}`;
    };

    return {
      h1: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h1
            id={id}
            className={cn(
              'article-heading text-left text-4xl font-bold mt-12 mb-6 scroll-mt-24',
              isTerminal && 'terminal-glow'
            )}
          >
            {isTerminal && <span className='text-primary mr-2'>#</span>}
            {children}
          </h1>
        );
      },
      h2: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h2
            id={id}
            className={cn(
              'article-heading text-left text-3xl font-semibold mt-10 mb-5 scroll-mt-24',
              isTerminal && 'terminal-glow'
            )}
          >
            {isTerminal && <span className='text-primary mr-2'>##</span>}
            {children}
          </h2>
        );
      },
      h3: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h3
            id={id}
            className={cn(
              'article-heading text-left text-2xl font-semibold mt-8 mb-4 scroll-mt-24',
              isTerminal && 'terminal-glow'
            )}
          >
            {isTerminal && <span className='text-primary mr-2'>###</span>}
            {children}
          </h3>
        );
      },
      h4: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h4
            id={id}
            className='article-readable text-xl font-semibold mt-4 mb-2 scroll-mt-24'
          >
            {children}
          </h4>
        );
      },
      h5: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h5
            id={id}
            className='article-readable text-lg font-semibold mt-4 mb-2 scroll-mt-24'
          >
            {children}
          </h5>
        );
      },
      h6: ({ children }: { children?: ReactNode }) => {
        const id = getHeadingId(children);
        return (
          <h6
            id={id}
            className='article-readable text-base font-semibold mt-4 mb-2 scroll-mt-24'
          >
            {children}
          </h6>
        );
      },
      p: ({ children }: { children?: ReactNode }) => {
        const childArray = Children.toArray(children);
        const renderInlineParagraph = (
          inlineChildren: ReactNode[],
          key?: number
        ) => {
          if (inlineEnabled) {
            return (
              <div className='article-readable' key={key}>
                <SparkInline postTitle={postTitle} wrapperTag='p'>
                  {inlineChildren}
                </SparkInline>
              </div>
            );
          }

          return (
            <p
              key={key}
              className={cn(
                'article-readable mb-6 text-pretty leading-8 text-foreground/90 [overflow-wrap:anywhere]'
              )}
            >
              {inlineChildren}
            </p>
          );
        };
        const containsNonInlineContent = childArray.some(child =>
          hasNonInlineNode(child)
        );

        if (containsNonInlineContent) {
          return (
            <>
              {splitMixedParagraphChildren(childArray).map((segment, idx) => (
                <Fragment key={idx}>
                  {segment.some(child => hasNonInlineNode(child))
                    ? segment.map((child, childIdx) => (
                        <Fragment key={childIdx}>{child}</Fragment>
                      ))
                    : renderInlineParagraph(segment)}
                </Fragment>
              ))}
            </>
          );
        }

        if (inlineEnabled) {
          return renderInlineParagraph(childArray);
        }

        return renderInlineParagraph(childArray);
      },
      ul: ({ children }: { children?: ReactNode }) => (
        <ul
          className={cn(
            'article-readable mb-7 list-disc space-y-3 pl-7 marker:text-primary/70',
            isTerminal && 'list-none'
          )}
        >
          {children}
        </ul>
      ),
      ol: ({ children }: { children?: ReactNode }) => (
        <ol className='article-readable mb-7 list-decimal space-y-3 pl-7 marker:font-semibold marker:text-primary/70'>
          {children}
        </ol>
      ),
      li: ({ children }: { children?: ReactNode }) => (
        <li
          className={cn(
            'pl-1 text-pretty leading-8 [overflow-wrap:anywhere]',
            isTerminal && 'before:content-["-_"] before:text-primary'
          )}
        >
          {children}
        </li>
      ),
      blockquote: ({ children }: { children?: ReactNode }) => (
        <blockquote
          className={cn(
            'article-readable relative my-9 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-muted/60 via-background to-muted/35 px-6 py-5 italic shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary',
            isTerminal &&
              'bg-[hsl(var(--terminal-code-bg))] border-primary/60 not-italic font-mono'
          )}
        >
          {children}
        </blockquote>
      ),
      strong: ({ children }: { children?: ReactNode }) => (
        <strong className={ARTICLE_EMPHASIS_STYLES.strong}>{children}</strong>
      ),
      em: ({ children }: { children?: ReactNode }) => (
        <em className={ARTICLE_EMPHASIS_STYLES.em}>{children}</em>
      ),
      pre({
        children,
        node,
        ...props
      }: React.ComponentProps<'pre'> & { node?: HastElement }) {
        const codeBlockData = extractCodeBlockDataFromPre(node, children);

        if (!codeBlockData) {
          return <pre {...props}>{children}</pre>;
        }

        const match = /language-([\w-]+)/.exec(codeBlockData.className || '');
        const explicitLanguage = match?.[1]?.trim().toLowerCase();

        if (explicitLanguage === 'diagram') {
          const diagram = parseArticleDiagram(codeBlockData.codeString);
          if (diagram)
            return (
              <ArticleDiagram key={codeBlockData.codeString} data={diagram} />
            );
        }

        const presentation = classifyMarkdownCodeBlock(
          codeBlockData.codeString,
          explicitLanguage
        );

        if (presentation.kind === 'text-panel') {
          return (
            <TextFencePanel
              codeString={codeBlockData.codeString}
              isTerminalTheme={isTerminal}
            />
          );
        }

        return (
          <CodeBlock
            codeString={codeBlockData.codeString}
            syntaxLanguage={presentation.syntaxLanguage}
            displayLanguage={presentation.displayLanguage}
            isTerminalTheme={isTerminal}
          />
        );
      },
      code({
        inline,
        className,
        children,
        node: _node,
        ...props
      }: React.ComponentProps<'code'> & {
        inline?: boolean;
        node?: unknown;
      }) {
        void inline;
        return (
          <code
            data-inline-code='true'
            className={cn(
              'bg-muted px-1.5 py-0.5 rounded text-sm',
              isTerminal &&
                'bg-[hsl(var(--terminal-code-bg))] text-primary font-mono',
              className
            )}
            {...props}
          >
            {children}
          </code>
        );
      },
      a: ({ href, children }: { href?: string; children?: ReactNode }) => {
        const link = getMarkdownLinkPresentation(href, profile);
        if (!link.href) return <span>{children}</span>;

        const isInertPreview = !link.interactive;
        return (
          <a
            href={link.href}
            target={link.target}
            rel={link.rel}
            aria-disabled={isInertPreview || undefined}
            tabIndex={isInertPreview ? -1 : undefined}
            data-preview-inert-link={isInertPreview ? 'true' : undefined}
            onClick={
              isInertPreview
                ? event => {
                    event.preventDefault();
                  }
                : undefined
            }
            className={cn(
              'font-medium text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:decoration-primary',
              isInertPreview && 'cursor-not-allowed opacity-70',
              isTerminal &&
                'underline decoration-dotted underline-offset-4 hover:decoration-solid'
            )}
          >
            {children}
          </a>
        );
      },
      img: ({
        src,
        alt,
        title,
        width,
        height,
        className,
      }: React.ComponentProps<'img'>) => {
        const media = getMediaPresentation({
          alt,
          title,
          className,
        });

        return (
          <ClickableImage
            src={src || ''}
            alt={media.alt}
            caption={media.caption}
            className={className}
            isTerminal={isTerminal}
            postPath={postPath}
            layout={media.layout}
            intrinsicWidth={normalizeDimension(width)}
            intrinsicHeight={normalizeDimension(height)}
          />
        );
      },
      video: ({
        src,
        children,
        autoPlay,
        loop,
        ...props
      }: React.ComponentProps<'video'> & { children?: ReactNode }) => (
        <EmbeddedVideo
          {...props}
          src={typeof src === 'string' ? src : ''}
          postPath={postPath}
          isTerminal={isTerminal}
          autoPlay={profile === 'preview' ? false : autoPlay}
          loop={profile === 'preview' ? false : loop}
        >
          {children}
        </EmbeddedVideo>
      ),
      source: ({ src, ...props }: React.ComponentProps<'source'>) => (
        <NormalizedVideoSource
          {...props}
          src={typeof src === 'string' ? src : undefined}
          postPath={postPath}
        />
      ),
      iframe: (props: React.ComponentProps<'iframe'>) => (
        <EmbeddedIframe
          {...props}
          postPath={postPath}
          isTerminal={isTerminal}
          profile={profile}
        />
      ),
      cite: ({ children }: { children?: ReactNode }) => <cite>{children}</cite>,
      hr: () => <hr className='article-wide-block my-12 border-border/70' />,
      table: ({ children }: { children?: ReactNode }) => (
        <MarkdownTable variant='article' isTerminal={isTerminal}>
          {children}
        </MarkdownTable>
      ),
      th: ({ children }: { children?: ReactNode }) => (
        <th
          className={cn(
            'whitespace-nowrap bg-muted/70 px-4 py-3 text-left text-sm font-semibold',
            isTerminal &&
              'bg-[hsl(var(--terminal-code-bg))] text-primary uppercase text-xs tracking-wider'
          )}
        >
          {children}
        </th>
      ),
      td: ({ children }: { children?: ReactNode }) => (
        <td className='border-t px-4 py-3 align-top leading-7'>{children}</td>
      ),
    };
  }, [
    inlineEnabled,
    isTerminal,
    postPath,
    postTitle,
    profile,
  ]);

  return (
    <div
      data-markdown-profile={profile}
      data-preserve-reading-position='true'
      className={cn(
        'article-flow prose prose-lg prose-neutral content max-w-none dark:prose-invert prose-headings:text-balance prose-p:text-pretty',
        isTerminal && 'prose-headings:font-mono prose-headings:tracking-wide',
        className
      )}
    >
      <MarkdownRenderBoundary source={sanitizedContent} variant='article'>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            rehypeRaw,
            [rehypeSanitize, sanitizeSchema],
          ]}
          components={markdownComponents}
        >
          {sanitizedContent}
        </ReactMarkdown>
      </MarkdownRenderBoundary>
    </div>
  );
}

const MarkdownRenderer = memo(
  MarkdownRendererInner,
  (prev, next) =>
    prev.content === next.content &&
    prev.className === next.className &&
    prev.inlineEnabled === next.inlineEnabled &&
    prev.postTitle === next.postTitle &&
    prev.postPath === next.postPath &&
    prev.profile === next.profile
);

export default MarkdownRenderer;
