import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import path from 'path';
import { Request } from 'express';

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
        await i18next
            .use(Backend)
            .init({
                // Default language
                lng: 'en',
                fallbackLng: 'en',
                
                // Language detection will be handled by middleware
                detection: {
                    order: ['header', 'query'],
                    caches: false
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
        console.log('Backend i18n initialized successfully');
    } catch (error) {
        console.error('Failed to initialize backend i18n:', error);
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
        .map(lang => {
            const [code, q] = lang.trim().split(';q=');
            return {
                code: code.split('-')[0].toLowerCase(), // Extract primary language code
                quality: q ? parseFloat(q) : 1.0
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

/**
 * Get user's preferred language from their profile
 */
async function getUserPreferredLanguage(userId?: string): Promise<string | null> {
    if (!userId) return null;
    
    try {
        const { firestoreDb } = await import('../firebase');
        const userDoc = await firestoreDb.collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            return userData?.preferredLanguage || null;
        }
    } catch (error) {
        console.error('Error fetching user preferred language:', error);
    }
    
    return null;
}

/**
 * Middleware to add translation capabilities to requests
 */
export function i18nMiddleware() {
    return async (req: LocalizedRequest, res: any, next: any) => {
        try {
            // Ensure i18n is initialized
            await initializeI18n();

            // Detect language from various sources (in order of preference):
            // 1. User profile preference (if authenticated)
            // 2. Accept-Language header
            // 3. Default to English
            
            let selectedLanguage = 'en';
            
            // Try to get user's preferred language if authenticated
            const userId = (req as any).user?.uid;
            if (userId) {
                const userLanguage = await getUserPreferredLanguage(userId);
                if (userLanguage) {
                    selectedLanguage = userLanguage;
                } else {
                    // Fall back to Accept-Language header
                    selectedLanguage = detectLanguageFromHeader(req.get('Accept-Language'));
                }
            } else {
                // For non-authenticated requests, use Accept-Language header
                selectedLanguage = detectLanguageFromHeader(req.get('Accept-Language'));
            }
            
            req.language = selectedLanguage;

            // Add translation function to request
            req.t = getTranslationFunction(req.language);

            next();
        } catch (error) {
            console.error('i18n middleware error:', error);
            // Continue with English as fallback
            req.language = 'en';
            req.t = getTranslationFunction('en');
            next();
        }
    };
}

/**
 * Translate a key with optional interpolation values
 */
export function translate(
    key: string, 
    language: string = 'en', 
    interpolation?: Record<string, any>
): string {
    const t = getTranslationFunction(language);
    return t(key, interpolation);
}