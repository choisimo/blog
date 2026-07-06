import { act, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useChatActions } from '@/components/features/chat/widget/hooks/useChatActions';
import type {
  ChatMessage,
  LiveReplyTarget,
  UploadedChatImage,
} from '@/components/features/chat/widget/types';
import type { SelectedBlockAttachment } from '@/services/chat';

const serviceMocks = vi.hoisted(() => ({
  createChatIdempotencyKey: vi.fn(),
  streamChatEvents: vi.fn(),
  uploadChatImage: vi.fn(),
  invokeChatAggregate: vi.fn(),
  startNewSession: vi.fn(),
  getLiveRooms: vi.fn(),
  getLiveRoomStats: vi.fn(),
  getMemoryContextForChat: vi.fn(),
  extractAndSaveMemories: vi.fn(),
}));

vi.mock('@/services/chat', () => ({
  createChatIdempotencyKey: serviceMocks.createChatIdempotencyKey,
  streamChatEvents: serviceMocks.streamChatEvents,
  uploadChatImage: serviceMocks.uploadChatImage,
  invokeChatAggregate: serviceMocks.invokeChatAggregate,
  startNewSession: serviceMocks.startNewSession,
  getLiveRooms: serviceMocks.getLiveRooms,
  getLiveRoomStats: serviceMocks.getLiveRoomStats,
}));

vi.mock('@/services/personal/memory', () => ({
  getMemoryContextForChat: serviceMocks.getMemoryContextForChat,
  extractAndSaveMemories: serviceMocks.extractAndSaveMemories,
}));

type HookApi = ReturnType<typeof useChatActions>;
type HookHandle = {
  api: HookApi;
};

function Harness({
  currentLiveRoom = 'room:lobby',
  input,
  liveReplyTarget = null,
  onReady,
  selectedBlockAttachments: initialSelectedBlockAttachments = [],
  sendVisitorMessage = vi.fn().mockResolvedValue(undefined),
}: {
  currentLiveRoom?: string;
  input: string;
  liveReplyTarget?: LiveReplyTarget | null;
  onReady: (handle: HookHandle) => void;
  selectedBlockAttachments?: SelectedBlockAttachment[];
  sendVisitorMessage?: (input: {
    text: string;
    replyToName?: string;
    mentionedAgents?: string[];
  }) => Promise<void>;
}) {
  const [value, setInput] = useState(input);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [selectedBlockAttachments, setSelectedBlockAttachments] = useState<
    SelectedBlockAttachment[]
  >(initialSelectedBlockAttachments);
  const [, setUploadedImages] = useState<UploadedChatImage[]>([]);
  const [isAggregatePrompt, setIsAggregatePrompt] = useState(false);
  const [livePinned, setLivePinned] = useState(false);
  const [replyTarget, setLiveReplyTarget] = useState<LiveReplyTarget | null>(
    liveReplyTarget,
  );
  const abortRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef('');
  const push = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };
  const api = useChatActions({
    canSend: true,
    input: value,
    setInput,
    attachedImage,
    selectedBlockAttachments,
    setAttachedImage,
    setSelectedBlockAttachments,
    setAttachedPreviewUrl: vi.fn(),
    setBusy: vi.fn(),
    setFirstTokenMs: vi.fn(),
    abortRef,
    push,
    setMessages,
    isAggregatePrompt,
    setIsAggregatePrompt,
    questionMode: 'general',
    lastPromptRef,
    setUploadedImages,
    messages,
    setSessionKey: vi.fn(),
    currentLiveRoom,
    switchLiveRoom: vi.fn(),
    sendVisitorMessage,
    livePinned,
    setLivePinned,
    liveReplyTarget: replyTarget,
    setLiveReplyTarget,
  });

  useEffect(() => {
    onReady({ api });
  });

  return <output data-testid="messages">{JSON.stringify(messages)}</output>;
}

describe('useChatActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.createChatIdempotencyKey.mockReturnValue('idem-key');
    serviceMocks.startNewSession.mockResolvedValue('session-next');
  });

  it('normalizes live reply target metadata before sending direct live messages', async () => {
    const sendVisitorMessage = vi.fn().mockResolvedValue(undefined);
    let handle: HookHandle | null = null;

    render(
      <Harness
        input={' hello\u0000 '}
        liveReplyTarget={{
          name: ' Agent\r\nName ',
          senderType: 'agent',
        } as LiveReplyTarget}
        onReady={(next) => { handle = next; }}
        sendVisitorMessage={sendVisitorMessage}
      />,
    );

    await waitFor(() => expect(handle).not.toBeNull());
    await act(async () => {
      await handle?.api.send();
    });

    expect(sendVisitorMessage).toHaveBeenCalledWith({
      text: 'hello',
      replyToName: 'Agent Name',
      mentionedAgents: ['agent name'],
    });

    const messages = JSON.parse(
      screen.getByTestId('messages').textContent || '[]',
    ) as ChatMessage[];
    expect(messages[0].text).toBe('[Live → Agent Name] hello');
  });

  it('normalizes live room labels in status command messages', async () => {
    let handle: HookHandle | null = null;

    render(
      <Harness
        currentLiveRoom={'room:lobby\r\nInjected'}
        input="/live status"
        onReady={(next) => { handle = next; }}
      />,
    );

    await waitFor(() => expect(handle).not.toBeNull());
    await act(async () => {
      await handle?.api.send();
    });

    const messages = JSON.parse(
      screen.getByTestId('messages').textContent || '[]',
    ) as ChatMessage[];
    expect(messages[0].text).toContain('room: lobby Injected');
    expect(messages[0].text).not.toContain('\r');
    expect(messages[0].text).not.toContain('\nInjected');
  });

  it('normalizes selected block attachments before message redaction and stream requests', async () => {
    async function* stream() {
      yield { type: 'text', text: 'ok' };
    }
    serviceMocks.streamChatEvents.mockImplementation(stream);
    let handle: HookHandle | null = null;

    render(
      <Harness
        input=""
        selectedBlockAttachments={[
          {
            kind: 'selected-block',
            id: 'block\u0000/1',
            name: 'Block\r\nName',
            contentType: 'text/markdown',
            markdown: 'markdown\u0000\r\nbody',
            textPreview: 'Preview\r\nText',
            sizeBytes: -5,
            truncated: false,
            source: {
              title: 'Title\r\nInjected',
              year: '2026',
              slug: 'safe-slug',
            },
          } as SelectedBlockAttachment,
        ]}
        onReady={(next) => { handle = next; }}
      />,
    );

    await waitFor(() => expect(handle).not.toBeNull());
    await act(async () => {
      await handle?.api.send();
    });

    expect(serviceMocks.streamChatEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedBlockAttachments: [
          expect.objectContaining({
            id: 'block-1',
            name: 'Block Name',
            markdown: 'markdown\nbody',
            textPreview: 'Preview Text',
            sizeBytes: 0,
            source: expect.objectContaining({
              title: 'Title Injected',
            }),
          }),
        ],
      }),
    );
  });
});
