import { formatCurrency, type FormatOptions } from '@/utils/currency/currencyFormatter.ts';
import { describe, expect, it } from 'vitest';

describe('formatCurrency', () => {
    describe('basic formatting', () => {
        it('should format USD currency with default options', () => {
            const result = formatCurrency("25.5", 'USD');
            // Should use Intl.NumberFormat for proper locale formatting
            expect(result).toMatch(/\$25\.50/);
        });

        it('should format EUR currency', () => {
            const result = formatCurrency("99.99", 'EUR');
            expect(result).toContain('€');
            expect(result).toContain('99.99');
        });

        it('should format JPY currency with zero decimal places', () => {
            const result = formatCurrency("1000", 'JPY');
            expect(result).toContain('¥');
            expect(result).toContain('1,000');
            expect(result).not.toContain('.00');
        });

        it('should format BHD currency with three decimal places', () => {
            const result = formatCurrency("10.123", 'BHD');
            // When Intl.NumberFormat works, it uses the browser's currency formatting
            // which may show the full currency name 'BHD' rather than the symbol 'BD'
            expect(result).toMatch(/BHD|BD/);
            expect(result).toContain('10.123');
        });
    });

    describe('edge cases', () => {
        it('should throw error for empty currency code', () => {
            expect(() => formatCurrency("25.5", '')).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for whitespace-only currency code', () => {
            expect(() => formatCurrency("25.5", '   ')).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for null currency code', () => {
            expect(() => formatCurrency("25.5", null as any)).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for undefined currency code', () => {
            expect(() => formatCurrency("25.5", undefined as any)).toThrow('you must supply a currencyCode AND amount');
        });

        it('should throw error for invalid currency codes', () => {
            expect(() => formatCurrency("25.5", 'INVALID')).toThrow('Invalid currency code: INVALID');
        });

        it('should handle zero amount', () => {
            const result = formatCurrency("0", 'USD');
            expect(result).toMatch(/\$0\.00/);
        });

        it('should handle negative amounts', () => {
            const result = formatCurrency("-15.75", 'USD');
            expect(result).toContain('-');
            expect(result).toContain('15.75');
        });

        it('should handle very large amounts', () => {
            const result = formatCurrency("1000000.5", 'USD');
            expect(result).toContain('1,000,000.50');
        });

        it('should handle very small amounts', () => {
            const result = formatCurrency("0.01", 'USD');
            expect(result).toMatch(/\$0\.01/);
        });
    });

    describe('format options', () => {
        it('should use different locale when specified', () => {
            const options: FormatOptions = { locale: 'de-DE' };
            const result = formatCurrency("1234.56", 'EUR', options);
            // German locale typically uses comma for decimal separator
            expect(result).toContain('€');
        });
    });

    describe('case sensitivity', () => {
        it('should handle lowercase currency codes', () => {
            const result = formatCurrency("25.5", 'usd');
            expect(result).toMatch(/\$25\.50/);
        });

        it('should handle mixed case currency codes', () => {
            const result = formatCurrency("25.5", 'Usd');
            expect(result).toMatch(/\$25\.50/);
        });
    });
});
