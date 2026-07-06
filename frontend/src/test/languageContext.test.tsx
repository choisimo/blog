import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LanguageProvider,
  useLanguage,
} from '@/contexts/LanguageContext';

function LanguageProbe() {
  const { language, setLanguage } = useLanguage();

  return (
    <div>
      <span data-testid='language'>{language}</span>
      <button type='button' onClick={() => setLanguage('en')}>
        Set English
      </button>
    </div>
  );
}

const renderLanguageProvider = () =>
  render(
    <LanguageProvider>
      <LanguageProbe />
    </LanguageProvider>
  );

const dispatchLanguageStorageEvent = (newValue: string | null) => {
  fireEvent(
    window,
    new StorageEvent('storage', {
      key: 'site.language',
      newValue,
    })
  );
};

describe('LanguageProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('applies valid cross-tab language storage events', () => {
    renderLanguageProvider();

    dispatchLanguageStorageEvent('en');

    expect(screen.getByTestId('language')).toHaveTextContent('en');
  });

  it('ignores malformed cross-tab language storage events', () => {
    renderLanguageProvider();
    fireEvent.click(screen.getByRole('button', { name: 'Set English' }));

    dispatchLanguageStorageEvent('javascript:alert(1)');
    dispatchLanguageStorageEvent(null);

    expect(screen.getByTestId('language')).toHaveTextContent('en');
  });
});
