import { StatusBar } from 'expo-status-bar';
import { useWindowDimensions } from 'react-native';
import { I18nextProvider } from 'react-i18next';
import { i18n } from './i18n';
import { PhoneShell } from './layouts/phone/PhoneShell';
import { TabletShell } from './layouts/tablet/TabletShell';

/** Shortest side, in dp, from which the counter (tablet) layout is used. */
export const TABLET_MIN_SHORTEST_SIDE = 600;

/**
 * Placeholder: from M1/M2 the layout follows the paired device's kind (COUNTER or HANDHELD,
 * CLAUDE.md section 5.1), not the screen size.
 */
export function isTabletLayout(width: number, height: number): boolean {
  return Math.min(width, height) >= TABLET_MIN_SHORTEST_SIDE;
}

export function App() {
  const { width, height } = useWindowDimensions();
  return (
    <I18nextProvider i18n={i18n}>
      {isTabletLayout(width, height) ? <TabletShell /> : <PhoneShell />}
      <StatusBar style="auto" />
    </I18nextProvider>
  );
}
