import en, { type MessageKey } from './en';
import vi from './vi';
import zh from './zh';
import ja from './ja';
import ko from './ko';
import ru from './ru';

export type { MessageKey };

export type Locale = 'en' | 'vi' | 'zh' | 'ja' | 'ko' | 'ru';

/** Shown in the language picker; each label is written in its own language. */
export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'zh', label: '中文' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'ru', label: 'Русский' },
];

export const DEFAULT_LOCALE: Locale = 'en';

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { en, vi, zh, ja, ko, ru };

/** Tesseract language string that goes with each interface language. */
export const OCR_LANGS_BY_LOCALE: Record<Locale, string> = {
  en: 'eng',
  vi: 'vie+eng',
  zh: 'chi_sim+eng',
  ja: 'jpn+eng',
  ko: 'kor+eng',
  ru: 'rus+eng',
};

const PAGE_FORMS: Record<Locale, { one: string; other: string }> = {
  en: { one: '{count} page', other: '{count} pages' },
  vi: { one: '{count} trang', other: '{count} trang' },
  zh: { one: '{count} 页', other: '{count} 页' },
  ja: { one: '{count} ページ', other: '{count} ページ' },
  ko: { one: '{count}페이지', other: '{count}페이지' },
  ru: { one: '{count} стр.', other: '{count} стр.' },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && value in DICTIONARIES;
}

/** Looks up a message and fills in `{name}` placeholders. */
export function t(
  locale: Locale,
  key: MessageKey,
  values?: Record<string, string | number>,
): string {
  const dictionary = DICTIONARIES[locale] ?? en;
  const template = dictionary[key] ?? en[key];
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  );
}

/** "1 page" / "3 pages", with the plural rules each language actually needs. */
export function formatPages(locale: Locale, count: number): string {
  const forms = PAGE_FORMS[locale] ?? PAGE_FORMS.en;
  return (count === 1 ? forms.one : forms.other).replace('{count}', String(count));
}
