import { formatCurrency, type FormatOptions } from '@/utils/currency/currencyFormatter.ts';
import { describe, expect, it } from 'vitest';

describe('formatCurrency', () => {
    describe('basic formatting', () => {
        it('should format USD currency with default options', () => {
            const result = formatCurrency('25.5', 'USD');
            expect(result).toBe('$25.50 USD');
        });

        it('should format EUR currency', () => {
            const result = formatCurrency('99.99', 'EUR');
            expect(result).toBe('€99.99 EUR');
        });

        it('should format JPY currency with zero decimal places', () => {
            const result = formatCurrency('1000', 'JPY');
            expect(result).toBe('¥1,000 JPY');
        });

        it('should format BHD currency with three decimal places', () => {
            const result = formatCurrency('10.123', 'BHD');
            expect(result.endsWith(' BHD')).toBe(true);
            expect(result).toContain('10.123');
        });
    });

    describe('edge cases', () => {
        it('should throw error for empty currency code', () => {
            expect(() => formatCurrency('25.5', '')).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for whitespace-only currency code', () => {
            expect(() => formatCurrency('25.5', '   ')).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for null currency code', () => {
            expect(() => formatCurrency('25.5', null as any)).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for undefined currency code', () => {
            expect(() => formatCurrency('25.5', undefined as any)).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for invalid currency codes', () => {
            expect(() => formatCurrency('25.5', 'INVALID')).toThrow('Invalid currency code: INVALID');
        });

        it('should handle zero amount', () => {
            const result = formatCurrency('0', 'USD');
            expect(result).toBe('$0.00 USD');
        });

        it('should handle negative amounts', () => {
            const result = formatCurrency('-15.75', 'USD');
            expect(result).toBe('-$15.75 USD');
        });

        it('should handle very large amounts', () => {
            const result = formatCurrency('1000000.5', 'USD');
            expect(result).toBe('$1,000,000.50 USD');
        });

        it('should handle very small amounts', () => {
            const result = formatCurrency('0.01', 'USD');
            expect(result).toBe('$0.01 USD');
        });
    });

    describe('format options', () => {
        it('should use different locale when specified', () => {
            const options: FormatOptions = { locale: 'de-DE' };
            const result = formatCurrency('1234.56', 'EUR', options);
            expect(result).toBe('€1.234,56 EUR');
        });

        it('should omit the currency code when includeCurrencyCode is false', () => {
            const result = formatCurrency('25.5', 'USD', { includeCurrencyCode: false });
            expect(result).toBe('$25.50');
        });
    });

    describe('case sensitivity', () => {
        it('should handle lowercase currency codes', () => {
            const result = formatCurrency('25.5', 'usd');
            expect(result).toBe('$25.50 USD');
        });

        it('should handle mixed case currency codes', () => {
            const result = formatCurrency('25.5', 'Usd');
            expect(result).toBe('$25.50 USD');
        });
    });

    describe('shared-symbol currencies', () => {
        it('should append codes for currencies that share symbols', () => {
            const usd = formatCurrency('50', 'USD');
            const cad = formatCurrency('75', 'CAD');
            expect(usd).toBe('$50.00 USD');
            expect(cad).toBe('$75.00 CAD');
        });

        it('should differentiate pound-based currencies', () => {
            const gbp = formatCurrency('25', 'GBP');
            const egp = formatCurrency('25', 'EGP');
            expect(gbp).toBe('£25.00 GBP');
            expect(egp).toBe('£25.00 EGP');
        });
    });
});
