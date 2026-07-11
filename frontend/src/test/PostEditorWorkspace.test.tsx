import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostEditorWorkspace } from '@/components/features/admin/content/PostEditorWorkspace';

const mocks = vi.hoisted(() => ({
  createPostPR: vi.fn(),
  logout: vi.fn(async () => undefined),
  toast: vi.fn(),
  uploadPostImages: vi.fn(),
}));

vi.mock('@/services/session/admin', () => ({
  createPostPR: mocks.createPostPR,
  uploadPostImages: mocks.uploadPostImages,
}));

vi.mock('@/hooks/ui/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/stores/session/useAuthStore', () => ({
  useAuthStore: () => ({
    logout: mocks.logout,
  }),
}));

vi.mock('@/components/features/blog/MarkdownRenderer', () => ({
  default: ({ content }: { content: string }) => (
    <div data-testid='markdown-preview'>{content}</div>
  ),
}));

vi.mock('@/components/features/admin/BotChatPanel', () => ({
  default: ({
    onInsertMarkdown,
  }: {
    onInsertMarkdown: (markdown: string) => void;
  }) => (
    <button type='button' onClick={() => onInsertMarkdown('AI assisted draft')}>
      Mock AI assistant
    </button>
  ),
}));

vi.mock('@/components/features/admin/AiImageGeneratorPanel', () => ({
  default: ({
    onInsertMarkdown,
  }: {
    onInsertMarkdown: (markdown: string) => void;
  }) => (
    <button
      type='button'
      onClick={() => onInsertMarkdown('![generated](/images/generated.png)')}
    >
      Mock image generation attach
    </button>
  ),
}));

function renderEditor() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <PostEditorWorkspace />
    </QueryClientProvider>,
  );
}

describe('PostEditorWorkspace', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.createPostPR.mockResolvedValue({
      status: 'pending',
      outboxId: 'outbox-1',
      branch: 'post/draft-title',
      path: 'frontend/public/posts/2026/draft-title.md',
    });
    mocks.uploadPostImages.mockResolvedValue({
      dir: '/images/2026/drag-hero',
      items: [
        {
          url: '/images/2026/drag-hero/hero.png',
          variantWebp: { url: '/images/2026/drag-hero/hero.webp' },
        },
      ],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('saves a local draft and restores it on the next mount', async () => {
    const firstRender = renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: '임시 저장 테스트' },
    });
    fireEvent.change(screen.getByLabelText('Markdown content editor'), {
      target: { value: '본문 초안입니다.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /^임시 저장$/ }));

    expect(
      window.localStorage.getItem('noblog.admin.postEditor.draft.v2'),
    ).toContain('본문 초안입니다.');

    firstRender.unmount();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByLabelText('제목')).toHaveValue('임시 저장 테스트');
    });
    expect(screen.getByLabelText('Markdown content editor')).toHaveValue(
      '본문 초안입니다.',
    );
  });

  it('round-trips an explicitly empty Markdown draft', async () => {
    const draftStorageKey = 'noblog.admin.postEditor.draft.v2';
    const firstRender = renderEditor();

    fireEvent.change(screen.getByLabelText('Markdown content editor'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^임시 저장$/ }));

    const savedDraft = window.localStorage.getItem(draftStorageKey);
    expect(savedDraft).not.toBeNull();
    expect(JSON.parse(savedDraft || '{}').content).toBe('');

    firstRender.unmount();
    renderEditor();

    await waitFor(() => {
      expect(screen.getByLabelText('Markdown content editor')).toHaveValue('');
    });
    expect(screen.getByLabelText('Markdown content editor')).not.toHaveValue(
      '## 개요\n\n',
    );
  });

  it('keeps a deleted draft absent until a later editor change autosaves again', () => {
    const draftStorageKey = 'noblog.admin.postEditor.draft.v2';
    vi.useFakeTimers();
    window.localStorage.clear();
    let editor: ReturnType<typeof renderEditor> | undefined;

    try {
      editor = renderEditor();
      fireEvent.change(screen.getByLabelText('카테고리'), {
        target: { value: '삭제 전 예약본' },
      });
      fireEvent.click(
        screen.getByRole('button', { name: '임시 저장 삭제' }),
      );

      expect(window.localStorage.getItem(draftStorageKey)).toBeNull();

      act(() => {
        vi.advanceTimersByTime(1201);
      });
      expect(window.localStorage.getItem(draftStorageKey)).toBeNull();

      fireEvent.change(screen.getByLabelText('카테고리'), {
        target: { value: '삭제 후 새 변경' },
      });
      act(() => {
        vi.advanceTimersByTime(1201);
      });

      const savedDraft = window.localStorage.getItem(draftStorageKey);
      expect(savedDraft).not.toBeNull();
      expect(JSON.parse(savedDraft || '{}')).toEqual(
        expect.objectContaining({ category: '삭제 후 새 변경' }),
      );
    } finally {
      editor?.unmount();
      vi.clearAllTimers();
      vi.useRealTimers();
      window.localStorage.clear();
    }
  });

  it('creates draft PRs through the admin session service without token plumbing', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Draft Title' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: 'draft-title' },
    });
    fireEvent.change(screen.getByLabelText('Markdown content editor'), {
      target: { value: '# Draft Title\n\nBody' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Draft PR/i }));

    await waitFor(() => {
      expect(mocks.createPostPR).toHaveBeenCalledTimes(1);
    });

    expect(mocks.createPostPR.mock.calls[0]).toHaveLength(1);
    expect(mocks.createPostPR).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Draft Title',
        slug: 'draft-title',
        content: '# Draft Title\n\nBody',
        draft: true,
      }),
    );
  });

  it('shows the bounded service rejection at the destructive PR failure sink', async () => {
    mocks.createPostPR.mockRejectedValueOnce(new Error('Bad message'));
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Draft Title' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: 'draft-title' },
    });
    fireEvent.change(screen.getByLabelText('Markdown content editor'), {
      target: { value: '# Draft Title\n\nBody' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Draft PR/i }));

    await waitFor(() => {
      expect(mocks.createPostPR).toHaveBeenCalledTimes(1);
      expect(mocks.toast).toHaveBeenCalledWith({
        title: 'PR 생성 실패',
        description: 'Bad message',
        variant: 'destructive',
      });
    });
  });

  it('normalizes post path fields before creating draft PRs', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: ' Draft Title\r\nX-Injected: yes ' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: '../Draft Title\r\nX-Injected: yes' },
    });
    fireEvent.change(screen.getByLabelText('Markdown content editor'), {
      target: { value: '# Draft Title\n\nBody' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Draft PR/i }));

    await waitFor(() => {
      expect(mocks.createPostPR).toHaveBeenCalledTimes(1);
    });

    expect(mocks.createPostPR).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Draft Title X-Injected: yes',
        slug: 'draft-title-x-injected-yes',
      }),
    );
  });

  it('uploads a dropped image and inserts the returned markdown into content', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Drag Hero' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: 'drag-hero' },
    });

    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    fireEvent.drop(screen.getByTestId('post-editor-dropzone'), {
      dataTransfer: {
        files: [file],
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
        types: ['Files'],
      },
    });

    await waitFor(() => {
      expect(mocks.uploadPostImages).toHaveBeenCalledWith(
        { year: expect.any(String), slug: 'drag-hero' },
        [file],
      );
    });
    expect(mocks.uploadPostImages.mock.calls[0]).toHaveLength(2);

    expect(
      (screen.getByLabelText('Markdown content editor') as HTMLTextAreaElement)
        .value,
    ).toContain('![Drag Hero](/images/2026/drag-hero/hero.webp)');

    const assetsTab = screen.getByRole('tab', { name: /Assets/i });
    fireEvent.mouseDown(assetsTab, { button: 0, ctrlKey: false });
    fireEvent.pointerDown(assetsTab, { button: 0, ctrlKey: false });
    fireEvent.click(assetsTab);

    expect(await screen.findByRole('button', { name: 'hero.png URL 복사' }))
      .toHaveAttribute('title', 'hero.png URL 복사');
  });

  it('ignores an overlapping paste upload until the active upload settles', async () => {
    let resolveFirstUpload!: (value: {
      dir: string;
      items: Array<{
        url: string;
        variantWebp?: { url: string } | null;
      }>;
    }) => void;
    mocks.uploadPostImages
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            resolveFirstUpload = resolve;
          }),
      )
      .mockResolvedValueOnce({
        dir: '/images/2026/overlap-guard',
        items: [
          {
            url: '/images/2026/overlap-guard/later.png',
            variantWebp: null,
          },
        ],
      });
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Overlap Guard' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: 'overlap-guard' },
    });

    const editor = screen.getByLabelText(
      'Markdown content editor',
    ) as HTMLTextAreaElement;
    const dropzone = screen.getByTestId('post-editor-dropzone');
    const uploadButton = screen.getByRole('button', { name: '이미지 첨부' });
    const dropImage = (file: File) => {
      fireEvent.drop(dropzone, {
        dataTransfer: {
          files: [file],
          items: [
            {
              kind: 'file',
              type: file.type,
              getAsFile: () => file,
            },
          ],
          types: ['Files'],
        },
      });
    };
    const firstFile = new File(['first-image'], 'first.png', {
      type: 'image/png',
    });
    const overlappingFile = new File(
      ['overlapping-image'],
      'overlapping.png',
      { type: 'image/png' },
    );
    const laterFile = new File(['later-image'], 'later.png', {
      type: 'image/png',
    });

    dropImage(firstFile);

    await waitFor(() => {
      expect(mocks.uploadPostImages).toHaveBeenCalledTimes(1);
      expect(uploadButton).toBeDisabled();
    });
    expect(mocks.uploadPostImages).toHaveBeenNthCalledWith(
      1,
      { year: expect.any(String), slug: 'overlap-guard' },
      [firstFile],
    );

    fireEvent.paste(editor, {
      clipboardData: {
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => overlappingFile,
          },
        ],
      },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mocks.uploadPostImages).toHaveBeenCalledTimes(1);
    expect(mocks.uploadPostImages.mock.calls[0]?.[1]).toEqual([firstFile]);
    expect(
      mocks.uploadPostImages.mock.calls.flatMap(call => call[1]),
    ).not.toContain(overlappingFile);
    expect(uploadButton).toBeDisabled();
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith({
      title: '이미지 업로드 진행 중',
      description: '진행 중인 업로드가 끝난 뒤 다시 시도하세요.',
    });

    await act(async () => {
      resolveFirstUpload({
        dir: '/images/2026/overlap-guard',
        items: [
          {
            url: '/images/2026/overlap-guard/first.png',
            variantWebp: {
              url: '/images/2026/overlap-guard/first.webp',
            },
          },
        ],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(editor.value).toContain(
        '![Overlap Guard](/images/2026/overlap-guard/first.webp)',
      );
      expect(uploadButton).toBeEnabled();
    });

    dropImage(laterFile);

    await waitFor(() => {
      expect(mocks.uploadPostImages).toHaveBeenCalledTimes(2);
    });
    expect(mocks.uploadPostImages).toHaveBeenNthCalledWith(
      2,
      { year: expect.any(String), slug: 'overlap-guard' },
      [laterFile],
    );
    await waitFor(() => {
      expect(editor.value).toContain(
        '![Overlap Guard](/images/2026/overlap-guard/later.png)',
      );
      expect(uploadButton).toBeEnabled();
    });
    const sentFiles = mocks.uploadPostImages.mock.calls.flatMap(
      call => call[1],
    );
    expect(sentFiles).toHaveLength(2);
    expect(sentFiles).toContain(firstFile);
    expect(sentFiles).toContain(laterFile);
    expect(sentFiles).not.toContain(overlappingFile);
  });

  it('inserts multiple uploaded images once in response order over the selected range', async () => {
    let resolveUpload!: (value: {
      dir: string;
      items: Array<{
        url: string;
        variantWebp?: { url: string } | null;
      }>;
    }) => void;
    mocks.uploadPostImages.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveUpload = resolve;
        }),
    );
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Gallery' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: 'gallery' },
    });

    const prefix = 'Authored prefix\n';
    const selected = 'Replace this middle range\n';
    const suffix = 'Authored suffix';
    const editor = screen.getByLabelText(
      'Markdown content editor',
    ) as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: { value: `${prefix}${selected}${suffix}` },
    });

    const firstFile = new File(['first-image'], 'first.png', {
      type: 'image/png',
    });
    const secondFile = new File(['second-image'], 'second.png', {
      type: 'image/png',
    });
    fireEvent.drop(screen.getByTestId('post-editor-dropzone'), {
      dataTransfer: {
        files: [firstFile, secondFile],
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => firstFile,
          },
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => secondFile,
          },
        ],
        types: ['Files'],
      },
    });

    await waitFor(() => {
      expect(mocks.uploadPostImages).toHaveBeenCalledTimes(1);
    });
    expect(mocks.uploadPostImages).toHaveBeenCalledWith(
      { year: expect.any(String), slug: 'gallery' },
      [firstFile, secondFile],
    );

    editor.focus();
    editor.setSelectionRange(prefix.length, prefix.length + selected.length);

    await act(async () => {
      resolveUpload({
        dir: '/images/2026/gallery',
        items: [
          {
            url: '/images/2026/gallery/first.png',
            variantWebp: { url: '/images/2026/gallery/first.webp' },
          },
          {
            url: '/images/2026/gallery/second.png',
            variantWebp: null,
          },
        ],
      });
    });

    const firstMarkdown = '![Gallery](/images/2026/gallery/first.webp)';
    const secondMarkdown = '![Gallery](/images/2026/gallery/second.png)';
    const insertedBatch = `${firstMarkdown}\n${secondMarkdown}\n`;
    const expectedContent = `${prefix}${insertedBatch}${suffix}`;
    const expectedCaret = prefix.length + insertedBatch.length;

    await waitFor(() => {
      expect(editor.value).toBe(expectedContent);
      expect(editor.selectionStart).toBe(expectedCaret);
      expect(editor.selectionEnd).toBe(expectedCaret);
    });
  });

  it('shows a bounded upload rejection and retries the retained files', async () => {
    mocks.uploadPostImages.mockRejectedValueOnce(
      new Error('Bounded presign failure'),
    );
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Drag Hero' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: 'drag-hero' },
    });

    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    fireEvent.drop(screen.getByTestId('post-editor-dropzone'), {
      dataTransfer: {
        files: [file],
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
        types: ['Files'],
      },
    });

    expect(
      await screen.findByText('Bounded presign failure'),
    ).toBeInTheDocument();
    expect(mocks.toast).toHaveBeenCalledWith({
      title: '이미지 첨부 실패',
      description: 'Bounded presign failure',
      variant: 'destructive',
    });

    const retryButton = screen.getByRole('button', {
      name: '실패한 업로드 다시 시도',
    });
    expect(retryButton).toBeEnabled();
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mocks.uploadPostImages).toHaveBeenCalledTimes(2);
    });
    expect(mocks.uploadPostImages).toHaveBeenNthCalledWith(
      2,
      { year: expect.any(String), slug: 'drag-hero' },
      [file],
    );
    await waitFor(() => {
      expect(
        screen.queryByText('Bounded presign failure'),
      ).not.toBeInTheDocument();
    });
  });

  it('normalizes the image upload path slug before uploading dropped images', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Drag Hero' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: '../Drag Hero\r\nX-Injected: yes' },
    });

    const file = new File(['image-bytes'], 'hero.png', { type: 'image/png' });
    fireEvent.drop(screen.getByTestId('post-editor-dropzone'), {
      dataTransfer: {
        files: [file],
        items: [
          {
            kind: 'file',
            type: 'image/png',
            getAsFile: () => file,
          },
        ],
        types: ['Files'],
      },
    });

    await waitFor(() => {
      expect(mocks.uploadPostImages).toHaveBeenCalledWith(
        { year: expect.any(String), slug: 'drag-hero-x-injected-yes' },
        [file],
      );
    });
  });

  it('lets assistant and generated-image panels attach content through the editor contract', async () => {
    renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Mock AI assistant' }));
    expect(
      (screen.getByLabelText('Markdown content editor') as HTMLTextAreaElement)
        .value,
    ).toContain('AI assisted draft');

    const imagesTab = screen.getByRole('tab', { name: /Images/i });
    fireEvent.mouseDown(imagesTab, { button: 0, ctrlKey: false });
    fireEvent.pointerDown(imagesTab, { button: 0, ctrlKey: false });
    fireEvent.click(imagesTab);
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Mock image generation attach' }),
      ).toBeInTheDocument();
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Mock image generation attach' }),
    );

    expect(
      (screen.getByLabelText('Markdown content editor') as HTMLTextAreaElement)
        .value,
    ).toContain('![generated](/images/generated.png)');
  });

  it('restores the cursor after generated markdown without adding phantom newline offset', async () => {
    renderEditor();

    const editor = screen.getByLabelText(
      'Markdown content editor',
    ) as HTMLTextAreaElement;
    fireEvent.change(editor, {
      target: { value: '첫 문단\n둘째 문단' },
    });
    editor.focus();
    editor.setSelectionRange(4, 4);

    const imagesTab = screen.getByRole('tab', { name: /Images/i });
    fireEvent.mouseDown(imagesTab, { button: 0, ctrlKey: false });
    fireEvent.pointerDown(imagesTab, { button: 0, ctrlKey: false });
    fireEvent.click(imagesTab);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Mock image generation attach',
      }),
    );

    await waitFor(() => {
      expect(editor.selectionStart).toBe(
        '첫 문단\n'.length + '![generated](/images/generated.png)\n'.length,
      );
    });
    expect(editor.selectionEnd).toBe(editor.selectionStart);
    expect(editor.value).toBe(
      '첫 문단\n![generated](/images/generated.png)\n둘째 문단',
    );
  });
});

describe('PostEditorWorkspace cover image URL boundaries', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mocks.createPostPR.mockResolvedValue({
      status: 'pending',
      outboxId: 'outbox-1',
      branch: 'post/draft-title',
      path: 'frontend/public/posts/2026/draft-title.md',
    });
    mocks.uploadPostImages.mockResolvedValue({
      dir: '/images/2026/draft-title',
      items: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('omits unsafe cover image URLs from draft PR payloads', async () => {
    renderEditor();

    fireEvent.change(screen.getByLabelText('제목'), {
      target: { value: 'Draft Title' },
    });
    fireEvent.change(screen.getByLabelText('슬러그'), {
      target: { value: 'draft-title' },
    });
    fireEvent.change(screen.getByLabelText('Markdown content editor'), {
      target: { value: '# Draft Title\n\nBody' },
    });
    fireEvent.change(screen.getByLabelText('커버 이미지 URL'), {
      target: { value: 'https://user:pass@example.com/%0a.png' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Draft PR/i }));

    await waitFor(() => {
      expect(mocks.createPostPR).toHaveBeenCalledTimes(1);
    });

    expect(mocks.createPostPR).toHaveBeenCalledWith(
      expect.objectContaining({
        frontmatter: expect.objectContaining({
          coverImage: undefined,
        }),
      }),
    );
  });
});
