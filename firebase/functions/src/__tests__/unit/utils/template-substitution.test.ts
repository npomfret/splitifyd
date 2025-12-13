import { describe, expect, it } from 'vitest';
import { brandingLegalToTokens, substitutePolicyTokens } from '../../../utils/template-substitution';

describe('template-substitution', () => {
    const validTokens = {
        appName: 'TestApp',
        companyName: 'TestCo',
        supportEmail: 'test@example.com',
    };

    describe('substitutePolicyTokens', () => {
        it('replaces all placeholder types', () => {
            const text = 'Welcome to {{appName}}. Contact {{supportEmail}} at {{companyName}}.';

            const result = substitutePolicyTokens(text, validTokens);

            expect(result).toBe('Welcome to TestApp. Contact test@example.com at TestCo.');
        });

        it('replaces multiple occurrences of same placeholder', () => {
            const text = '{{appName}} is great. Use {{appName}} today!';
            const tokens = { ...validTokens, appName: 'MyApp' };

            const result = substitutePolicyTokens(text, tokens);

            expect(result).toBe('MyApp is great. Use MyApp today!');
        });

        it('leaves text unchanged when no placeholders present', () => {
            const text = 'No placeholders here.';

            const result = substitutePolicyTokens(text, validTokens);

            expect(result).toBe('No placeholders here.');
        });

        it('handles empty text', () => {
            const result = substitutePolicyTokens('', validTokens);
            expect(result).toBe('');
        });
    });

    describe('brandingLegalToTokens', () => {
        it('extracts values from BrandingLegal', () => {
            const legal = {
                appName: 'Side Badger',
                companyName: 'Side Badger Inc',
                supportEmail: 'help@sidebadger.com',
            };

            const result = brandingLegalToTokens(legal);

            expect(result).toEqual({
                appName: 'Side Badger',
                companyName: 'Side Badger Inc',
                supportEmail: 'help@sidebadger.com',
            });
        });

        it('throws when appName is missing', () => {
            const legal = {
                appName: '',
                companyName: 'TestCo',
                supportEmail: 'test@example.com',
            };

            expect(() => brandingLegalToTokens(legal)).toThrow('BrandingLegal must have appName, companyName, and supportEmail');
        });

        it('throws when companyName is missing', () => {
            const legal = {
                appName: 'TestApp',
                companyName: '',
                supportEmail: 'test@example.com',
            };

            expect(() => brandingLegalToTokens(legal)).toThrow('BrandingLegal must have appName, companyName, and supportEmail');
        });

        it('throws when supportEmail is missing', () => {
            const legal = {
                appName: 'TestApp',
                companyName: 'TestCo',
                supportEmail: '',
            };

            expect(() => brandingLegalToTokens(legal)).toThrow('BrandingLegal must have appName, companyName, and supportEmail');
        });
    });
});
