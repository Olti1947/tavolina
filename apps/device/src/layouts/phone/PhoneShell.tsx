import { formatEur } from '@tavolina/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

/** Waiter handheld layout (6" phone, one-handed). Placeholder until M3. */
export function PhoneShell() {
  const { t } = useTranslation();
  return (
    <View style={styles.root} testID="phone-shell">
      <Text style={styles.title}>{t('layout.handheld')}</Text>
      <Text style={styles.label}>{t('total')}</Text>
      <Text style={styles.amount}>{formatEur(350)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', padding: 16, backgroundColor: '#ffffff' },
  title: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 'auto', marginTop: 48 },
  label: { fontSize: 16, color: '#4b5563' },
  amount: { fontSize: 40, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
});
