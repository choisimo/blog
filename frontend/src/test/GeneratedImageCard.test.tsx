import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneratedImageCard } from '@/components/features/ai/GeneratedImageCard';

const state = vi.hoisted(() => ({ scope: 'guest', preferences: {
  imageMode: 'auto', imageSize: '1536x1024', imageStyle: 'editorial',
} }));
vi.mock('@/services/personal/agentPreferences', () => ({
  preferenceScope: () => state.scope,
  getAgentPreferences: () => state.preferences,
  useAgentPreferences: () => state.preferences,
  shouldAutoIllustrate: () => true,
  getScopedPrincipalHeaders: async (_scope: string, init?: HeadersInit) => {
    const headers = new Headers(init); headers.set('Authorization', 'Bearer reader-test'); return headers;
  },
}));
vi.mock('@/utils/network/apiBase', () => ({ getApiBaseUrl: () => 'https://reader.test' }));

const result = { id: 'a'.repeat(64), url: `/api/v1/images/generated/${'a'.repeat(64)}`,
  alt: 'AI generated reader illustration', width: 1536, height: 1024, source: 'ai-generated',
  expiresAt: '2099-01-01T00:00:00Z' };
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const success = () => Response.json({ ok: true, data: result });
const failure = (code: string, status = 409) => Response.json({ ok: false, error: { code } }, { status });
let fetchMock: ReturnType<typeof vi.fn>;
let createObjectURL: ReturnType<typeof vi.fn>;

beforeEach(() => {
  state.scope = 'guest'; state.preferences.imageMode = 'auto';
  sessionStorage.clear();
  fetchMock = vi.fn(async (url: string) => url.includes('/generated/')
    ? new Response(png, { headers: { 'Content-Type': 'image/png' } }) : success());
  vi.stubGlobal('fetch', fetchMock);
  createObjectURL = vi.fn(() => 'blob:reader-generated');
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
  HTMLDialogElement.prototype.close = vi.fn();
  HTMLDialogElement.prototype.showModal = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function posts() { return fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST'); }
function statusReads() { return fetchMock.mock.calls.filter(([url]) => url.includes('/generations/')); }
async function tick() { await act(async () => { await vi.advanceTimersByTimeAsync(3000); }); }

describe('GeneratedImageCard real response application', () => {
  it('generates once in StrictMode, fetches authenticated PNG bytes, and exposes the result for viewing and download', async () => {
    const { rerender, unmount } = render(<StrictMode><GeneratedImageCard requestKey="render-once" prompt="Distributed system diagram" automatic /></StrictMode>);
    const image = await screen.findByRole('img', { name: result.alt });
    expect(image).toHaveAttribute('src', 'blob:reader-generated');
    expect(image).toHaveAttribute('width', '1536');
    expect(screen.getByRole('link', { name: '생성 이미지 저장' })).toHaveAttribute('href', 'blob:reader-generated');
    expect(posts()).toHaveLength(1);
    const [, options] = posts()[0];
    expect(options.headers.get('Idempotency-Key')).toBe('img-render-once');
    const privateRequest = fetchMock.mock.calls.find(([url]) => url.includes('/generated/'));
    expect(privateRequest?.[1].headers.get('Authorization')).toBe('Bearer reader-test');
    expect(privateRequest?.[1].redirect).toBe('error');
    expect(createObjectURL.mock.calls[0][0].size).toBe(png.length);
    fireEvent.click(screen.getByRole('button', { name: '생성 이미지 크게 보기' }));
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledOnce();
    rerender(<StrictMode><GeneratedImageCard requestKey="render-once" prompt="Distributed system diagram" automatic /></StrictMode>);
    expect(posts()).toHaveLength(1);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:reader-generated');
  });

  it('automatically polls accepted work and renders completion without another generation', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async (url: string) => url.endsWith('/generate') ? failure('IMAGE_IN_PROGRESS')
      : url.includes('/generations/') ? success() : new Response(png, { headers: { 'Content-Type': 'image/png' } }));
    await act(async () => { render(<GeneratedImageCard requestKey="pending-job" prompt="A queue diagram" automatic />); });
    expect(posts()).toHaveLength(1);
    expect(statusReads()).toHaveLength(0);
    await tick();
    expect(statusReads()).toHaveLength(1);
    expect(statusReads()[0][0]).toContain('/generations/img-pending-job');
    expect(screen.getByRole('img', { name: result.alt })).toHaveAttribute('src', 'blob:reader-generated');
    expect(posts()).toHaveLength(1);
  });

  it('restores the actual retry request key after reload and checks its status', async () => {
    vi.useFakeTimers();
    sessionStorage.setItem('reader.visual:guest:img-restored-job', JSON.stringify({
      phase: 'error', attempted: true, key: 'img-previous-explicit-retry', code: 'IMAGE_IN_PROGRESS', pollUntil: Date.now() + 60000,
    }));
    await act(async () => { render(<GeneratedImageCard requestKey="restored-job" prompt="A reader illustration" />); });
    await tick();
    expect(statusReads()[0][0]).toContain('/generations/img-previous-explicit-retry');
    expect(posts()).toHaveLength(0);
    expect(screen.getByRole('img', { name: result.alt })).toBeInTheDocument();
  });

  it('gives an explicit refunded retry a new key while retaining the same card', async () => {
    fetchMock.mockResolvedValueOnce(failure('IMAGE_PROVIDER_UNAVAILABLE', 503));
    render(<GeneratedImageCard requestKey="refunded-job" prompt="A reader illustration" automatic />);
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    await screen.findByRole('img', { name: result.alt });
    expect(posts()).toHaveLength(2);
    expect(posts()[0][1].headers.get('Idempotency-Key')).toBe('img-refunded-job');
    const retryKey = posts()[1][1].headers.get('Idempotency-Key');
    expect(retryKey).not.toBe('img-refunded-job');
    expect(JSON.parse(sessionStorage.getItem('reader.visual:guest:img-refunded-job')!).key).toBe(retryKey);
    expect(statusReads()).toHaveLength(0);
  });

  it('keeps the same key when quota rejected the request before reservation', async () => {
    fetchMock.mockResolvedValueOnce(failure('IMAGE_DAILY_LIMIT', 429));
    render(<GeneratedImageCard requestKey="quota-job" prompt="A reader illustration" automatic />);
    fireEvent.click(await screen.findByRole('button', { name: '다시 시도' }));
    await screen.findByRole('img', { name: result.alt });
    expect(posts()).toHaveLength(2);
    expect(posts()[0][1].headers.get('Idempotency-Key')).toBe(posts()[1][1].headers.get('Idempotency-Key'));
  });

  it('never resubmits an unknown paid outcome and stops polling when the card unmounts', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => failure('IMAGE_OUTCOME_UNKNOWN'));
    let view: ReturnType<typeof render>;
    await act(async () => { view = render(<GeneratedImageCard requestKey="unknown-job" prompt="A reader illustration" automatic />); });
    await tick(); await tick();
    expect(posts()).toHaveLength(1);
    expect(statusReads()).toHaveLength(2);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    view!.unmount();
    await tick();
    expect(statusReads()).toHaveLength(2);
  });

  it('allows failed image loading to retry the private download without regenerating', async () => {
    render(<GeneratedImageCard requestKey="broken-download" prompt="A reader illustration" automatic />);
    fireEvent.error(await screen.findByRole('img', { name: result.alt }));
    expect(screen.queryByRole('img', { name: result.alt })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 불러오기' }));
    await screen.findByRole('img', { name: result.alt });
    expect(posts()).toHaveLength(1);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
  });

  it('does not display a result that finishes after the account changes', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    const { rerender } = render(<GeneratedImageCard requestKey="account-change" prompt="A reader illustration" automatic expectedScope="guest" />);
    await waitFor(() => expect(posts()).toHaveLength(1));
    state.scope = 'account:other';
    rerender(<GeneratedImageCard requestKey="account-change" prompt="A reader illustration" automatic expectedScope="guest" />);
    await act(async () => { finish(success()); });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});
