import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import App from '../App';

const renderApp = async () => {
  await act(async () => {
    render(<App />);
  });
};

afterEach(() => {
  cleanup();
});

describe('Smoke: App routes render', () => {
  it('renders app without crashing', async () => {
    await renderApp();
    expect(
      screen.getAllByText(/Home|Latest Posts|블로그|Blog|Nodove/i).length
    ).toBeGreaterThan(0);
  });
});
