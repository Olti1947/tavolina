/**
 * Translation resources for every TS app. Albanian (`sq`) is the default; English (`en`) is the
 * second language, and the shape leaves room for Serbian (`sr-Latn`) later.
 */
export const defaultLanguage = 'sq';
export const supportedLanguages = ['sq', 'en'] as const;
export type Language = (typeof supportedLanguages)[number];

export const resources = {
  sq: {
    common: {
      appName: 'Tavolina',
      updatedAt: 'Përditësuar {{time}}',
      offline: 'Pa internet',
      syncing: 'Duke sinkronizuar…',
      synced: 'Sinkronizuar',
      total: 'Totali',
      printer: {
        paperOut: 'Printeri {{name}} s’ka letër – vendos letër ose zgjidh printer tjetër',
      },
      layout: {
        counter: 'Arka',
        handheld: 'Kamarieri',
      },
    },
  },
  en: {
    common: {
      appName: 'Tavolina',
      updatedAt: 'Updated {{time}}',
      offline: 'No internet',
      syncing: 'Syncing…',
      synced: 'Synced',
      total: 'Total',
      printer: {
        paperOut: 'Printer {{name}} is out of paper – load paper or choose another printer',
      },
      layout: {
        counter: 'Counter',
        handheld: 'Waiter',
      },
    },
  },
} as const;
