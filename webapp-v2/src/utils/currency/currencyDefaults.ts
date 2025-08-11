import { DEFAULT_CURRENCY, isValidCurrency } from './currencyList';

const STORAGE_KEY_PREFIX = 'lastUsedCurrency';

export const getLastUsedCurrencyByUser = (userId: string, groupId: string): string | null => {
  const key = `${STORAGE_KEY_PREFIX}_${userId}_${groupId}`;
  const stored = localStorage.getItem(key);
  return stored && isValidCurrency(stored) ? stored : null;
};

export const setLastUsedCurrencyByUser = (
  userId: string,
  groupId: string,
  currencyCode: string
): void => {
  if (isValidCurrency(currencyCode)) {
    const key = `${STORAGE_KEY_PREFIX}_${userId}_${groupId}`;
    localStorage.setItem(key, currencyCode.toUpperCase());
  }
};

export const getCurrencyFromLocale = (locale?: string): string => {
  const userLocale = locale || navigator.language;
  
  const localeMap: Record<string, string> = {
    'en-US': 'USD',
    'en-GB': 'GBP',
    'en-CA': 'CAD',
    'en-AU': 'AUD',
    'en-NZ': 'NZD',
    'en-IN': 'INR',
    'en-ZA': 'ZAR',
    'fr-FR': 'EUR',
    'fr-CA': 'CAD',
    'fr-CH': 'CHF',
    'de-DE': 'EUR',
    'de-CH': 'CHF',
    'de-AT': 'EUR',
    'es-ES': 'EUR',
    'es-MX': 'MXN',
    'es-AR': 'ARS',
    'es-CO': 'COP',
    'es-CL': 'CLP',
    'pt-BR': 'BRL',
    'pt-PT': 'EUR',
    'it-IT': 'EUR',
    'nl-NL': 'EUR',
    'ja-JP': 'JPY',
    'ko-KR': 'KRW',
    'zh-CN': 'CNY',
    'zh-TW': 'TWD',
    'zh-HK': 'HKD',
    'ru-RU': 'RUB',
    'ar-SA': 'SAR',
    'ar-AE': 'AED',
    'ar-EG': 'EGP',
    'tr-TR': 'TRY',
    'pl-PL': 'PLN',
    'sv-SE': 'SEK',
    'no-NO': 'NOK',
    'da-DK': 'DKK',
    'fi-FI': 'EUR',
    'he-IL': 'ILS',
    'th-TH': 'THB',
    'id-ID': 'IDR',
    'ms-MY': 'MYR',
    'vi-VN': 'VND',
  };
  
  let currency = localeMap[userLocale];
  if (currency) return currency;
  
  const language = userLocale.split('-')[0];
  for (const [locale, curr] of Object.entries(localeMap)) {
    if (locale.startsWith(language + '-')) {
      return curr;
    }
  }
  
  return DEFAULT_CURRENCY;
};

export interface CurrencyDefaultOptions {
  userId: string;
  groupId: string;
  lastUsedInGroup?: string;
  locale?: string;
}

export const getSmartDefaultCurrency = (options: CurrencyDefaultOptions): string => {
  const { userId, groupId, lastUsedInGroup, locale } = options;
  
  const lastUsedByUser = getLastUsedCurrencyByUser(userId, groupId);
  if (lastUsedByUser) {
    return lastUsedByUser;
  }
  
  if (lastUsedInGroup && isValidCurrency(lastUsedInGroup)) {
    return lastUsedInGroup;
  }
  
  return getCurrencyFromLocale(locale);
};