import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { i18n } from './i18n';

describe('App', () => {
  it('renders in Albanian with shared formatting', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <App now={new Date('2026-11-13T20:42:00Z')} />
      </I18nextProvider>,
    );
    expect(screen.getByRole('heading', { name: 'Tavolina' })).toBeInTheDocument();
    expect(screen.getByText('Përditësuar 21:42')).toBeInTheDocument();
    expect(screen.getByText('1.234,50 €')).toBeInTheDocument();
  });
});
