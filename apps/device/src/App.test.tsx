import { render, screen } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import { App, layoutFor } from './App';
import { i18n } from './i18n';
import { PhoneShell } from './layouts/phone/PhoneShell';
import { TabletShell } from './layouts/tablet/TabletShell';

const withI18n = (ui: ReactElement) => <I18nextProvider i18n={i18n}>{ui}</I18nextProvider>;

describe('layoutFor', () => {
  it.each([
    [412, 915, 'phone'],
    [915, 412, 'phone'],
    [1280, 800, 'tablet'],
    [800, 1280, 'tablet'],
  ] as const)('%i x %i dp → %s', (width, height, layout) => {
    expect(layoutFor(width, height)).toBe(layout);
  });
});

describe('layouts', () => {
  it('renders the waiter layout in Albanian', async () => {
    await render(withI18n(<PhoneShell />));
    expect(screen.getByText('Kamarieri')).toBeOnTheScreen();
    expect(screen.getByText('3,50 €')).toBeOnTheScreen();
  });

  it('renders the counter layout in Albanian', async () => {
    await render(withI18n(<TabletShell />));
    expect(screen.getByText('Arka')).toBeOnTheScreen();
    expect(screen.getByText('1.234,50 €')).toBeOnTheScreen();
  });

  it('boots the app', async () => {
    await render(<App />);
    expect(screen.getByText('Totali')).toBeOnTheScreen();
  });
});
