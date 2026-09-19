import { InitOptions, use as i18n_use } from 'i18next';
import { useMemo } from 'react';
import { initReactI18next, useTranslation } from 'react-i18next';
import DE from '@/strings/localizedStrings/de.json';
import EN from '@/strings/localizedStrings/en.json';
import ES from '@/strings/localizedStrings/es.json';
import FR_CA from '@/strings/localizedStrings/fr_CA.json';
import HI_IN from '@/strings/localizedStrings/hi_IN.json';
import RU from '@/strings/localizedStrings/ru.json';
import UK from '@/strings/localizedStrings/uk.json';
import { TimeUnit } from '@/utils/date';
import { createMemoOnArgsCache, memoOnArgs } from '@/utils/function';

type LocaleStringJson = { [key: string]: string };

const DEFAULT_LOCALE = 'en';

export const globali18nFunctions = {
  'Intl.Number': '{{val, number}}',
  'Intl.DateTime': '{{val, datetime}}',
  'Intl.RelativeTime': '{{val, relativetime}}',
  'Intl.List': '{{val, list}}',
  'Intl.Currency': '{{val, currency}}',
} satisfies LocaleStringJson;

type I18NextBuiltIn = keyof typeof globali18nFunctions;

export const computedLocale = (localeStrings: LocaleStringJson): LocaleStringJson => {
  return {
    ...localeStrings,
    ...globali18nFunctions,
  };
};

const localeStringMap = {
  en: computedLocale(EN),
  'fr-CA': computedLocale(FR_CA),
  es: computedLocale(ES),
  de: computedLocale(DE),
  'hi-IN': computedLocale(HI_IN),
  ru: computedLocale(RU),
  uk: computedLocale(UK),
};

type TrimAfterUnderscore<T extends string> = T extends `${infer P}_${string}` ? P : T;
export type TranslationKey = TrimAfterUnderscore<keyof typeof EN>;
export const isTranslationKey = (str: string) => EN.hasOwnProperty(str);

// Fallback on language, if the accepted language are German followed by English followed by French, should return English.
export function getBrowserLocale(): string {
  let language: string;
  if (navigator.languages) {
    // Add separate check to ensure specific dialect doesn't get selected unless specified first.
    for (let i = 0; i < navigator.languages.length; i++) {
      language = navigator.languages[i];
      if (localeStringMap.hasOwnProperty(language)) {
        return language;
      }

      const fallbackLanguage = language.toLowerCase().split(/[-]+/)[0];
      if (localeStringMap.hasOwnProperty(fallbackLanguage)) {
        return fallbackLanguage;
      }
    }
  }

  language = navigator.language;

  if (!language) {
    return DEFAULT_LOCALE;
  }

  if (localeStringMap.hasOwnProperty(language)) return language;

  language = language.toLowerCase().split(/[_-]+/)[0];
  return localeStringMap.hasOwnProperty(language) ? language : DEFAULT_LOCALE;
}

/** Store in object to share with test-utils */
export const SHARED_INIT_OPTIONS: InitOptions = {
  fallbackLng: 'en',
  returnEmptyString: false,
  interpolation: {
    escapeValue: false, // react already handles xss
  },
};

export function i18nInit(): Promise<AppTranslation> {
  const currentLocale = getBrowserLocale();
  const i18n = i18n_use(initReactI18next) // passes i18n down to react-i18next
    .init({
      resources: {
        en: {
          translation: localeStringMap['en'],
        },
        'fr-CA': {
          translation: localeStringMap['fr-CA'],
        },
        es: {
          translation: localeStringMap['es'],
        },
        de: {
          translation: localeStringMap['de'],
        },
        'hi-IN': {
          translation: localeStringMap['hi-IN'],
        },
        ru: {
          translation: localeStringMap['ru'],
        },
        uk: {
          translation: localeStringMap['uk'],
        },
      },
      lng: currentLocale, // if you're using a language detector, do not define the lng option
      ...SHARED_INIT_OPTIONS,
    });
  if (__DEV__) {
    i18n.then((t) => Object.assign(globalThis, { _t: t }));
  }
  return i18n as Promise<AppTranslation>;
}

// global cache for all translations
const tCache = createMemoOnArgsCache();

export function useAppTranslation() {
  // eslint-disable-next-line no-restricted-syntax
  const { i18n, t } = useTranslation();
  const memoizedT = useMemo(() => memoOnArgs(t, { cache: tCache!, maxSize: 1000 }), [t]);
  return {
    i18n,
    t: memoizedT as AppTranslation,
  };
}

export type AppTranslationKey = TranslationKey | I18NextBuiltIn;

export type AppTranslation = (
  key: AppTranslationKey,
  options?: TranslateOptions & Record<string, any>
) => string;

export type TranslateOptions = {
  formatParams?: Record<
    string,
    | Intl.NumberFormatOptions
    | (Intl.DateTimeFormatOptions & { range?: TimeUnit })
    | (Intl.RelativeTimeFormat & { range?: TimeUnit })
  >;
};
