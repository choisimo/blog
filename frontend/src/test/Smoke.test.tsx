import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

const renderApp = () => render(<App />);

describe('Smoke: App routes render', () => {
  it('renders app without crashing', () => {
    renderApp();
    expect(
      screen.getAllByText(/Home|Latest Posts|블로그|Blog|Nodove/i).length
    ).toBeGreaterThan(0);
  });
});
