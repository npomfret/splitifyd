import { formatCurrency, formatCurrencyParts, type FormatOptions } from '@/utils/currency/currencyFormatter.ts';
import { EUR, GBP, toCurrencyISOCode, USD } from '@billsplit-wl/shared';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock i18n module for locale tests
vi.mock('@/i18n', () => ({
    default: {
        language: 'en',
    },
}));

const JPY = toCurrencyISOCode('JPY');
const BHD = toCurrencyISOCode('BHD');
const EGP = toCurrencyISOCode('EGP');
const CHF = toCurrencyISOCode('CHF');
const AED = toCurrencyISOCode('AED');

// LRM (Left-to-Right Mark) is used to prevent RTL symbols from being repositioned
const LRM = '\u200E';

describe('formatCurrency', () => {
    describe('basic formatting', () => {
        it('should format USD currency with default options', () => {
            const result = formatCurrency('25.5', USD);
            expect(result).toBe(`${LRM}$${LRM} 25.50 USD`);
        });

        it('should format EUR currency', () => {
            const result = formatCurrency('99.99', EUR);
            expect(result).toBe(`${LRM}€${LRM} 99.99 EUR`);
        });

        it('should format JPY currency with zero decimal places', () => {
            const result = formatCurrency('1000', JPY);
            expect(result).toBe(`${LRM}¥${LRM} 1,000 JPY`);
        });

        it('should format BHD currency with three decimal places', () => {
            const result = formatCurrency('10.123', BHD);
            expect(result.endsWith(' BHD')).toBe(true);
            expect(result).toContain('10.123');
        });
    });

    describe('edge cases', () => {
        it('should throw error for empty currency code', () => {
            expect(() => formatCurrency('25.5', toCurrencyISOCode(''))).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for whitespace-only currency code', () => {
            expect(() => formatCurrency('25.5', toCurrencyISOCode('   '))).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for null currency code', () => {
            expect(() => formatCurrency('25.5', null as any)).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for undefined currency code', () => {
            expect(() => formatCurrency('25.5', undefined as any)).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for invalid currency codes', () => {
            expect(() => formatCurrency('25.5', toCurrencyISOCode('INVALID'))).toThrow('Invalid currency code: INVALID');
        });

        it('should handle zero amount', () => {
            const result = formatCurrency('0', USD);
            expect(result).toBe(`${LRM}$${LRM} 0.00 USD`);
        });

        it('should handle negative amounts', () => {
            const result = formatCurrency('-15.75', USD);
            expect(result).toBe(`-${LRM}$${LRM} 15.75 USD`);
        });

        it('should handle very large amounts', () => {
            const result = formatCurrency('1000000.5', USD);
            expect(result).toBe(`${LRM}$${LRM} 1,000,000.50 USD`);
        });

        it('should handle very small amounts', () => {
            const result = formatCurrency('0.01', USD);
            expect(result).toBe(`${LRM}$${LRM} 0.01 USD`);
        });
    });

    describe('format options', () => {
        it('should use different locale when specified', () => {
            const options: FormatOptions = { locale: 'de-DE' };
            const result = formatCurrency('1234.56', EUR, options);
            expect(result).toBe(`${LRM}€${LRM} 1.234,56 EUR`);
        });

        it('should omit the currency code when includeCurrencyCode is false', () => {
            const result = formatCurrency('25.5', USD, { includeCurrencyCode: false });
            expect(result).toBe(`${LRM}$${LRM} 25.50`);
        });
    });

    describe('case sensitivity', () => {
        it('should handle lowercase currency codes', () => {
            const result = formatCurrency('25.5', USD);
            expect(result).toBe(`${LRM}$${LRM} 25.50 USD`);
        });

        it('should handle mixed case currency codes', () => {
            const result = formatCurrency('25.5', USD);
            expect(result).toBe(`${LRM}$${LRM} 25.50 USD`);
        });
    });

    describe('shared-symbol currencies', () => {
        it('should append codes for currencies that share symbols', () => {
            const usd = formatCurrency('50', USD);
            const cad = formatCurrency('75', toCurrencyISOCode('CAD'));
            expect(usd).toBe(`${LRM}$${LRM} 50.00 USD`);
            expect(cad).toBe(`${LRM}$${LRM} 75.00 CAD`);
        });

        it('should differentiate pound-based currencies', () => {
            const gbp = formatCurrency('25', GBP);
            const egp = formatCurrency('25', EGP);
            expect(gbp).toBe(`${LRM}£${LRM} 25.00 GBP`);
            expect(egp).toBe(`${LRM}£${LRM} 25.00 EGP`);
        });
    });

    describe('symbol-matches-code currencies', () => {
        it('should not duplicate CHF symbol when it matches code', () => {
            const result = formatCurrency('100', CHF);
            expect(result).toBe('100.00 CHF');
        });

        it('should not duplicate CHF symbol without currency code', () => {
            const result = formatCurrency('100', CHF, { includeCurrencyCode: false });
            expect(result).toBe('100.00');
        });
    });

    describe('RTL currency symbols', () => {
        it('should wrap RTL symbols with LRM to prevent repositioning', () => {
            const result = formatCurrency('100', AED);
            expect(result).toBe(`${LRM}د.إ${LRM} 100.00 AED`);
        });
    });

    describe('locale-aware formatting', () => {
        it('should use Ukrainian locale formatting when specified', () => {
            const options: FormatOptions = { locale: 'uk-UA' };
            const result = formatCurrency('1234.56', EUR, options);
            // Ukrainian uses non-breaking space as thousands separator and comma for decimal
            // Normalize spaces for comparison (different Unicode space chars)
            const normalized = result.replace(/\s/g, ' ');
            expect(normalized).toBe(`${LRM}€${LRM} 1 234,56 EUR`);
        });

        it('should use French locale formatting when specified', () => {
            const options: FormatOptions = { locale: 'fr-FR' };
            const result = formatCurrency('1234.56', EUR, options);
            // French uses narrow non-breaking space as thousands separator and comma for decimal
            expect(result).toContain('1');
            expect(result).toContain('234');
            expect(result).toContain('56');
            expect(result).toContain('EUR');
        });
    });
});

describe('formatCurrencyParts', () => {
    it('should return currency parts with default locale', () => {
        const result = formatCurrencyParts('1234.56', USD);
        expect(result.sign).toBe('');
        expect(result.symbol).toBe('$');
        expect(result.formattedNumber).toBe('1,234.56');
        expect(result.currencyCode).toBe('USD');
    });

    it('should return negative sign separately', () => {
        const result = formatCurrencyParts('-50.00', USD);
        expect(result.sign).toBe('-');
        expect(result.formattedNumber).toBe('50.00');
    });

    it('should use specified locale for number formatting', () => {
        const result = formatCurrencyParts('1234.56', EUR, { locale: 'de-DE' });
        expect(result.formattedNumber).toBe('1.234,56');
    });

    it('should use Ukrainian locale when specified', () => {
        const result = formatCurrencyParts('1234.56', EUR, { locale: 'uk-UA' });
        // Ukrainian uses non-breaking space as thousands separator
        // Normalize spaces for comparison (different Unicode space chars)
        const normalized = result.formattedNumber.replace(/\s/g, ' ');
        expect(normalized).toBe('1 234,56');
    });
});
