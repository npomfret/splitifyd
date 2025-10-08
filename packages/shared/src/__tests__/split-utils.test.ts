import { describe, expect, it } from 'vitest';
import { calculateEqualSplits, calculateExactSplits, calculatePercentageSplits, getCurrencyDecimals, roundToCurrencyPrecision } from '../split-utils';

describe('Split Utils', () => {
    describe('getCurrencyDecimals', () => {
        it('should return 0 decimals for zero-decimal currencies', () => {
            expect(getCurrencyDecimals('JPY')).toBe(0);
            expect(getCurrencyDecimals('KRW')).toBe(0);
            expect(getCurrencyDecimals('VND')).toBe(0);
            expect(getCurrencyDecimals('CLP')).toBe(0);
        });

        it('should return 1 decimal for one-decimal currencies', () => {
            expect(getCurrencyDecimals('MGA')).toBe(1);
            expect(getCurrencyDecimals('MRU')).toBe(1);
        });

        it('should return 2 decimals for two-decimal currencies', () => {
            expect(getCurrencyDecimals('USD')).toBe(2);
            expect(getCurrencyDecimals('EUR')).toBe(2);
            expect(getCurrencyDecimals('GBP')).toBe(2);
            expect(getCurrencyDecimals('CAD')).toBe(2);
        });

        it('should return 3 decimals for three-decimal currencies', () => {
            expect(getCurrencyDecimals('BHD')).toBe(3);
            expect(getCurrencyDecimals('KWD')).toBe(3);
            expect(getCurrencyDecimals('OMR')).toBe(3);
            expect(getCurrencyDecimals('JOD')).toBe(3);
        });

        it('should be case-insensitive', () => {
            expect(getCurrencyDecimals('usd')).toBe(2);
            expect(getCurrencyDecimals('jpy')).toBe(0);
            expect(getCurrencyDecimals('bhd')).toBe(3);
        });

        it('should throw for invalid currency codes', () => {
            expect(() => getCurrencyDecimals('INVALID')).toThrow('Invalid currency code');
            expect(() => getCurrencyDecimals('XXX')).toThrow('Invalid currency code');
            expect(() => getCurrencyDecimals('')).toThrow('Invalid currency code');
        });
    });

    describe('roundToCurrencyPrecision', () => {
        it('should round to 0 decimals for JPY', () => {
            expect(roundToCurrencyPrecision(33.333333, 'JPY')).toBe(33);
            expect(roundToCurrencyPrecision(33.666666, 'JPY')).toBe(34);
            expect(roundToCurrencyPrecision(100.1, 'JPY')).toBe(100);
            expect(roundToCurrencyPrecision(100.9, 'JPY')).toBe(101);
        });

        it('should round to 1 decimal for MGA', () => {
            expect(roundToCurrencyPrecision(33.333333, 'MGA')).toBe(33.3);
            expect(roundToCurrencyPrecision(33.666666, 'MGA')).toBe(33.7);
            expect(roundToCurrencyPrecision(100.15, 'MGA')).toBe(100.2);
            expect(roundToCurrencyPrecision(100.14, 'MGA')).toBe(100.1);
        });

        it('should round to 2 decimals for USD', () => {
            expect(roundToCurrencyPrecision(33.333333, 'USD')).toBe(33.33);
            expect(roundToCurrencyPrecision(33.336666, 'USD')).toBe(33.34);
            expect(roundToCurrencyPrecision(100.125, 'USD')).toBe(100.13);
            expect(roundToCurrencyPrecision(100.124, 'USD')).toBe(100.12);
        });

        it('should round to 3 decimals for BHD', () => {
            expect(roundToCurrencyPrecision(33.333333, 'BHD')).toBe(33.333);
            expect(roundToCurrencyPrecision(33.333666, 'BHD')).toBe(33.334);
            expect(roundToCurrencyPrecision(100.1235, 'BHD')).toBe(100.124);
            expect(roundToCurrencyPrecision(100.1234, 'BHD')).toBe(100.123);
        });

        it('should handle already-rounded amounts', () => {
            expect(roundToCurrencyPrecision(100, 'JPY')).toBe(100);
            expect(roundToCurrencyPrecision(100.5, 'MGA')).toBe(100.5);
            expect(roundToCurrencyPrecision(100.5, 'USD')).toBe(100.5);
            expect(roundToCurrencyPrecision(100.5, 'BHD')).toBe(100.5);
        });
    });

    describe('calculateEqualSplits', () => {
        describe('JPY (0 decimals)', () => {
            it('should split evenly divisible amounts', () => {
                const splits = calculateEqualSplits(90, 'JPY', ['user1', 'user2', 'user3']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: 30 },
                    { uid: 'user2', amount: 30 },
                    { uid: 'user3', amount: 30 },
                ]);
            });

            it('should handle indivisible amounts with remainder to last participant', () => {
                const splits = calculateEqualSplits(100, 'JPY', ['user1', 'user2', 'user3']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: 33 },
                    { uid: 'user2', amount: 33 },
                    { uid: 'user3', amount: 34 }, // Last gets remainder
                ]);
                // Verify total adds up exactly
                const total = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(total).toBe(100);
            });

            it('should handle 2-way split with odd amount', () => {
                const splits = calculateEqualSplits(101, 'JPY', ['user1', 'user2']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: 50 },
                    { uid: 'user2', amount: 51 }, // Last gets remainder
                ]);
                const total = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(total).toBe(101);
            });
        });

        describe('USD (2 decimals)', () => {
            it('should split evenly divisible amounts', () => {
                const splits = calculateEqualSplits(90, 'USD', ['user1', 'user2', 'user3']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: 30.0 },
                    { uid: 'user2', amount: 30.0 },
                    { uid: 'user3', amount: 30.0 },
                ]);
            });

            it('should handle indivisible amounts with remainder to last participant', () => {
                const splits = calculateEqualSplits(100, 'USD', ['user1', 'user2', 'user3']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: 33.33 },
                    { uid: 'user2', amount: 33.33 },
                    { uid: 'user3', amount: 33.34 }, // Last gets remainder
                ]);
                // Verify total adds up exactly
                const total = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(total).toBe(100);
            });

            it('should handle many participants', () => {
                const participants = Array.from({ length: 7 }, (_, i) => `user${i + 1}`);
                const splits = calculateEqualSplits(100, 'USD', participants);

                // Using integer math: 10000 cents / 7 = 1428 cents base (14.28)
                // First 6 get 14.28, last gets remainder: 100 - (14.28 * 6) = 14.32
                expect(splits.slice(0, 6).every((s) => s.amount === 14.28)).toBe(true);
                expect(splits[6].amount).toBe(14.32);

                // Verify total (account for floating point precision)
                const total = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(total).toBeCloseTo(100, 10);
            });
        });

        describe('BHD (3 decimals)', () => {
            it('should split with 3 decimal precision', () => {
                const splits = calculateEqualSplits(100, 'BHD', ['user1', 'user2', 'user3']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: 33.333 },
                    { uid: 'user2', amount: 33.333 },
                    { uid: 'user3', amount: 33.334 }, // Last gets remainder
                ]);
                const total = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(total).toBe(100);
            });
        });

        describe('MGA (1 decimal)', () => {
            it('should split with 1 decimal precision', () => {
                const splits = calculateEqualSplits(100, 'MGA', ['user1', 'user2', 'user3']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: 33.3 },
                    { uid: 'user2', amount: 33.3 },
                    { uid: 'user3', amount: 33.4 }, // Last gets remainder
                ]);
                const total = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(total).toBe(100);
            });
        });

        describe('Edge cases', () => {
            it('should return empty array for empty participants', () => {
                const splits = calculateEqualSplits(100, 'USD', []);
                expect(splits).toEqual([]);
            });

            it('should return empty array for zero amount', () => {
                const splits = calculateEqualSplits(0, 'USD', ['user1', 'user2']);
                expect(splits).toEqual([]);
            });

            it('should return empty array for negative amount', () => {
                const splits = calculateEqualSplits(-100, 'USD', ['user1', 'user2']);
                expect(splits).toEqual([]);
            });

            it('should handle single participant', () => {
                const splits = calculateEqualSplits(100, 'USD', ['user1']);
                expect(splits).toEqual([{ uid: 'user1', amount: 100 }]);
            });

            it('should handle very small amounts', () => {
                const splits = calculateEqualSplits(0.03, 'USD', ['user1', 'user2', 'user3']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: 0.01 },
                    { uid: 'user2', amount: 0.01 },
                    { uid: 'user3', amount: 0.01 },
                ]);
                const total = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(total).toBe(0.03);
            });
        });
    });

    describe('calculateExactSplits', () => {
        it('should return same as calculateEqualSplits as starting point', () => {
            const equalSplits = calculateEqualSplits(100, 'USD', ['user1', 'user2', 'user3']);
            const exactSplits = calculateExactSplits(100, 'USD', ['user1', 'user2', 'user3']);
            expect(exactSplits).toEqual(equalSplits);
        });

        it('should work for all currency types', () => {
            expect(calculateExactSplits(100, 'JPY', ['user1', 'user2'])).toEqual([
                { uid: 'user1', amount: 50 },
                { uid: 'user2', amount: 50 },
            ]);

            expect(calculateExactSplits(100, 'USD', ['user1', 'user2'])).toEqual([
                { uid: 'user1', amount: 50.0 },
                { uid: 'user2', amount: 50.0 },
            ]);
        });
    });

    describe('calculatePercentageSplits', () => {
        describe('Basic percentage splits', () => {
            it('should split 100% evenly among participants', () => {
                const splits = calculatePercentageSplits(90, 'USD', ['user1', 'user2', 'user3']);

                // Each gets ~33.33%, amounts add up to 90
                expect(splits).toHaveLength(3);
                expect(splits[0].percentage).toBeCloseTo(33.33, 1);
                expect(splits[1].percentage).toBeCloseTo(33.33, 1);
                // Last participant percentage is calculated from actual remainder amount
                expect(splits[2].percentage).toBeCloseTo(33.33, 1);

                expect(splits[0].amount).toBe(30.0);
                expect(splits[1].amount).toBe(30.0);
                expect(splits[2].amount).toBe(30.0);

                const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(totalAmount).toBe(90);
            });

            it('should handle indivisible percentages', () => {
                const splits = calculatePercentageSplits(100, 'USD', ['user1', 'user2', 'user3']);

                // 100 / 3 = 33.333...%
                expect(splits).toHaveLength(3);

                // Amounts should be rounded and total should equal 100
                const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(totalAmount).toBe(100);
            });

            it('should ensure percentages always sum to exactly 100%', () => {
                // This test catches the bug where percentages were calculated from rounded amounts
                // causing totals like 100.0066% instead of exactly 100%
                const testCases = [
                    { amount: 1000, currency: 'JPY', participants: ['u1', 'u2', 'u3'] }, // 0 decimals
                    { amount: 100.5, currency: 'MGA', participants: ['u1', 'u2', 'u3'] }, // 1 decimal
                    { amount: 100, currency: 'USD', participants: ['u1', 'u2', 'u3'] }, // 2 decimals
                    { amount: 10.123, currency: 'BHD', participants: ['u1', 'u2', 'u3'] }, // 3 decimals
                ];

                testCases.forEach(({ amount, currency, participants }) => {
                    const splits = calculatePercentageSplits(amount, currency, participants);
                    const totalPercentage = splits.reduce((sum, s) => sum + s.percentage, 0);

                    // Percentages must sum to EXACTLY 100, not 100.0066 or similar
                    expect(totalPercentage).toBe(100);
                });
            });
        });

        describe('Currency-specific rounding', () => {
            it('should work with JPY (0 decimals)', () => {
                const splits = calculatePercentageSplits(100, 'JPY', ['user1', 'user2', 'user3']);

                expect(splits[0].amount).toBe(33);
                expect(splits[1].amount).toBe(33);
                expect(splits[2].amount).toBe(34); // Remainder to last

                const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(totalAmount).toBe(100);
            });

            it('should work with BHD (3 decimals)', () => {
                const splits = calculatePercentageSplits(100, 'BHD', ['user1', 'user2', 'user3']);

                expect(splits[0].amount).toBe(33.333);
                expect(splits[1].amount).toBe(33.333);
                expect(splits[2].amount).toBe(33.334); // Remainder to last

                const totalAmount = splits.reduce((sum, s) => sum + s.amount, 0);
                expect(totalAmount).toBe(100);
            });
        });

        describe('Edge cases', () => {
            it('should return empty array for empty participants', () => {
                const splits = calculatePercentageSplits(100, 'USD', []);
                expect(splits).toEqual([]);
            });

            it('should return empty array for zero amount', () => {
                const splits = calculatePercentageSplits(0, 'USD', ['user1', 'user2']);
                expect(splits).toEqual([]);
            });

            it('should handle single participant', () => {
                const splits = calculatePercentageSplits(100, 'USD', ['user1']);
                expect(splits).toEqual([{ uid: 'user1', percentage: 100, amount: 100 }]);
            });

            it('should handle 2 participants evenly', () => {
                const splits = calculatePercentageSplits(100, 'USD', ['user1', 'user2']);
                expect(splits).toEqual([
                    { uid: 'user1', percentage: 50, amount: 50.0 },
                    { uid: 'user2', percentage: 50, amount: 50.0 },
                ]);
            });
        });
    });

    describe('CRITICAL: Mathematical Precision Guarantees - Zero Tolerance', () => {
        // These tests ensure splits ALWAYS sum to exactly the total amount with NO floating point errors
        // ANY failure here means the split calculation is broken and MUST be fixed

        describe('Equal Splits - Precision Guarantee', () => {
            const testCases = [
                // [amount, currency, participantCount, description]
                // Zero-decimal currencies
                [100, 'JPY', 3, 'JPY with 3 people'],
                [1000, 'KRW', 7, 'KRW with 7 people'],
                [999, 'VND', 11, 'VND prime participants'],
                [10001, 'CLP', 13, 'CLP large amount'],

                // One-decimal currencies
                [100.5, 'MGA', 3, 'MGA with decimals'],
                [999.9, 'MRU', 7, 'MRU edge amount'],
                [10.1, 'MGA', 11, 'MGA small amount'],

                // Two-decimal currencies
                [100, 'USD', 3, 'USD standard case'],
                [100, 'USD', 7, 'USD 7 people'],
                [100, 'EUR', 11, 'EUR prime participants'],
                [99.99, 'GBP', 3, 'GBP edge amount'],
                [0.03, 'USD', 3, 'USD very small amount'],
                [1000000.01, 'USD', 17, 'USD large amount prime participants'],
                [33.33, 'CAD', 19, 'CAD complex division'],

                // Three-decimal currencies
                [100, 'BHD', 3, 'BHD standard case'],
                [999.999, 'KWD', 7, 'KWD edge amount'],
                [10.001, 'OMR', 11, 'OMR small amount'],
                [100.123, 'JOD', 13, 'JOD complex amount'],
            ] as const;

            testCases.forEach(([amount, currency, participantCount, description]) => {
                it(`${description}: ${amount} ${currency} ÷ ${participantCount} must sum EXACTLY to ${amount}`, () => {
                    const participants = Array.from({ length: participantCount }, (_, i) => `user${i + 1}`);
                    const splits = calculateEqualSplits(amount, currency, participants);

                    // Sum all split amounts
                    const total = splits.reduce((sum, split) => sum + split.amount, 0);

                    // Round the total to currency precision to eliminate floating point accumulation errors
                    // (e.g., 33.33 + 33.33 + 33.34 = 100.00000000000001 in JavaScript)
                    const roundedTotal = roundToCurrencyPrecision(total, currency);
                    expect(roundedTotal).toBe(amount);

                    // Verify no split has more precision than currency allows
                    const decimals = getCurrencyDecimals(currency);
                    splits.forEach((split) => {
                        const rounded = roundToCurrencyPrecision(split.amount, currency);
                        expect(split.amount).toBe(rounded);
                    });
                });
            });

            it('should handle 100 edge cases without ANY precision errors', () => {
                // Test many random-ish amounts to catch edge cases
                const amounts = [0.01, 0.02, 0.03, 0.99, 1.01, 9.99, 10.01, 33.33, 66.67, 99.99, 100.01, 1000.01];
                const participantCounts = [2, 3, 5, 7, 11, 13];

                amounts.forEach((amount) => {
                    participantCounts.forEach((count) => {
                        const participants = Array.from({ length: count }, (_, i) => `user${i + 1}`);
                        const splits = calculateEqualSplits(amount, 'USD', participants);
                        const total = splits.reduce((sum, split) => sum + split.amount, 0);
                        const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                        expect(roundedTotal).toBe(amount);
                    });
                });
            });
        });

        describe('Percentage Splits - Precision Guarantee', () => {
            const testCases = [
                // [amount, currency, participantCount, description]
                [100, 'JPY', 3, 'JPY with 3 people'],
                [1000, 'KRW', 7, 'KRW with 7 people'],
                [100.5, 'MGA', 3, 'MGA with decimals'],
                [100, 'USD', 3, 'USD standard case'],
                [100, 'USD', 7, 'USD 7 people'],
                [100, 'USD', 11, 'USD prime participants'],
                [99.99, 'USD', 13, 'USD edge amount'],
                [100, 'BHD', 3, 'BHD standard case'],
                [100.123, 'BHD', 7, 'BHD complex amount'],
            ] as const;

            testCases.forEach(([amount, currency, participantCount, description]) => {
                it(`${description}: ${amount} ${currency} ÷ ${participantCount} must sum EXACTLY to ${amount}`, () => {
                    const participants = Array.from({ length: participantCount }, (_, i) => `user${i + 1}`);
                    const splits = calculatePercentageSplits(amount, currency, participants);

                    // Sum all split amounts
                    const total = splits.reduce((sum, split) => sum + split.amount, 0);

                    // Round the total to currency precision to eliminate floating point accumulation errors
                    const roundedTotal = roundToCurrencyPrecision(total, currency);
                    expect(roundedTotal).toBe(amount);

                    // Verify percentages sum to exactly 100%
                    const totalPercentage = splits.reduce((sum, split) => split.percentage + sum, 0);
                    expect(totalPercentage).toBe(100);

                    // Verify no split has more precision than currency allows
                    const decimals = getCurrencyDecimals(currency);
                    splits.forEach((split) => {
                        const rounded = roundToCurrencyPrecision(split.amount, currency);
                        expect(split.amount).toBe(rounded);
                    });
                });
            });
        });

        describe('Exact Splits - Precision Guarantee', () => {
            // Exact splits use the same logic as equal splits initially
            const testCases = [
                [100, 'JPY', 3],
                [100, 'USD', 7],
                [100.123, 'BHD', 11],
            ] as const;

            testCases.forEach(([amount, currency, participantCount]) => {
                it(`${amount} ${currency} ÷ ${participantCount} must sum EXACTLY to ${amount}`, () => {
                    const participants = Array.from({ length: participantCount }, (_, i) => `user${i + 1}`);
                    const splits = calculateExactSplits(amount, currency, participants);

                    const total = splits.reduce((sum, split) => sum + split.amount, 0);
                    const roundedTotal = roundToCurrencyPrecision(total, currency);
                    expect(roundedTotal).toBe(amount);
                });
            });
        });

        describe('Stress Test - Large Scale Precision', () => {
            it('should handle 1000 splits with perfect precision (USD)', () => {
                const participants = Array.from({ length: 1000 }, (_, i) => `user${i + 1}`);
                const splits = calculateEqualSplits(12345.67, 'USD', participants);

                const total = splits.reduce((sum, split) => sum + split.amount, 0);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                expect(roundedTotal).toBe(12345.67);
            });

            it('should handle 100 splits with perfect precision (BHD)', () => {
                const participants = Array.from({ length: 100 }, (_, i) => `user${i + 1}`);
                const splits = calculateEqualSplits(999.999, 'BHD', participants);

                const total = splits.reduce((sum, split) => sum + split.amount, 0);
                const roundedTotal = roundToCurrencyPrecision(total, 'BHD');
                expect(roundedTotal).toBe(999.999);
            });

            it('should handle very small amounts with many participants', () => {
                // 1 cent split 50 ways should still be exact
                const participants = Array.from({ length: 50 }, (_, i) => `user${i + 1}`);
                const splits = calculateEqualSplits(0.50, 'USD', participants);

                const total = splits.reduce((sum, split) => sum + split.amount, 0);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                expect(roundedTotal).toBe(0.50);
            });
        });

        describe('Floating Point Edge Cases', () => {
            // These amounts are known to cause floating point issues
            it('should handle 0.1 + 0.2 precision issue', () => {
                // In JavaScript: 0.1 + 0.2 = 0.30000000000000004
                const splits = calculateEqualSplits(0.30, 'USD', ['user1', 'user2']);
                const total = splits.reduce((sum, split) => sum + split.amount, 0);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                expect(roundedTotal).toBe(0.30);
            });

            it('should handle 1/3 divisions correctly', () => {
                // 100 / 3 = 33.333...
                const splits = calculateEqualSplits(100, 'USD', ['user1', 'user2', 'user3']);
                const total = splits.reduce((sum, split) => sum + split.amount, 0);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                expect(roundedTotal).toBe(100);
            });

            it('should handle 1/7 divisions correctly', () => {
                // 100 / 7 = 14.285714...
                const splits = calculateEqualSplits(100, 'USD', ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7']);
                const total = splits.reduce((sum, split) => sum + split.amount, 0);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                expect(roundedTotal).toBe(100);
            });

            it('should handle 99.99 / 3 precision', () => {
                const splits = calculateEqualSplits(99.99, 'USD', ['user1', 'user2', 'user3']);
                const total = splits.reduce((sum, split) => sum + split.amount, 0);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                expect(roundedTotal).toBe(99.99);
            });
        });
    });
});
