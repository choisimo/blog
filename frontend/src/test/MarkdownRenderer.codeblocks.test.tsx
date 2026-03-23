import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import MarkdownRenderer from '@/components/features/blog/MarkdownRenderer';

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
  it('renders fenced shell snippets without an explicit language as full code blocks', () => {
    renderMarkdown(
      '```\npvecm qdevice remove\nrm -rf /etc/corosync/qdevice/\n```'
    );

    expect(screen.getByTestId('code-copy-btn')).toBeInTheDocument();
    expect(screen.getByText(/shell/i)).toBeInTheDocument();
    expect(screen.getByText('pvecm qdevice remove')).toBeInTheDocument();
  });

  it('renders explicit text fences as code blocks with a text label', () => {
    renderMarkdown('```text\nline 1\nline 2\n```');

    expect(screen.getByTestId('code-copy-btn')).toBeInTheDocument();
    expect(screen.getByText(/text/i)).toBeInTheDocument();
    expect(screen.getByText('line 1')).toBeInTheDocument();
  });

  it('keeps inline code as inline code without block affordances', () => {
    const { container } = renderMarkdown('Use `append` here.');

    expect(screen.queryByTestId('code-copy-btn')).not.toBeInTheDocument();
    expect(container.querySelector('pre')).not.toBeInTheDocument();
    expect(
      screen.getByText('append', { selector: 'code' })
    ).toBeInTheDocument();
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
