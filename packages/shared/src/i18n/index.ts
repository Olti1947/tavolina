import i18next, { type i18n, type Module } from 'i18next';
import { defaultLanguage, resources, type Language } from './resources';

export * from './resources';

/**
 * Creates an i18next instance with our resources. Apps pass their React binding
 * (`initReactI18next`) as a plugin; init is synchronous because resources are bundled.
 */
export function createI18n(lng: Language = defaultLanguage, plugins: Module[] = []): i18n {
  const instance = i18next.createInstance();
  for (const plugin of plugins) instance.use(plugin);
  void instance.init({
    lng,
    fallbackLng: defaultLanguage,
    defaultNS: 'common',
    ns: ['common'],
    resources,
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}
