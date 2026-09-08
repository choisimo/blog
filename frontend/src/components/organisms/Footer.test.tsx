import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Footer } from './Footer';

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ isTerminal: false }),
}));
vi.mock('@/utils/network/apiBase', () => ({
  getApiBaseUrl: () => 'https://api.example.test',
}));

const fetchMock = vi.fn<typeof fetch>();

function subscriptionForm() {
  render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );
  const input = screen.getByRole('textbox', { name: '이메일 주소' });
  const form = input.closest('form');
  if (!form) throw new Error('Subscription form is missing');
  return { input, form };
}

describe('Footer subscription feedback', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('validates the address without sending an invalid request', () => {
    const { input, form } = subscriptionForm();
    fireEvent.change(input, { target: { value: 'reader@localhost' } });
    fireEvent.submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('유효한 이메일 주소');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveValue('reader@localhost');
  });

  it('sends the trimmed address, locks pending controls and confirms only after success', async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      })
    );
    const { input, form } = subscriptionForm();
    fireEvent.change(input, { target: { value: ' reader@example.com ' } });
    fireEvent.submit(form);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/v1/subscribe',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'reader@example.com' }),
      })
    );
    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: '신청 중…' })).toBeDisabled();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
    await act(async () =>
      finish(new Response(JSON.stringify({ data: {} }), { status: 200 }))
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      '확인 이메일을 발송했습니다.'
    );
    expect(input).toBeEnabled();
    expect(input).toHaveValue('');
  });

  it('keeps the address on failure, hides raw provider details and clears feedback for a new attempt', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { message: 'provider internal diagnostic' } }),
        { status: 503 }
      )
    );
    const { input, form } = subscriptionForm();
    fireEvent.change(input, { target: { value: 'reader@example.com' } });
    fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '연결을 확인하고 다시 시도'
    );
    expect(
      screen.queryByText(/provider internal diagnostic/)
    ).not.toBeInTheDocument();
    expect(input).toHaveValue('reader@example.com');
    fireEvent.change(input, { target: { value: 'new-reader@example.com' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeEmptyDOMElement();

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { alreadySubscribed: true } }), {
        status: 200,
      })
    );
    fireEvent.submit(form);
    expect(await screen.findByText('이미 구독 중입니다.')).toBeInTheDocument();
    expect(input).toHaveValue('new-reader@example.com');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
