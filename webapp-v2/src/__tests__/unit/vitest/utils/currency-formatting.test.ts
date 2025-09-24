import { describe, it, expect, vi } from 'vitest';
import { formatCurrency, type FormatOptions } from '@/utils/currency/currencyFormatter.ts';

// Mock the getCurrency function from shared package
vi.mock('@splitifyd/shared', () => ({
    getCurrency: vi.fn((code: string) => {
        const upperCode = code.toUpperCase();
        const currencies = {
            'USD': { symbol: '$', decimal_digits: 2, code: 'USD' },
            'EUR': { symbol: '€', decimal_digits: 2, code: 'EUR' },
            'JPY': { symbol: '¥', decimal_digits: 0, code: 'JPY' },
            'GBP': { symbol: '£', decimal_digits: 2, code: 'GBP' },
            'BHD': { symbol: 'BD', decimal_digits: 3, code: 'BHD' }, // Bahraini Dinar has 3 decimal places
        };

        const currency = currencies[upperCode as keyof typeof currencies];
        if (!currency) {
            throw new Error(`Invalid currency code: ${code}`);
        }
        return currency;
    }),
}));

describe('formatCurrency', () => {
    describe('basic formatting', () => {
        it('should format USD currency with default options', () => {
            const result = formatCurrency(25.50, 'USD');
            // Should use Intl.NumberFormat for proper locale formatting
            expect(result).toMatch(/\$25\.50/);
        });

        it('should format EUR currency', () => {
            const result = formatCurrency(99.99, 'EUR');
            expect(result).toContain('€');
            expect(result).toContain('99.99');
        });

        it('should format JPY currency with zero decimal places', () => {
            const result = formatCurrency(1000, 'JPY');
            expect(result).toContain('¥');
            expect(result).toContain('1,000');
            expect(result).not.toContain('.00');
        });

        it('should format BHD currency with three decimal places', () => {
            const result = formatCurrency(10.123, 'BHD');
            // When Intl.NumberFormat works, it uses the browser's currency formatting
            // which may show the full currency name 'BHD' rather than the symbol 'BD'
            expect(result).toMatch(/BHD|BD/);
            expect(result).toContain('10.123');
        });
    });

    describe('edge cases', () => {
        it('should handle empty currency code by returning unformatted amount', () => {
            const result = formatCurrency(25.50, '');
            expect(result).toBe('25.50');
        });

        it('should handle whitespace-only currency code', () => {
            const result = formatCurrency(25.50, '   ');
            expect(result).toBe('25.50');
        });

        it('should handle null currency code by returning unformatted amount', () => {
            const result = formatCurrency(25.50, null as any);
            expect(result).toBe('25.50');
        });

        it('should handle undefined currency code', () => {
            const result = formatCurrency(25.50, undefined as any);
            expect(result).toBe('25.50');
        });

        it('should throw error for invalid currency codes', () => {
            expect(() => formatCurrency(25.50, 'INVALID')).toThrow('Invalid currency code: INVALID');
        });

        it('should handle zero amount', () => {
            const result = formatCurrency(0, 'USD');
            expect(result).toMatch(/\$0\.00/);
        });

        it('should handle negative amounts', () => {
            const result = formatCurrency(-15.75, 'USD');
            expect(result).toContain('-');
            expect(result).toContain('15.75');
        });

        it('should handle very large amounts', () => {
            const result = formatCurrency(1000000.50, 'USD');
            expect(result).toContain('1,000,000.50');
        });

        it('should handle very small amounts', () => {
            const result = formatCurrency(0.01, 'USD');
            expect(result).toMatch(/\$0\.01/);
        });
    });

    describe('format options', () => {
        it('should respect showSymbol option when false in fallback mode', () => {
            // Mock Intl.NumberFormat to force fallback mode
            const originalIntl = global.Intl;
            global.Intl = {
                ...originalIntl,
                NumberFormat: vi.fn().mockImplementation(() => {
                    throw new Error('Intl.NumberFormat failed');
                }),
            } as any;

            const options: FormatOptions = { showSymbol: false };
            const result = formatCurrency(25.50, 'USD', options);
            expect(result).not.toContain('$');
            expect(result).toBe('25.50');

            global.Intl = originalIntl;
        });

        it('should show currency code when showCode is true in fallback mode', () => {
            const originalIntl = global.Intl;
            global.Intl = {
                ...originalIntl,
                NumberFormat: vi.fn().mockImplementation(() => {
                    throw new Error('Intl.NumberFormat failed');
                }),
            } as any;

            const options: FormatOptions = { showCode: true, showSymbol: false };
            const result = formatCurrency(25.50, 'USD', options);
            expect(result).toContain('USD');
            expect(result).toBe('25.50 USD');

            global.Intl = originalIntl;
        });

        it('should show both symbol and code when both options are true in fallback mode', () => {
            const originalIntl = global.Intl;
            global.Intl = {
                ...originalIntl,
                NumberFormat: vi.fn().mockImplementation(() => {
                    throw new Error('Intl.NumberFormat failed');
                }),
            } as any;

            const options: FormatOptions = { showSymbol: true, showCode: true };
            const result = formatCurrency(25.50, 'USD', options);
            expect(result).toContain('$');
            expect(result).toContain('USD');
            expect(result).toBe('$25.50 USD');

            global.Intl = originalIntl;
        });

        it('should use different locale when specified', () => {
            const options: FormatOptions = { locale: 'de-DE' };
            const result = formatCurrency(1234.56, 'EUR', options);
            // German locale typically uses comma for decimal separator
            expect(result).toContain('€');
        });
    });

    describe('Intl.NumberFormat fallback behavior', () => {
        it('should fallback to manual formatting when Intl.NumberFormat fails', () => {
            // Mock Intl.NumberFormat to throw an error
            const originalIntl = global.Intl;
            global.Intl = {
                ...originalIntl,
                NumberFormat: vi.fn().mockImplementation(() => {
                    throw new Error('Intl.NumberFormat failed');
                }),
            } as any;

            const result = formatCurrency(25.50, 'USD');
            expect(result).toBe('$25.50');

            // Restore original Intl
            global.Intl = originalIntl;
        });

        it('should fallback with showCode option when Intl fails', () => {
            const originalIntl = global.Intl;
            global.Intl = {
                ...originalIntl,
                NumberFormat: vi.fn().mockImplementation(() => {
                    throw new Error('Intl.NumberFormat failed');
                }),
            } as any;

            const result = formatCurrency(25.50, 'USD', { showCode: true, showSymbol: false });
            expect(result).toBe('25.50 USD');

            global.Intl = originalIntl;
        });

        it('should fallback with both symbol and code when Intl fails', () => {
            const originalIntl = global.Intl;
            global.Intl = {
                ...originalIntl,
                NumberFormat: vi.fn().mockImplementation(() => {
                    throw new Error('Intl.NumberFormat failed');
                }),
            } as any;

            const result = formatCurrency(25.50, 'USD', { showSymbol: true, showCode: true });
            expect(result).toBe('$25.50 USD');

            global.Intl = originalIntl;
        });

        it('should fallback to plain amount when both symbol and code are false', () => {
            const originalIntl = global.Intl;
            global.Intl = {
                ...originalIntl,
                NumberFormat: vi.fn().mockImplementation(() => {
                    throw new Error('Intl.NumberFormat failed');
                }),
            } as any;

            const result = formatCurrency(25.50, 'USD', { showSymbol: false, showCode: false });
            expect(result).toBe('25.50');

            global.Intl = originalIntl;
        });
    });

    describe('currency-specific decimal places', () => {
        it('should respect currency-specific decimal places in fallback', () => {
            const originalIntl = global.Intl;
            global.Intl = {
                ...originalIntl,
                NumberFormat: vi.fn().mockImplementation(() => {
                    throw new Error('Intl.NumberFormat failed');
                }),
            } as any;

            // JPY has 0 decimal places
            const jpyResult = formatCurrency(1000.123, 'JPY');
            expect(jpyResult).toBe('¥1000');

            // BHD has 3 decimal places
            const bhdResult = formatCurrency(10.123456, 'BHD');
            expect(bhdResult).toBe('BD10.123');

            global.Intl = originalIntl;
        });
    });

    describe('case sensitivity', () => {
        it('should handle lowercase currency codes', () => {
            const result = formatCurrency(25.50, 'usd');
            expect(result).toMatch(/\$25\.50/);
        });

        it('should handle mixed case currency codes', () => {
            const result = formatCurrency(25.50, 'Usd');
            expect(result).toMatch(/\$25\.50/);
        });

        it('should show uppercase code in fallback mode', () => {
            const originalIntl = global.Intl;
            global.Intl = {
                ...originalIntl,
                NumberFormat: vi.fn().mockImplementation(() => {
                    throw new Error('Intl.NumberFormat failed');
                }),
            } as any;

            const result = formatCurrency(25.50, 'usd', { showCode: true, showSymbol: false });
            expect(result).toBe('25.50 USD');

            global.Intl = originalIntl;
        });
    });
});