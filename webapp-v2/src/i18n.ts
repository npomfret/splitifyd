import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json' with { type: 'json' };
import { logError } from './utils/browser-logger';
import { detectBrowserLanguage, persistLanguageChoice, SUPPORTED_LANGUAGES, type SupportedLanguage } from './utils/languageDetection';

// Initial resources - English is always bundled
const resources = {
    en: {
        translation: en,
    },
};

// Detect initial language from browser/localStorage
const detectedLanguage = detectBrowserLanguage();

i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: detectedLanguage,
        fallbackLng: 'en',
        supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],

        interpolation: {
            escapeValue: false, // react already safes from xss
        },

        // Disable debug to avoid console spam, use saveMissing to trigger errors
        debug: false,

        // Save missing keys and trigger error for each one
        saveMissing: true,

        // This handler gets called for every missing key
        saveMissingTo: 'all',

        missingKeyHandler: (lng, ns, key, fallbackValue) => {
            // ALWAYS log missing translations as errors - this is quality control
            logError(`🌍 Missing translation: "${key}" in namespace "${ns}" for language "${lng}"`, undefined, {
                fallbackValue,
                addToFile: `webapp-v2/src/locales/${lng}/translation.json`,
            });
        },
    });

/**
 * Dynamically loads a language bundle if not already loaded.
 */
const loadLanguageBundle = async (lng: SupportedLanguage): Promise<void> => {
    if (i18n.hasResourceBundle(lng, 'translation')) {
        return;
    }

    const resources = await import(`./locales/${lng}/translation.json`);
    i18n.addResourceBundle(lng, 'translation', resources.default);
};

/**
 * Changes the application language.
 * Loads the bundle if needed, switches i18n, and persists the choice.
 */
export const changeLanguage = async (lng: SupportedLanguage): Promise<void> => {
    await loadLanguageBundle(lng);
    await i18n.changeLanguage(lng);
    persistLanguageChoice(lng);
};

/**
 * Applies the user's preferred language from their profile.
 * Call this after authentication when user data is available.
 */
export const applyUserLanguagePreference = async (preferredLanguage?: string): Promise<void> => {
    if (preferredLanguage && SUPPORTED_LANGUAGES.includes(preferredLanguage as SupportedLanguage)) {
        await changeLanguage(preferredLanguage as SupportedLanguage);
    }
};

export default i18n;
