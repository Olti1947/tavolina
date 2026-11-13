import { formatEur } from '@tavolina/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

/** Counter POS layout (10" landscape). Placeholder until M2. */
export function TabletShell() {
  const { t } = useTranslation();
  return (
    <View style={styles.root} testID="tablet-shell">
      <View style={styles.main}>
        <Text style={styles.title}>{t('layout.counter')}</Text>
      </View>
      <View style={styles.side}>
        <Text style={styles.label}>{t('total')}</Text>
        <Text style={styles.amount}>{formatEur(123450)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: '#ffffff' },
  main: { flex: 2, padding: 24 },
  side: { flex: 1, padding: 24, justifyContent: 'flex-end', backgroundColor: '#f3f4f6' },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  label: { fontSize: 18, color: '#4b5563' },
  amount: { fontSize: 44, fontWeight: '700', color: '#111827', fontVariant: ['tabular-nums'] },
});
