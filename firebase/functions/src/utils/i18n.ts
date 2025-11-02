import { Request } from 'express';
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { logger } from '../logger';

export interface LocalizedRequest extends Request {
    language?: string;
    t?: typeof i18next.t;
}

let isInitialized = false;

export async function initializeI18n(): Promise<void> {
    if (isInitialized) {
        return;
    }

    try {
        await i18next.use(Backend).init({
            // Default language
            lng: 'en',
            fallbackLng: 'en',

            // Language detection will be handled by middleware
            detection: {
                order: ['header', 'query'],
                caches: false,
            },

            backend: {
                loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
            },

            // Namespace configuration
            ns: ['translation'],
            defaultNS: 'translation',

            interpolation: {
                escapeValue: false, // Not needed for server-side
            },

            // Preload languages
            preload: ['en'],

            // Debugging disabled - too verbose for development
            debug: false,
        });

        isInitialized = true;
        logger.info('i18n-initialized');
    } catch (error) {
        logger.error('i18n-initialization-failed', error);
        throw error;
    }
}

/**
 * Get translation function for a specific language
 */
export function getTranslationFunction(language: string = 'en'): typeof i18next.t {
    return i18next.getFixedT(language, 'translation');
}

/**
 * Get user's preferred language from Accept-Language header
 */
export function detectLanguageFromHeader(acceptLanguage?: string): string {
    if (!acceptLanguage) {
        return 'en';
    }

    // Parse Accept-Language header (e.g., "en-US,en;q=0.9,es;q=0.8")
    const languages = acceptLanguage
        .split(',')
        .map((lang) => {
            const [code, q] = lang.trim().split(';q=');
            return {
                code: code.split('-')[0].toLowerCase(), // Extract primary language code
                quality: q ? parseFloat(q) : 1.0,
            };
        })
        .sort((a, b) => b.quality - a.quality); // Sort by quality (preference)

    // Find first supported language
    const supportedLanguages = ['en']; // Add more languages as they become available

    for (const lang of languages) {
        if (supportedLanguages.includes(lang.code)) {
            return lang.code;
        }
    }

    return 'en'; // Default fallback
}

