import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MiniTerminal } from './MiniTerminal';

const terminalMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  usePostsIndex: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => terminalMocks.navigate,
}));

vi.mock('@/hooks/content/usePostsIndex', () => ({
  usePostsIndex: () => terminalMocks.usePostsIndex(),
}));

const safePost = {
  year: '\u001b]0;Hidden year\u00072026',
  slug: '\u001b]0;Hidden slug\u0007safe-post',
  title: '\u001b]0;Hidden title\u0007\u001b[31mSafe post\u001b[0m\u0007',
  category: '\u001b]0;Hidden category\u0007Engineer\u0000ing',
  tags: ['\u001b]0;Hidden tag\u0007React\u001b[0m', 'UI\u0000'],
};

const unsafePost = {
  year: '2026%2Fadmin',
  slug: 'hidden-post',
  title: 'Hidden post',
  category: 'Hidden',
  tags: ['Hidden'],
};

function typeCommand(command: string) {
  const input = screen.getByLabelText('Terminal command');
  fireEvent.change(input, { target: { value: command } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

describe('MiniTerminal', () => {
  beforeEach(() => {
    terminalMocks.navigate.mockReset();
    terminalMocks.usePostsIndex.mockReturnValue({
      posts: [safePost, unsafePost],
      searchPosts: vi.fn(() => [safePost, unsafePost]),
    });
  });

  it('sanitizes search output and filters posts with unsafe blog paths', () => {
    render(<MiniTerminal />);

    typeCommand('search post\u001b]0;Hidden query\u0007\u001b[31m\u001b[0m');

    expect(screen.getByText(/Found 1 result/)).toBeInTheDocument();
    expect(screen.getByText(/2026\/safe-post - Safe post/)).toBeInTheDocument();
    expect(screen.queryByText(/Hidden post/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hidden query/)).not.toBeInTheDocument();
  });

  it('navigates only to safe post paths from cat commands', () => {
    const onClose = vi.fn();
    render(<MiniTerminal onClose={onClose} />);

    typeCommand('cat hidden-post');

    expect(terminalMocks.navigate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Post not found: hidden-post')).toBeInTheDocument();

    typeCommand('cat safe-post');

    expect(terminalMocks.navigate).toHaveBeenCalledWith('/blog/2026/safe-post');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Opening: Safe post')).toBeInTheDocument();
  });

  it('sanitizes tags and categories derived from safe posts', () => {
    render(<MiniTerminal />);

    typeCommand('ls -tags');
    typeCommand('ls -cat');

    expect(screen.getByText(/#React/)).toBeInTheDocument();
    expect(screen.getByText(/#UI/)).toBeInTheDocument();
    expect(screen.getByText(/Engineering/)).toBeInTheDocument();
    expect(screen.queryByText(/Hidden/)).not.toBeInTheDocument();
  });

  it('sanitizes terminal accessibility labels, title, and placeholder', () => {
    render(
      <MiniTerminal
        label={'\u001b]0;Hidden label\u0007\u001b[31mPost terminal\u0000'}
        title={'\u001b]0;Hidden title\u0007Terminal\u0007 title'}
        inputLabel={'\u001b]0;Hidden input\u0007\u001b[32mCommand input\u0008'}
        placeholder={'\u001b]0;Hidden placeholder\u0007Type\u0009 command'}
        className='custom-terminal'
      />
    );

    const terminal = screen.getByRole('region', { name: 'Post terminal' });
    const output = screen.getByRole('log', { name: 'Post terminal output' });
    const input = screen.getByLabelText('Command input');

    expect(terminal).toHaveAttribute('title', 'Terminal title');
    expect(terminal).toHaveClass('custom-terminal');
    expect(output).toHaveAttribute('aria-live', 'polite');
    expect(input).toHaveAttribute('placeholder', 'Type command');
    expect(terminal.textContent).not.toContain('Hidden');
    expect(input.getAttribute('aria-label')).not.toContain('\u001b');
  });

  it('falls back to default terminal accessibility text when sanitized values are empty', () => {
    render(
      <MiniTerminal
        label={'\u001b]0;Hidden label\u0007\u001b[31m\u0000'}
        inputLabel={'\u0007'}
        placeholder={'\u001b]0;Hidden placeholder\u0007\u001b[32m\u0008'}
        title={'\u0009'}
      />
    );

    const terminal = screen.getByRole('region', { name: 'Mini terminal' });

    expect(terminal).not.toHaveAttribute('title');
    expect(screen.getByRole('log', { name: 'Mini terminal output' })).toBeInTheDocument();
    expect(screen.getByLabelText('Terminal command')).toHaveAttribute(
      'placeholder',
      'Type a command...'
    );
  });
});
