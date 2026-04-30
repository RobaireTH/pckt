const LOCALE_KEY = 'pckt:locale';

export type LocalePreference = 'system' | 'en-US' | 'en-GB';

export function readLocalePreference(): LocalePreference {
  try {
    const value = localStorage.getItem(LOCALE_KEY);
    if (value === 'en-US' || value === 'en-GB' || value === 'system') {
      return value;
    }
  } catch {}
  return 'system';
}

export function writeLocalePreference(locale: LocalePreference) {
  try {
    localStorage.setItem(LOCALE_KEY, locale);
    window.dispatchEvent(new CustomEvent('pckt:locale-change', { detail: locale }));
  } catch {}
}

export function resolveLocale(locale: LocalePreference) {
  if (locale === 'system') {
    return undefined;
  }
  return locale;
}

export function formatDate(value: number | string | Date, locale = readLocalePreference()) {
  const resolved = resolveLocale(locale);
  return new Date(value).toLocaleDateString(resolved);
}

export function formatDateTime(value: number | string | Date, locale = readLocalePreference()) {
  const resolved = resolveLocale(locale);
  return new Date(value).toLocaleString(resolved);
}
