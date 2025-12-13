import { clearPersistedLanguage, detectBrowserLanguage, getIntlLocale, getPersistedLanguage, LANGUAGE_NAMES, persistLanguageChoice, SUPPORTED_LANGUAGES } from '@/utils/languageDetection';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('languageDetection', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    describe('detectBrowserLanguage', () => {
        it('returns language from localStorage if valid', () => {
            localStorage.setItem('language', 'uk');

            const result = detectBrowserLanguage();

            expect(result).toBe('uk');
        });

        it('ignores invalid language in localStorage', () => {
            localStorage.setItem('language', 'fr');
            vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');

            const result = detectBrowserLanguage();

            expect(result).toBe('en');
        });

        it('returns language from URL param ?lang=uk when localStorage is empty', () => {
            const originalLocation = window.location;
            Object.defineProperty(window, 'location', {
                value: { search: '?lang=uk' },
                writable: true,
            });

            const result = detectBrowserLanguage();

            expect(result).toBe('uk');
            // Should persist to localStorage
            expect(localStorage.getItem('language')).toBe('uk');

            Object.defineProperty(window, 'location', {
                value: originalLocation,
                writable: true,
            });
        });

        it('ignores invalid URL param ?lang=fr', () => {
            const originalLocation = window.location;
            Object.defineProperty(window, 'location', {
                value: { search: '?lang=fr' },
                writable: true,
            });
            vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');

            const result = detectBrowserLanguage();

            expect(result).toBe('en');
            expect(localStorage.getItem('language')).toBeNull();

            Object.defineProperty(window, 'location', {
                value: originalLocation,
                writable: true,
            });
        });

        it('localStorage takes priority over URL param', () => {
            localStorage.setItem('language', 'en');
            const originalLocation = window.location;
            Object.defineProperty(window, 'location', {
                value: { search: '?lang=uk' },
                writable: true,
            });

            const result = detectBrowserLanguage();

            expect(result).toBe('en');

            Object.defineProperty(window, 'location', {
                value: originalLocation,
                writable: true,
            });
        });

        it('returns language from navigator.language when no localStorage or URL param', () => {
            vi.spyOn(navigator, 'language', 'get').mockReturnValue('uk-UA');

            const result = detectBrowserLanguage();

            expect(result).toBe('uk');
        });

        it('returns language from navigator.languages array as fallback', () => {
            vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');
            vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR', 'uk-UA', 'en-US']);

            const result = detectBrowserLanguage();

            expect(result).toBe('uk');
        });

        it('returns en as final fallback', () => {
            vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');
            vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR', 'zh-CN']);

            const result = detectBrowserLanguage();

            expect(result).toBe('en');
        });
    });

    describe('persistLanguageChoice', () => {
        it('saves language to localStorage', () => {
            persistLanguageChoice('uk');

            expect(localStorage.getItem('language')).toBe('uk');
        });
    });

    describe('getPersistedLanguage', () => {
        it('returns stored language if valid', () => {
            localStorage.setItem('language', 'uk');

            expect(getPersistedLanguage()).toBe('uk');
        });

        it('returns null if no language stored', () => {
            expect(getPersistedLanguage()).toBeNull();
        });

        it('returns null if stored language is invalid', () => {
            localStorage.setItem('language', 'fr');

            expect(getPersistedLanguage()).toBeNull();
        });
    });

    describe('clearPersistedLanguage', () => {
        it('removes language from localStorage', () => {
            localStorage.setItem('language', 'uk');

            clearPersistedLanguage();

            expect(localStorage.getItem('language')).toBeNull();
        });
    });

    describe('getIntlLocale', () => {
        it('maps en to en-US', () => {
            expect(getIntlLocale('en')).toBe('en-US');
        });

        it('maps uk to uk-UA', () => {
            expect(getIntlLocale('uk')).toBe('uk-UA');
        });

        it('maps ar to ar-SA', () => {
            expect(getIntlLocale('ar')).toBe('ar-SA');
        });

        it('maps de to de-DE', () => {
            expect(getIntlLocale('de')).toBe('de-DE');
        });

        it('maps es to es-ES', () => {
            expect(getIntlLocale('es')).toBe('es-ES');
        });

        it('maps it to it-IT', () => {
            expect(getIntlLocale('it')).toBe('it-IT');
        });

        it('maps ja to ja-JP', () => {
            expect(getIntlLocale('ja')).toBe('ja-JP');
        });

        it('maps ko to ko-KR', () => {
            expect(getIntlLocale('ko')).toBe('ko-KR');
        });

        it('maps lv to lv-LV', () => {
            expect(getIntlLocale('lv')).toBe('lv-LV');
        });

        it('maps nl-BE to nl-BE', () => {
            expect(getIntlLocale('nl-BE')).toBe('nl-BE');
        });

        it('maps no to nb-NO', () => {
            expect(getIntlLocale('no')).toBe('nb-NO');
        });

        it('maps ph to fil-PH', () => {
            expect(getIntlLocale('ph')).toBe('fil-PH');
        });

        it('maps sv to sv-SE', () => {
            expect(getIntlLocale('sv')).toBe('sv-SE');
        });

        it('returns unknown language code as-is', () => {
            expect(getIntlLocale('fr')).toBe('fr');
        });
    });

    describe('constants', () => {
        it('SUPPORTED_LANGUAGES contains all expected languages', () => {
            expect(SUPPORTED_LANGUAGES).toContain('en');
            expect(SUPPORTED_LANGUAGES).toContain('uk');
            expect(SUPPORTED_LANGUAGES).toContain('ar');
            expect(SUPPORTED_LANGUAGES).toContain('de');
            expect(SUPPORTED_LANGUAGES).toContain('es');
            expect(SUPPORTED_LANGUAGES).toContain('it');
            expect(SUPPORTED_LANGUAGES).toContain('ja');
            expect(SUPPORTED_LANGUAGES).toContain('ko');
            expect(SUPPORTED_LANGUAGES).toContain('lv');
            expect(SUPPORTED_LANGUAGES).toContain('nl-BE');
            expect(SUPPORTED_LANGUAGES).toContain('no');
            expect(SUPPORTED_LANGUAGES).toContain('ph');
            expect(SUPPORTED_LANGUAGES).toContain('sv');
            expect(SUPPORTED_LANGUAGES).toHaveLength(13);
        });

        it('LANGUAGE_NAMES has entries for all supported languages', () => {
            expect(LANGUAGE_NAMES.en).toBe('English');
            expect(LANGUAGE_NAMES.uk).toBe('Українська');
            expect(LANGUAGE_NAMES.ar).toBe('العربية');
            expect(LANGUAGE_NAMES.de).toBe('Deutsch');
            expect(LANGUAGE_NAMES.es).toBe('Español');
            expect(LANGUAGE_NAMES.it).toBe('Italiano');
            expect(LANGUAGE_NAMES.ja).toBe('日本語');
            expect(LANGUAGE_NAMES.ko).toBe('한국어');
            expect(LANGUAGE_NAMES.lv).toBe('Latviešu');
            expect(LANGUAGE_NAMES['nl-BE']).toBe('Nederlands (België)');
            expect(LANGUAGE_NAMES.no).toBe('Norsk');
            expect(LANGUAGE_NAMES.ph).toBe('Filipino');
            expect(LANGUAGE_NAMES.sv).toBe('Svenska');
        });
    });
});
