import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatInput } from './ChatInput';

const baseProps = () => ({
  input: '',
  onInputChange: vi.fn(),
  onKeyDown: vi.fn(),
  onSend: vi.fn(),
  onStop: vi.fn(),
  onClearAll: vi.fn(),
  onFileSelect: vi.fn(),
  selectedBlockAttachments: [],
  onRemoveSelectedBlockAttachment: vi.fn(),
  attachedImage: null,
  attachedPreviewUrl: null,
  busy: false,
  canSend: false,
  firstTokenMs: null,
  questionMode: 'general' as const,
  liveReplyTarget: null,
  onClearLiveReplyTarget: vi.fn(),
  isTerminal: true,
  isMobile: false,
  textareaRef: React.createRef<HTMLTextAreaElement>(),
  fileInputRef: React.createRef<HTMLInputElement>(),
  hasMessages: true,
});

describe('ChatInput', () => {
  it('sanitizes root accessibility labels and live reply placeholder names', () => {
    const props = baseProps();
    const { container } = render(
      <ChatInput
        {...props}
        label={'\u001b[31mChat composer\u0000'}
        title={'Composer\u0007 title'}
        liveReplyTarget={{
          id: 'reply-1',
          name: '\u001b[32mAlice\u0008',
          senderType: 'agent',
        }}
      />
    );

    const root = container.firstElementChild;
    const textarea = screen.getByTestId('chat-input');

    expect(root).toHaveAttribute('aria-label', 'Chat composer');
    expect(root).toHaveAttribute('title', 'Composer title');
    expect(textarea).toHaveAttribute(
      'placeholder',
      'Alice에게 라이브로 답장하기...'
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(root?.textContent).not.toContain('\u001b');
    expect(root?.textContent).not.toContain('\u0008');
  });

  it('sanitizes selected block attachment names and previews', () => {
    const props = baseProps();
    render(
      <ChatInput
        {...props}
        selectedBlockAttachments={[
          {
            id: 'block-1',
            name: '\u001b[31mSelected block\u0000',
            markdown: '\u001b[32mFallback preview\u0007',
            textPreview: 'Preview\u0008 text',
            sizeBytes: 2048,
            truncated: true,
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Selected block 미리보기 펼치기' }));

    expect(screen.getByText('Selected block')).toBeInTheDocument();
    expect(screen.getByText(/Preview text/)).toBeInTheDocument();
    expect(screen.getByText(/2KB/)).toBeInTheDocument();
    expect(screen.getByText(/truncated/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Selected block 미리보기 접기' }))
      .toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('chat-input').closest('div')?.textContent).not.toContain(
      '\u001b'
    );
  });

  it('sanitizes attached image names and exposes remove action labels', () => {
    const props = baseProps();
    const image = new File(['image'], '\u001b[31mavatar\u0000.png', {
      type: 'image/png',
    });

    render(
      <ChatInput
        {...props}
        attachedImage={image}
        attachedPreviewUrl='blob:test-image'
      />
    );

    const imagePreview = screen.getByRole('img', { name: 'avatar.png' });
    const removeButton = screen.getByRole('button', { name: '첨부 이미지 제거' });

    expect(imagePreview).toHaveAttribute('src', 'blob:test-image');
    expect(removeButton).toBeInTheDocument();
    expect(screen.getByText('avatar.png')).toBeInTheDocument();
  });

  it('rejects unsafe attachment ids and preview urls before rendering actions', () => {
    const props = baseProps();
    const image = new File(['image'], 'avatar.png', {
      type: 'image/png',
    });

    const { container } = render(
      <ChatInput
        {...props}
        selectedBlockAttachments={[
          {
            id: 'block-\u001b[31m1',
            name: 'Unsafe block',
            markdown: 'Unsafe preview',
            textPreview: '',
            sizeBytes: 1024,
            truncated: false,
          },
        ]}
        attachedImage={image}
        attachedPreviewUrl='javascript:alert(1)'
      />
    );

    expect(screen.queryByText('Unsafe block')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'avatar.png' })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('\u001b');
  });

  it('labels composer controls while busy', () => {
    const props = baseProps();

    render(
      <ChatInput
        {...props}
        busy
        canSend
        firstTokenMs={123}
        isTerminal={false}
      />
    );

    expect(screen.getByLabelText('채팅 메시지 입력')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이미지 첨부' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '응답 생성 중지' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '메시지 보내기' })).not.toBeInTheDocument();
  });
});
