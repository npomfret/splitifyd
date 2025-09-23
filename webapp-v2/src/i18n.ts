import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json' with { type: 'json' };

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

        // Always log missing translations to console in ALL environments
        // Missing translations are bugs and should be caught everywhere
        debug: true,
        missingKeyHandler: (lng, ns, key, fallbackValue) => {
            // ALWAYS log missing translations as errors - this is quality control
            console.error(`🌍 Missing translation: "${key}" in namespace "${ns}" for language "${lng}"`);
            console.error(`   Fallback value: "${fallbackValue}"`);
            console.error(`   Add to translation file: webapp-v2/src/locales/${lng}/translation.json`);
        },
    });

export default i18n;
