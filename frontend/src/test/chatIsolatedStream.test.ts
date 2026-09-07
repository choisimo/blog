import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.com',
}));
vi.mock('@/services/session/userContentAuth', () => ({
  getPrincipalToken: vi.fn(async () => 'principal-token'),
}));
import { streamChatEvents } from '@/services/chat/api';
import { createBackendSession } from '@/services/chat/session';
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it('keeps the main chat session unchanged when a card streams in its own session', async () => {
  localStorage.setItem('nodove_chat_session_id', 'visitor-session');
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response(
        'data: {"type":"session","sessionId":"card-session"}\n\ndata: {"type":"text","text":"new card text"}\n\ndata: {"type":"done"}\n\n',
        { headers: { 'Content-Type': 'text/event-stream' } }
      )
    );
  const events = [];
  for await (const event of streamChatEvents({
    text: 'Explore this card',
    sessionId: 'card-session',
  }))
    events.push(event);
  expect(events).toContainEqual({ type: 'text', text: 'new card text' });
  expect(localStorage.getItem('nodove_chat_session_id')).toBe(
    'visitor-session'
  );
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(fetchSpy).toHaveBeenCalledWith(
    'https://api.example.com/api/v1/chat/session/card-session/message',
    expect.objectContaining({
      headers: expect.objectContaining({
        Authorization: 'Bearer principal-token',
      }),
    })
  );
});

it('forwards cancellation to isolated session creation', async () => {
  const controller = new AbortController();
  const fetchSpy = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify({ id: 'card-session' })));
  await createBackendSession('Card exploration', { signal: controller.signal });
  expect(fetchSpy).toHaveBeenCalledWith(
    'https://api.example.com/api/v1/chat/session',
    expect.objectContaining({ signal: controller.signal })
  );
  expect(localStorage.getItem('nodove_chat_session_id')).toBeNull();
});
