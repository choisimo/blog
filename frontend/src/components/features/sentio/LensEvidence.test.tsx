import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import { ThemeProvider } from '@/contexts/ThemeContext';
import LensEvidence from '@/components/features/sentio/LensEvidence';

it('keeps partial explanations visible after failure and allows an explicit retry', async () => {
  let requests = 0;
  const user = userEvent.setup();
  const { rerender } = render(
    <LensEvidence
      available
      onGenerate={() => requests++}
      onStop={() => {}}
      state={{
        status: 'error',
        turns: [],
        draft: {
          question: '근거',
          body: '### 1. 메모리 주소\n\np에 저장된 값으로 메모리에 접근합니다.',
          questions: [],
        },
        error: '연결을 완료하지 못했습니다.',
      }}
    />,
    { wrapper: ThemeProvider }
  );
  expect(
    screen.getByRole('heading', { name: '1. 메모리 주소' })
  ).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent(
    '연결을 완료하지 못했습니다.'
  );
  await user.click(screen.getByRole('button', { name: '근거 분석 다시 시도' }));
  expect(requests).toBe(1);
  rerender(
    <LensEvidence
      available={false}
      onGenerate={() => requests++}
      onStop={() => {}}
    />
  );
  expect(
    screen.getByRole('button', { name: '근거 자세히 분석' })
  ).toBeDisabled();
  expect(
    screen.getByText('현재 AI 분석을 사용할 수 없습니다.')
  ).toBeInTheDocument();
});
