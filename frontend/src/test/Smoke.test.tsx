import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act } from 'react';
import App from '../App';

const renderApp = async () => {
  await act(async () => {
    render(<App />);
  });
};

const originalLocation = window.location;

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('Smoke: App routes render', () => {
  it('renders app without crashing', async () => {
    await renderApp();
    expect(
      screen.getAllByText(/Home|Latest Posts|블로그|Blog|Nodove/i).length
    ).toBeGreaterThan(0);
  });

  it('renders on the production host even when runtime-config.json is unavailable', async () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://noblog.nodove.com/'),
    });
    delete (window as Window & { APP_CONFIG?: unknown }).APP_CONFIG;
    delete (window as Window & { __APP_CONFIG?: unknown }).__APP_CONFIG;

    await renderApp();

    expect(
      screen.getAllByText(/Home|Latest Posts|블로그|Blog|Nodove/i).length
    ).toBeGreaterThan(0);
  });
});
