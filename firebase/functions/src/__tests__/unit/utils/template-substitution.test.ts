import { describe, expect, it } from 'vitest';
import {
    brandingLegalToTokens,
    DEFAULT_POLICY_TOKENS,
    substitutePolicyTokens,
} from '../../../utils/template-substitution';

describe('template-substitution', () => {
    describe('substitutePolicyTokens', () => {
        it('replaces all placeholder types', () => {
            const text = 'Welcome to {{appName}}. Contact {{supportEmail}} at {{companyName}}.';
            const tokens = {
                appName: 'TestApp',
                companyName: 'TestCo',
                supportEmail: 'test@example.com',
            };

            const result = substitutePolicyTokens(text, tokens);

            expect(result).toBe('Welcome to TestApp. Contact test@example.com at TestCo.');
        });

        it('replaces multiple occurrences of same placeholder', () => {
            const text = '{{appName}} is great. Use {{appName}} today!';
            const tokens = { ...DEFAULT_POLICY_TOKENS, appName: 'MyApp' };

            const result = substitutePolicyTokens(text, tokens);

            expect(result).toBe('MyApp is great. Use MyApp today!');
        });

        it('leaves text unchanged when no placeholders present', () => {
            const text = 'No placeholders here.';

            const result = substitutePolicyTokens(text, DEFAULT_POLICY_TOKENS);

            expect(result).toBe('No placeholders here.');
        });

        it('handles empty text', () => {
            const result = substitutePolicyTokens('', DEFAULT_POLICY_TOKENS);
            expect(result).toBe('');
        });
    });

    describe('brandingLegalToTokens', () => {
        it('returns defaults when legal is undefined', () => {
            const result = brandingLegalToTokens(undefined);

            expect(result).toEqual(DEFAULT_POLICY_TOKENS);
        });

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

        it('uses defaults for missing fields', () => {
            const legal = {
                appName: '',
                companyName: 'TestCo',
                supportEmail: '',
            };

            const result = brandingLegalToTokens(legal);

            expect(result).toEqual({
                appName: DEFAULT_POLICY_TOKENS.appName,
                companyName: 'TestCo',
                supportEmail: DEFAULT_POLICY_TOKENS.supportEmail,
            });
        });
    });

    describe('DEFAULT_POLICY_TOKENS', () => {
        it('has sensible defaults', () => {
            expect(DEFAULT_POLICY_TOKENS.appName).toBe('BillSplit');
            expect(DEFAULT_POLICY_TOKENS.companyName).toBe('BillSplit');
            expect(DEFAULT_POLICY_TOKENS.supportEmail).toBe('support@billsplit.app');
        });
    });
});
