import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import About from '@/pages/public/About';
import {
  sendContactMessage,
  type ContactSendResult,
} from '@/services/engagement/contact';

vi.mock('@/hooks/seo/useSEO', () => ({ useSEO: vi.fn() }));
vi.mock('@/services/engagement/contact', () => ({
  sendContactMessage: vi.fn(),
}));

const message = {
  name: '테스트 사용자',
  email: 'reader@example.com',
  subject: '프로젝트 제안',
  message: '함께 작업하고 싶은 프로젝트가 있습니다.',
};

function fillContactForm() {
  fireEvent.change(screen.getByLabelText('이름'), {
    target: { value: message.name },
  });
  fireEvent.change(screen.getByLabelText('이메일'), {
    target: { value: message.email },
  });
  fireEvent.change(screen.getByLabelText('제목'), {
    target: { value: message.subject },
  });
  fireEvent.change(screen.getByLabelText('메시지'), {
    target: { value: message.message },
  });
  return screen.getByRole('form', { name: '메시지 보내기' });
}

describe('About contact form', () => {
  beforeEach(() => vi.clearAllMocks());

  it('locks the submitted fields and prevents a second request while sending, then confirms success in the form', async () => {
    let finish!: (result: ContactSendResult) => void;
    vi.mocked(sendContactMessage).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    render(<About />);
    const form = fillContactForm();

    fireEvent.submit(form);
    expect(sendContactMessage).toHaveBeenCalledWith(message);
    expect(screen.getByLabelText('메시지')).toBeDisabled();
    expect(screen.getByLabelText('이메일')).toBeDisabled();
    expect(screen.getByRole('button', { name: '보내는 중…' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      '메시지를 보내고 있습니다.'
    );
    fireEvent.submit(form);
    expect(sendContactMessage).toHaveBeenCalledTimes(1);

    await act(async () => finish({ provider: 'api' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      '메시지가 접수되었습니다.'
    );
    expect(screen.getByLabelText('메시지')).toHaveValue('');
    expect(screen.getByLabelText('메시지')).toBeEnabled();
    expect(screen.getByRole('button', { name: '메시지 보내기' })).toBeEnabled();
  });

  it('preserves input on failure, gives a direct email recovery link, and allows retry', async () => {
    vi.mocked(sendContactMessage).mockRejectedValueOnce(
      new Error('Provider failure')
    );
    render(<About />);
    const form = fillContactForm();

    fireEvent.submit(form);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '입력한 내용은 유지됩니다.'
    );
    expect(screen.getByLabelText('이름')).toHaveValue(message.name);
    expect(screen.getByLabelText('메시지')).toHaveValue(message.message);
    expect(
      screen.getByRole('link', { name: '이메일로 직접 보내기' })
    ).toHaveAttribute('href', 'mailto:nodove@nodove.com');

    vi.mocked(sendContactMessage).mockResolvedValueOnce({ provider: 'api' });
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        '메시지가 접수되었습니다.'
      )
    );
    expect(sendContactMessage).toHaveBeenCalledTimes(2);
    expect(sendContactMessage).toHaveBeenLastCalledWith(message);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
