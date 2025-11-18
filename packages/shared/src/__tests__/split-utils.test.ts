import { describe, expect, it } from 'vitest';
import { parseMonetaryAmount } from '../split-utils';

describe('parseMonetaryAmount', () => {
    describe('Valid inputs', () => {
        describe('String inputs', () => {
            it('should parse valid positive string amounts', () => {
                expect(parseMonetaryAmount('123.45')).toBe(123.45);
                expect(parseMonetaryAmount('100')).toBe(100);
                expect(parseMonetaryAmount('0.01')).toBe(0.01);
                expect(parseMonetaryAmount('999.99')).toBe(999.99);
            });

            it('should parse valid negative string amounts', () => {
                expect(parseMonetaryAmount('-123.45')).toBe(-123.45);
                expect(parseMonetaryAmount('-100')).toBe(-100);
                expect(parseMonetaryAmount('-0.01')).toBe(-0.01);
            });

            it('should parse zero', () => {
                expect(parseMonetaryAmount('0')).toBe(0);
                expect(parseMonetaryAmount('0.0')).toBe(0);
                expect(parseMonetaryAmount('0.00')).toBe(0);
            });

            it('should handle amounts with many decimal places', () => {
                expect(parseMonetaryAmount('100.123')).toBe(100.123);
                expect(parseMonetaryAmount('33.333333')).toBe(33.333333);
                expect(parseMonetaryAmount('0.12345')).toBe(0.12345);
            });

            it('should handle amounts with leading/trailing whitespace', () => {
                expect(parseMonetaryAmount('  123.45  ')).toBe(123.45);
                expect(parseMonetaryAmount('\t100\n')).toBe(100);
                expect(parseMonetaryAmount(' 0.01 ')).toBe(0.01);
            });

            it('should handle very large amounts', () => {
                expect(parseMonetaryAmount('1000000.00')).toBe(1000000);
                expect(parseMonetaryAmount('999999999.99')).toBe(999999999.99);
            });

            it('should handle very small amounts', () => {
                expect(parseMonetaryAmount('0.001')).toBe(0.001);
                expect(parseMonetaryAmount('0.0001')).toBe(0.0001);
            });
        });

        describe('Number inputs (backward compatibility)', () => {
            it('should accept positive numbers', () => {
                expect(parseMonetaryAmount(123.45)).toBe(123.45);
                expect(parseMonetaryAmount(100)).toBe(100);
                expect(parseMonetaryAmount(0.01)).toBe(0.01);
            });

            it('should accept negative numbers', () => {
                expect(parseMonetaryAmount(-123.45)).toBe(-123.45);
                expect(parseMonetaryAmount(-100)).toBe(-100);
            });

            it('should accept zero', () => {
                expect(parseMonetaryAmount(0)).toBe(0);
            });

            it('should accept very large numbers', () => {
                expect(parseMonetaryAmount(1000000)).toBe(1000000);
            });

            it('should accept very small numbers', () => {
                expect(parseMonetaryAmount(0.001)).toBe(0.001);
            });
        });
    });

    describe('Invalid inputs', () => {
        describe('Invalid string formats', () => {
            it('should reject empty strings', () => {
                expect(() => parseMonetaryAmount('')).toThrow('Amount cannot be empty');
                expect(() => parseMonetaryAmount('   ')).toThrow('Amount cannot be empty');
            });

            it('should reject non-numeric strings', () => {
                expect(() => parseMonetaryAmount('abc')).toThrow('Invalid monetary amount format');
                expect(() => parseMonetaryAmount('$100')).toThrow('Invalid monetary amount format');
                expect(() => parseMonetaryAmount('100 USD')).toThrow('Invalid monetary amount format');
                expect(() => parseMonetaryAmount('1,000.00')).toThrow('Invalid monetary amount format');
            });

            it('should reject strings with invalid decimal format', () => {
                expect(() => parseMonetaryAmount('100.')).toThrow('Invalid monetary amount format');
                expect(() => parseMonetaryAmount('.100')).toThrow('Invalid monetary amount format');
                expect(() => parseMonetaryAmount('100.123.45')).toThrow('Invalid monetary amount format');
            });

            it('should reject strings with multiple minus signs', () => {
                expect(() => parseMonetaryAmount('--100')).toThrow('Invalid monetary amount format');
                expect(() => parseMonetaryAmount('-100-')).toThrow('Invalid monetary amount format');
            });

            it('should reject strings with internal whitespace', () => {
                expect(() => parseMonetaryAmount('100 .50')).toThrow('Invalid monetary amount format');
                expect(() => parseMonetaryAmount('1 0 0')).toThrow('Invalid monetary amount format');
            });

            it('should reject special number strings', () => {
                expect(() => parseMonetaryAmount('NaN')).toThrow('Invalid monetary amount format');
                expect(() => parseMonetaryAmount('Infinity')).toThrow('Invalid monetary amount format');
                expect(() => parseMonetaryAmount('-Infinity')).toThrow('Invalid monetary amount format');
            });
        });

        describe('Invalid number inputs', () => {
            it('should reject NaN', () => {
                expect(() => parseMonetaryAmount(NaN)).toThrow('Amount is not finite');
            });

            it('should reject Infinity', () => {
                expect(() => parseMonetaryAmount(Infinity)).toThrow('Amount is not finite');
                expect(() => parseMonetaryAmount(-Infinity)).toThrow('Amount is not finite');
            });
        });

        describe('Invalid types', () => {
            it('should reject null and undefined', () => {
                expect(() => parseMonetaryAmount(null as any)).toThrow('Amount must be a string or number');
                expect(() => parseMonetaryAmount(undefined as any)).toThrow('Amount must be a string or number');
            });

            it('should reject objects and arrays', () => {
                expect(() => parseMonetaryAmount({} as any)).toThrow('Amount must be a string or number');
                expect(() => parseMonetaryAmount([] as any)).toThrow('Amount must be a string or number');
                expect(() => parseMonetaryAmount([100] as any)).toThrow('Amount must be a string or number');
            });

            it('should reject booleans', () => {
                expect(() => parseMonetaryAmount(true as any)).toThrow('Amount must be a string or number');
                expect(() => parseMonetaryAmount(false as any)).toThrow('Amount must be a string or number');
            });
        });
    });

    describe('Edge cases and floating-point precision', () => {
        it('should handle the classic 0.1 + 0.2 floating-point issue', () => {
            // JavaScript: 0.1 + 0.2 = 0.30000000000000004
            const result = 0.1 + 0.2;
            expect(parseMonetaryAmount(result)).toBe(result);
        });

        it('should parse string representation of problematic floating-point values', () => {
            expect(parseMonetaryAmount('0.30000000000000004')).toBe(0.30000000000000004);
            expect(parseMonetaryAmount('0.3')).toBe(0.3);
        });

        it('should handle repeated division edge cases', () => {
            // 100 / 3 = 33.333...
            const thirdValue = 100 / 3;
            expect(parseMonetaryAmount(thirdValue)).toBe(thirdValue);
            expect(parseMonetaryAmount('33.333333333333336')).toBe(33.333333333333336);
        });

        it('should handle very precise decimal strings', () => {
            expect(parseMonetaryAmount('0.123456789012345')).toBe(0.123456789012345);
            expect(parseMonetaryAmount('999.999999999999')).toBe(999.999999999999);
        });
    });

    describe('Type compatibility', () => {
        it('should work with Amount type (string)', () => {
            const amount: string = '100.00';
            expect(parseMonetaryAmount(amount)).toBe(100);
        });

        it('should work with number type', () => {
            const amount: number = 100.50;
            expect(parseMonetaryAmount(amount)).toBe(100.50);
        });

        it('should work with union type (string | number)', () => {
            const stringAmount: string | number = '100.00';
            const numberAmount: string | number = 100.00;
            expect(parseMonetaryAmount(stringAmount)).toBe(100);
            expect(parseMonetaryAmount(numberAmount)).toBe(100);
        });
    });
});
