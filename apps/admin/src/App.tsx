import { formatEur, formatTime } from '@tavolina/shared';
import { useTranslation } from 'react-i18next';

interface AppProps {
  /** Injected in tests so the "updated at" label is deterministic. */
  now?: Date;
}

/** Placeholder shell for the owner app; the live view and setup screens arrive in M1 and M4. */
export function App({ now = new Date() }: AppProps) {
  const { t } = useTranslation();
  return (
    <main className="shell">
      <header>
        <h1>{t('appName')}</h1>
        <p className="muted">{t('updatedAt', { time: formatTime(now) })}</p>
      </header>
      <section className="card">
        <span>{t('total')}</span>
        <strong className="amount">{formatEur(123450)}</strong>
      </section>
    </main>
  );
}
