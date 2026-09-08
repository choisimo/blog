import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CommentInputModal from './CommentInputModal';

const defaults = {
  isOpen: true, isTerminal: false, draftKey: '2026/post:comment', initialAuthor: 'nodove',
  authorLabel: '이름', contentLabel: '댓글', submitLabel: '댓글 게시', cancelLabel: '취소',
};

describe('comment composer UI lifecycle', () => {
  it('keeps an open draft when the parent theme or author defaults change', () => {
    const onClose = vi.fn(), onSubmit = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(<CommentInputModal {...defaults} onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole('textbox', { name: /댓글/ }), { target: { value: '아직 작성 중입니다.' } });
    rerender(<CommentInputModal {...defaults} isTerminal initialAuthor='changed' onClose={onClose} onSubmit={onSubmit} />);
    expect(screen.getByRole('textbox', { name: /댓글/ })).toHaveValue('아직 작성 중입니다.');
    expect(screen.getByRole('textbox', { name: /이름/ })).toHaveValue('nodove');
  });

  it('asks before discarding and restores focus when continuing', async () => {
    const onClose = vi.fn();
    render(<CommentInputModal {...defaults} onClose={onClose} onSubmit={vi.fn()} />);
    const content = screen.getByRole('textbox', { name: /댓글/ });
    fireEvent.change(content, { target: { value: '보존할 댓글' } });
    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '계속 작성' }));
    expect(content).toHaveValue('보존할 댓글');
    await waitFor(() => expect(content).toHaveFocus());
  });

  it('blocks duplicate sends and keeps the textarea after a failed request', async () => {
    let reject!: (error: Error) => void;
    const onSubmit = vi.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
    const onClose = vi.fn();
    render(<CommentInputModal {...defaults} onSubmit={onSubmit} onClose={onClose} />);
    const content = screen.getByRole('textbox', { name: /댓글/ });
    fireEvent.change(content, { target: { value: '저장하면 안 되는 중복 요청' } });
    const button = screen.getByRole('button', { name: '댓글 게시' });
    fireEvent.click(button); fireEvent.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(content).toBeDisabled();
    await act(async () => { reject(new Error('연결 오류')); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('연결 오류'));
    expect(content).toHaveValue('저장하면 안 되는 중복 요청');
    expect(content).not.toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not post to a changed reply context', () => {
    const onSubmit = vi.fn(), onClose = vi.fn();
    const { rerender } = render(<CommentInputModal {...defaults} onSubmit={onSubmit} onClose={onClose} />);
    fireEvent.change(screen.getByRole('textbox', { name: /댓글/ }), { target: { value: '첫 대상에 대한 내용' } });
    rerender(<CommentInputModal {...defaults} draftKey='2026/post:other-reply' onSubmit={onSubmit} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: '댓글 게시' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('대상이 변경');
  });
});
