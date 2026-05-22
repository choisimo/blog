import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import MarkdownRenderer from '@/components/features/blog/MarkdownRenderer';

const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

const K8S_PROBE_INDENTED_EXCERPT = [
  '    startupProbe: 무거운 Spring Boot나 JVM 앱이 기지개를 켤 때, livenessProbe가 이를 장애로 오진하여 성급하게 목을 치는 참사를 막는 **유예 기간의 방패**다. 이 방패가 걷히기 전까지 다른 메스는 모두 잠잠하다.',
  '',
  '    livenessProbe: 이 검사에 실패하면 kubelet은 지체 없이 컨테이너의 뇌수(PID 1)에 SIGTERM 시그널을 박아 넣어 프로세스를 박살 내고 새로 띄운다. 교착 상태(Deadlock)에 빠진 좀비를 처리하는 물리적인 철퇴다. ',
  '',
  '    readinessProbe: 이는 실패하더라도 프로세스를 살려두되, API Server에 즉각 보고하여 Service의 iptables 라우팅 타겟 목록에서 이 Pod의 IP를 파내버린다. "심장은 뛰지만 트래픽을 받을 정신은 없는" 상태를 사회망으로부터 완벽히 격리하는 섬세한 장치다.',
].join('\n');

const K8S_PROBE_PANEL_TEXT = K8S_PROBE_INDENTED_EXCERPT.replace(
  /^ {4}/gm,
  ''
);

function getRequiredElement(container: HTMLElement, selector: string) {
  const element = container.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new Error(`Expected selector to match an element: ${selector}`);
  }
  return element;
}

function renderMarkdown(
  content: string,
  {
    postPath = '2024/proxmox-qdevice-voting-problem-guide',
    inlineEnabled = false,
  }: {
    postPath?: string;
    inlineEnabled?: boolean;
  } = {}
) {
  return render(
    <LanguageProvider>
      <TooltipProvider>
        <ThemeProvider>
          <MarkdownRenderer
            content={content}
            postPath={postPath}
            inlineEnabled={inlineEnabled}
          />
        </ThemeProvider>
      </TooltipProvider>
    </LanguageProvider>
  );
}

describe('MarkdownRenderer code blocks', () => {
  it('renders the k8s probe indented prose block as a readable text panel', () => {
    const { container } = renderMarkdown(K8S_PROBE_INDENTED_EXCERPT, {
      postPath: '2026/k8s-start',
    });

    const textPanel = screen.getByTestId('markdown-text-panel');

    expect(textPanel).toBeInTheDocument();
    expect(textPanel.textContent).toBe(K8S_PROBE_PANEL_TEXT);
    expect(container.querySelector('.article-code-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('code-copy-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('code-collapse-toggle')).not.toBeInTheDocument();
    expect(screen.queryByText(/^code$/i)).not.toBeInTheDocument();
  });

  it('renders fenced shell snippets without an explicit language as full code blocks', () => {
    const { container } = renderMarkdown(
      '```\npvecm qdevice remove\nrm -rf /etc/corosync/qdevice/\n```'
    );

    expect(container.querySelector('.article-code-card')).toBeInTheDocument();
    expect(screen.queryByTestId('markdown-text-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('code-copy-btn')).toBeInTheDocument();
    expect(screen.getByText(/shell/i)).toBeInTheDocument();
    expect(screen.getByText('pvecm qdevice remove')).toBeInTheDocument();
  });

  it('renders unlabeled code-like snippets as full code blocks', () => {
    const { container } = renderMarkdown(
      '```\nfunction demo() { return 1; }\nconst ok = true;\n```'
    );

    const codeCard = getRequiredElement(container, '.article-code-card');

    expect(codeCard).toHaveTextContent('function demo() { return 1; }');
    expect(codeCard).toHaveTextContent('const ok = true;');
    expect(screen.getByTestId('code-copy-btn')).toBeInTheDocument();
    expect(screen.getByText(/^code$/i)).toBeInTheDocument();
    expect(screen.queryByTestId('markdown-text-panel')).not.toBeInTheDocument();
  });

  it('wraps regular fenced code while preserving code card chrome', () => {
    const longLine = `const generatedLabel = '${'wrapped-code-token-'.repeat(12)}';`;
    const { container } = renderMarkdown(
      ['```ts', longLine, 'console.log(generatedLabel);', '```'].join('\n')
    );

    const codeCard = getRequiredElement(container, '.article-code-card');
    const highlighter = getRequiredElement(
      container,
      '.article-code-card .article-code-highlighter'
    );
    const highlighterStyle = getComputedStyle(highlighter);

    expect(codeCard).toHaveClass('article-code-card');
    expect(codeCard.matches('.article-flow > .article-code-card')).toBe(true);
    expect(screen.getByTestId('code-copy-btn')).toBeInTheDocument();
    expect(screen.getByText(/typescript/i)).toBeInTheDocument();
    expect(highlighter).toHaveClass(
      'article-code-highlighter',
      '!overflow-x-visible'
    );
    expect(highlighter).not.toHaveClass('!overflow-x-auto');
    expect(highlighterStyle.whiteSpace).toBe('pre-wrap');
    expect(highlighterStyle.getPropertyValue('overflow-wrap')).toBe('anywhere');
    expect(highlighterStyle.overflowX).not.toBe('auto');
    expect(highlighterStyle.overflowX).not.toBe('scroll');
  });

  it('keeps article readable text on the same desktop grid span as wide media', () => {
    const { container } = renderMarkdown(
      [
        'Readable paragraph with body copy.',
        '',
        '![Wide media](/images/2026/example.png)',
        '',
        '```js',
        'const ok = true;',
        '```',
      ].join('\n')
    );
    const paragraph = getRequiredElement(
      container,
      '.article-flow > p.article-readable'
    );
    const mediaFrame = getRequiredElement(
      container,
      '.article-flow > .article-media-frame[data-layout="wide"]'
    );
    const codeCard = getRequiredElement(container, '.article-flow > .article-code-card');
    const articleReadableDesktopGrid = indexCss.match(
      /@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*?\.article-flow[\s\S]*?>\s*:where\([\s\S]*?\.article-readable[\s\S]*?\)\s*\{[\s\S]*?grid-column:\s*([^;]+);/
    );
    const wideMediaDesktopGrid = indexCss.match(
      /@media\s*\(min-width:\s*1024px\)\s*\{[\s\S]*?\.article-flow\s*>\s*\.article-media-frame\[data-layout='wide'\],[\s\S]*?grid-column:\s*([^;]+);/
    );

    expect(paragraph.matches('.article-flow > .article-readable')).toBe(true);
    expect(mediaFrame.matches('.article-flow > .article-media-frame')).toBe(true);
    expect(codeCard.matches('.article-flow > .article-code-card')).toBe(true);
    expect(articleReadableDesktopGrid?.[1]?.replace(/\s+/g, ' ').trim()).toBe(
      '1 / -1'
    );
    expect(wideMediaDesktopGrid?.[1]?.replace(/\s+/g, ' ').trim()).toBe(
      '1 / -1'
    );
  });

  it('renders explicit text fences as readable preformatted article panels', () => {
    const { container } = renderMarkdown(
      '```text\nroot\n├── left\n│   └── child\n└── right\n```'
    );

    const textPanel = screen.getByTestId('markdown-text-panel');

    expect(textPanel).toBeInTheDocument();
    expect(textPanel.textContent).toBe(
      'root\n├── left\n│   └── child\n└── right'
    );
    expect(textPanel).toHaveClass(
      'article-readable',
      'article-text-panel',
      'whitespace-pre-wrap',
      'break-words'
    );
    expect(textPanel).not.toHaveClass('whitespace-pre');
    expect(textPanel).not.toHaveClass('overflow-x-auto');
    expect(textPanel).not.toHaveClass('overscroll-x-contain');
    expect(textPanel.matches('.article-flow > .article-text-panel')).toBe(true);
    expect(textPanel).not.toHaveAttribute('tabindex');
    expect(container.querySelector('.article-code-card')).not.toBeInTheDocument();
    expect(
      container.querySelector('.article-code-highlighter')
    ).not.toBeInTheDocument();
    expect(textPanel.querySelector('code')).not.toBeInTheDocument();
    expect(screen.queryByTestId('code-copy-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('code-collapse-toggle')).not.toBeInTheDocument();
    expect(screen.queryByText(/^text$/i)).not.toBeInTheDocument();
  });

  it('wraps long text fence lines without horizontal scrolling classes', () => {
    const longLine =
      'this-is-a-very-long-preformatted-prose-line-that-should-wrap-within-the-readable-article-panel-instead-of-requiring-horizontal-scrolling';

    renderMarkdown(
      ['```text', 'start', `  ${longLine}`, 'end', '```'].join('\n')
    );

    const textPanel = screen.getByTestId('markdown-text-panel');

    const computedStyle = getComputedStyle(textPanel);

    expect(textPanel.textContent).toBe(`start\n  ${longLine}\nend`);
    expect(textPanel).toHaveClass('whitespace-pre-wrap', 'break-words');
    expect(textPanel).not.toHaveClass('whitespace-pre');
    expect(textPanel).not.toHaveClass('overflow-x-auto');
    expect(textPanel).not.toHaveClass('overscroll-x-contain');
    expect(computedStyle.whiteSpace).toBe('pre-wrap');
    expect(computedStyle.getPropertyValue('overflow-wrap')).toBe('break-word');
    expect(computedStyle.wordBreak).toBe('keep-all');
    expect(computedStyle.overflowX).not.toBe('auto');
    expect(computedStyle.overflowX).not.toBe('scroll');
  });

  it('keeps inline code as inline code without block affordances', () => {
    const { container } = renderMarkdown('Use `append` here.');
    const inlineCode = screen.getByText('append', { selector: 'code' });

    expect(screen.queryByTestId('code-copy-btn')).not.toBeInTheDocument();
    expect(container.querySelector('pre')).not.toBeInTheDocument();
    expect(inlineCode).toBeInTheDocument();
    expect(inlineCode).toHaveAttribute('data-inline-code', 'true');
    expect(inlineCode).toHaveClass('bg-muted', 'px-1.5', 'py-0.5', 'rounded');
    expect(inlineCode).not.toHaveClass(
      'article-emphasis-strong',
      'article-emphasis-em'
    );
  });

  it('renders strong and emphasis with semantic tags and strengthened article classes', () => {
    renderMarkdown('Body **strong copy** and *emphasized copy* keep `code` plain.');

    const strong = screen.getByText('strong copy', { selector: 'strong' });
    const emphasis = screen.getByText('emphasized copy', { selector: 'em' });
    const inlineCode = screen.getByText('code', { selector: 'code' });

    expect(strong.tagName).toBe('STRONG');
    expect(strong).toHaveClass('article-emphasis-strong');
    expect(emphasis.tagName).toBe('EM');
    expect(emphasis).toHaveClass('article-emphasis-em');
    expect(inlineCode).toHaveAttribute('data-inline-code', 'true');
    expect(inlineCode).not.toHaveClass(
      'article-emphasis-strong',
      'article-emphasis-em'
    );
  });

  it('does not send inline identifiers into pre blocks', () => {
    const { container } = renderMarkdown(
      'Use `append`, not `bad_loop`, in this paragraph.'
    );

    expect(screen.queryByTestId('code-copy-btn')).not.toBeInTheDocument();
    expect(container.querySelector('pre')).not.toBeInTheDocument();
    expect(
      screen.getByText('append', { selector: 'code' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('bad_loop', { selector: 'code' })
    ).toBeInTheDocument();
  });

  it('keeps inline code inside a single SparkInline paragraph', () => {
    const { container } = renderMarkdown(
      'Use `append`, not `bad_loop`, in this paragraph.',
      { inlineEnabled: true }
    );

    const inlineCodes = Array.from(container.querySelectorAll('code'));
    const paragraphParents = new Set(
      inlineCodes
        .map(code => code.closest('[data-spark-inline-wrapper="p"]'))
        .filter(Boolean)
    );

    expect(screen.queryByTestId('code-copy-btn')).not.toBeInTheDocument();
    expect(container.querySelector('pre')).not.toBeInTheDocument();
    expect(inlineCodes.map(code => code.textContent)).toEqual([
      'append',
      'bad_loop',
    ]);
    expect(paragraphParents.size).toBe(1);
    expect(
      container.querySelector('[data-spark-inline-wrapper="p"] div')
    ).toBeNull();
  });
});
