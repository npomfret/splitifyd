/**
 * Language detection and persistence utility.
 *
 * Detection priority:
 * 1. User's preferredLanguage from profile (if authenticated) - handled by auth-store
 * 2. localStorage (returning visitor who chose a language)
 * 3. URL parameter ?lang=uk (tenant pass-through - persisted to localStorage on first read)
 * 4. navigator.language / navigator.languages (browser preference)
 * 5. 'en' fallback
 */

const LANGUAGE_STORAGE_KEY = 'language';

export const SUPPORTED_LANGUAGES = ['en', 'uk', 'ar', 'de', 'es', 'it', 'ja', 'ko', 'lv', 'ph', 'sv'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
    en: 'English',
    uk: 'Українська',
    ar: 'العربية',
    de: 'Deutsch',
    es: 'Español',
    it: 'Italiano',
    ja: '日本語',
    ko: '한국어',
    lv: 'Latviešu',
    ph: 'Filipino',
    sv: 'Svenska',
};

/**
 * Maps language codes to full locale codes for Intl APIs.
 * e.g., 'en' -> 'en-US', 'uk' -> 'uk-UA', 'ar' -> 'ar-SA'
 */
const LOCALE_MAP: Record<SupportedLanguage, string> = {
    en: 'en-US',
    uk: 'uk-UA',
    ar: 'ar-SA',
    de: 'de-DE',
    es: 'es-ES',
    it: 'it-IT',
    ja: 'ja-JP',
    ko: 'ko-KR',
    lv: 'lv-LV',
    ph: 'fil-PH',
    sv: 'sv-SE',
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

    // 2. Check URL parameter (tenant pass-through via ?lang=uk)
    if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const langParam = urlParams.get('lang');
        if (langParam && isSupportedLanguage(langParam)) {
            // Persist to localStorage so it survives navigation
            persistLanguageChoice(langParam);
            return langParam;
        }
    }

    // 3. Check browser preference (primary language)
    if (typeof navigator !== 'undefined' && navigator.language) {
        const browserLang = navigator.language.split('-')[0];
        if (isSupportedLanguage(browserLang)) {
            return browserLang;
        }
    }

    // 4. Check navigator.languages array for fallback matches
    if (typeof navigator !== 'undefined' && navigator.languages) {
        for (const lang of navigator.languages) {
            const code = lang.split('-')[0];
            if (isSupportedLanguage(code)) {
                return code;
            }
        }
    }

    // 5. Default to English
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
