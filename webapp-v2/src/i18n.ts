import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json' with { type: 'json' };
import { logError } from './utils/browser-logger';

// the translations
const resources = {
    en: {
        translation: en,
    },
};

i18n.use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: 'en', // language to use,
        fallbackLng: 'en',

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
                addToFile: `webapp-v2/src/locales/${lng}/translation.json`
            });
        },
    });

export default i18n;
