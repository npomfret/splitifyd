/**
 * Language detection and persistence utility.
 *
 * Detection priority:
 * 1. User's preferredLanguage from profile (if authenticated)
 * 2. localStorage (returning visitor who chose a language)
 * 3. navigator.language / navigator.languages (browser preference)
 * 4. 'en' fallback
 */

const LANGUAGE_STORAGE_KEY = 'language';

export const SUPPORTED_LANGUAGES = ['en', 'uk'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
    en: 'English',
    uk: 'Українська',
};

/**
 * Maps language codes to full locale codes for Intl APIs.
 * e.g., 'en' -> 'en-US', 'uk' -> 'uk-UA'
 */
const LOCALE_MAP: Record<SupportedLanguage, string> = {
    en: 'en-US',
    uk: 'uk-UA',
};

/**
 * Gets the full Intl locale code for a language.
 * Falls back to the language code itself if not in the map.
 */
export const getIntlLocale = (language: string): string => {
    if (isSupportedLanguage(language)) {
        return LOCALE_MAP[language];
    }
    return language;
};

const isSupportedLanguage = (lang: string): lang is SupportedLanguage => {
    return SUPPORTED_LANGUAGES.includes(lang as SupportedLanguage);
};

/**
 * Detects the user's preferred language from available signals.
 * Does NOT check user profile - that should be handled separately after auth.
 */
export const detectBrowserLanguage = (): SupportedLanguage => {
    // 1. Check localStorage (returning visitor who chose a language)
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored && isSupportedLanguage(stored)) {
            return stored;
        }
    }

    // 2. Check browser preference (primary language)
    if (typeof navigator !== 'undefined' && navigator.language) {
        const browserLang = navigator.language.split('-')[0];
        if (isSupportedLanguage(browserLang)) {
            return browserLang;
        }
    }

    // 3. Check navigator.languages array for fallback matches
    if (typeof navigator !== 'undefined' && navigator.languages) {
        for (const lang of navigator.languages) {
            const code = lang.split('-')[0];
            if (isSupportedLanguage(code)) {
                return code;
            }
        }
    }

    // 4. Default to English
    return 'en';
};

/**
 * Persists the user's language choice to localStorage.
 * For authenticated users, also update their profile separately.
 */
export const persistLanguageChoice = (language: SupportedLanguage): void => {
    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }
};

/**
 * Gets the persisted language choice from localStorage.
 * Returns null if no language has been explicitly chosen.
 */
export const getPersistedLanguage = (): SupportedLanguage | null => {
    if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored && isSupportedLanguage(stored)) {
            return stored;
        }
    }
    return null;
};

/**
 * Clears the persisted language choice from localStorage.
 */
export const clearPersistedLanguage = (): void => {
    if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    }
};
