import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  TerminalList,
  TerminalListItem,
  TerminalOutput,
  TerminalPanel,
  TerminalPrompt,
  TerminalSection,
} from './terminal-panel';

describe('TerminalPanel', () => {
  it('sanitizes panel, section, list, item, output, and prompt text boundaries', () => {
    const { container } = render(
      <TerminalPanel
        label={'\u001b]0;Hidden label\u0007\u001b[31mOUTPUT_LOG\u0000'}
        aria-label={'\u001b]0;Hidden panel\u0007\u001b[32mBuild panel\u0007'}
        title={'\u001b]0;Hidden title\u0007Panel title\u0008'}
        data-testid='terminal-panel'
      >
        <TerminalSection
          title={'\u001b]0;Hidden section title\u0007\u001b[33mDeploy steps\u0001'}
          aria-label={'\u001b]0;Hidden section\u0007\u001b[34mSection\u0002'}
          data-testid='terminal-section'
        >
          <TerminalList
            aria-label={'\u001b]0;Hidden list\u0007\u001b[35mStep list\u0003'}
            title={'\u001b]0;Hidden list title\u0007List title\u0004'}
          >
            <TerminalListItem
              highlight
              aria-label={'\u001b]0;Hidden item\u0007\u001b[36mInstall deps\u0005'}
              title={'\u001b]0;Hidden item title\u0007Item title\u0006'}
            >
              {'\u001b]0;Hidden item text\u0007Install\u0007 deps'}
            </TerminalListItem>
          </TerminalList>
          <TerminalOutput
            aria-label={'\u001b]0;Hidden output\u0007\u001b[37mOutput\u0008'}
            title={'\u001b]0;Hidden output title\u0007Output title\u0009'}
            data-testid='terminal-output'
          >
            {'\u001b]0;Hidden output text\u0007npm\u000a run build'}
          </TerminalOutput>
          <TerminalPrompt
            path={'\u001b]0;Hidden path\u0007\u001b[31m~/app\u000b'}
            aria-label={'\u001b]0;Hidden prompt\u0007\u001b[32mPrompt\u000c'}
            title={'\u001b]0;Hidden prompt title\u0007Prompt title\u000d'}
            data-testid='terminal-prompt'
          >
            {'\u001b]0;Hidden prompt text\u0007pnpm\u000e test'}
          </TerminalPrompt>
        </TerminalSection>
      </TerminalPanel>
    );

    const panel = screen.getByTestId('terminal-panel');
    const section = screen.getByTestId('terminal-section');
    const list = screen.getByRole('list', { name: 'Step list' });
    const item = screen.getByRole('listitem', { name: 'Install deps' });
    const output = screen.getByTestId('terminal-output');
    const prompt = screen.getByTestId('terminal-prompt');

    expect(panel).toHaveAttribute('aria-label', 'Build panel');
    expect(panel).toHaveAttribute('title', 'Panel title');
    expect(screen.getByText('OUTPUT_LOG')).toBeInTheDocument();
    expect(section).toHaveAttribute('aria-label', 'Section');
    expect(screen.getByRole('heading', { name: '// Deploy steps' })).toBeInTheDocument();
    expect(list).toHaveAttribute('title', 'List title');
    expect(item).toHaveTextContent('Install deps');
    expect(item).toHaveAttribute('title', 'Item title');
    expect(item).toHaveClass('text-foreground');
    expect(output).toHaveAttribute('aria-label', 'Output');
    expect(output).toHaveAttribute('title', 'Output title');
    expect(output).toHaveTextContent('npm run build');
    expect(prompt).toHaveAttribute('aria-label', 'Prompt');
    expect(prompt).toHaveAttribute('title', 'Prompt title');
    expect(prompt).toHaveTextContent('~/app');
    expect(prompt).toHaveTextContent('pnpm test');
    expect(container.textContent).not.toContain('Hidden');
  });

  it('preserves defaults, rich children, and empty sanitized attribute omission', () => {
    const { container } = render(
      <TerminalPanel
        aria-label={'\u001b]0;Hidden panel\u0007\u001b[31m\u0000'}
        title={'\u0007'}
        data-testid='empty-panel'
      >
        <TerminalSection title={'// \u001b]0;Hidden section\u0007\u001b[32mReady\u0008'}>
          <TerminalList
            aria-label={'\u0009'}
            title={'\u001b]0;Hidden list\u0007\u001b[33m\u0000'}
          >
            <TerminalListItem>
              <span data-testid='rich-item'>Rich item node</span>
            </TerminalListItem>
          </TerminalList>
          <TerminalOutput>
            {'\u001b]0;Hidden output\u0007line\u0000 two'}
          </TerminalOutput>
          <TerminalPrompt>
            <span data-testid='rich-prompt'>Rich prompt node</span>
          </TerminalPrompt>
        </TerminalSection>
      </TerminalPanel>
    );

    const panel = screen.getByTestId('empty-panel');
    const list = screen.getByRole('list');

    expect(panel).not.toHaveAttribute('aria-label');
    expect(panel).not.toHaveAttribute('title');
    expect(screen.getByText('OUTPUT_LOG')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '// Ready' })).toBeInTheDocument();
    expect(list).not.toHaveAttribute('aria-label');
    expect(list).not.toHaveAttribute('title');
    expect(screen.getByTestId('rich-item')).toHaveTextContent('Rich item node');
    expect(screen.getByText('line two')).toBeInTheDocument();
    expect(screen.getByText('~')).toBeInTheDocument();
    expect(screen.getByTestId('rich-prompt')).toHaveTextContent('Rich prompt node');
    expect(container.textContent).not.toContain('\u001b');
    expect(container.textContent).not.toContain('\u0007');
    expect(container.textContent).not.toContain('Hidden');
  });
});
