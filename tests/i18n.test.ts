import { describe, expect, it } from 'vitest';
import en, { type MessageKey } from '../src/i18n/en';
import vi from '../src/i18n/vi';
import zh from '../src/i18n/zh';
import ja from '../src/i18n/ja';
import ko from '../src/i18n/ko';
import ru from '../src/i18n/ru';
import { DEFAULT_LOCALE, LOCALES, OCR_LANGS_BY_LOCALE, formatPages, isLocale, t } from '../src/i18n';

const DICTIONARIES = { en, vi, zh, ja, ko, ru };
const KEYS = Object.keys(en) as MessageKey[];

function placeholders(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe('interface languages', () => {
  it('defaults to English and offers every supported language', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(LOCALES.map((locale) => locale.id)).toEqual(['en', 'vi', 'zh', 'ja', 'ko', 'ru']);
    expect(LOCALES.every((locale) => isLocale(locale.id))).toBe(true);
    expect(OCR_LANGS_BY_LOCALE).toHaveProperty('ja');
  });

  it.each(Object.entries(DICTIONARIES))('%s translates every message', (locale, dictionary) => {
    const translated = dictionary as Record<MessageKey, string>;
    expect(Object.keys(translated).sort()).toEqual([...KEYS].sort());
    for (const key of KEYS) {
      expect(translated[key].trim(), `${locale}:${key}`).not.toBe('');
    }
  });

  it.each(Object.entries(DICTIONARIES))('%s keeps the same placeholders', (locale, dictionary) => {
    const translated = dictionary as Record<MessageKey, string>;
    for (const key of KEYS) {
      expect(placeholders(translated[key]), `${locale}:${key}`).toEqual(placeholders(en[key]));
    }
  });

  it('fills placeholders and falls back to English for unknown locales', () => {
    expect(t('en', 'summary.files', { count: 3 })).toBe('Files: 3');
    expect(t('vi', 'summary.files', { count: 3 })).toBe('File: 3');
    expect(t('ja', 'progress.reading', { page: 2, pages: 5 })).toBe('2/5 ページを読み込み中');
    expect(t('de' as never, 'status.done')).toBe('Done');
    expect(t('en', 'summary.files')).toBe('Files: {count}');
  });

  it('pluralises page counts per language', () => {
    expect(formatPages('en', 1)).toBe('1 page');
    expect(formatPages('en', 4)).toBe('4 pages');
    expect(formatPages('vi', 4)).toBe('4 trang');
    expect(formatPages('ru', 4)).toBe('4 стр.');
  });
});
