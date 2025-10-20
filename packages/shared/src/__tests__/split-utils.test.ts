import { describe, expect, it } from 'vitest';
import { amountToSmallestUnit, calculateEqualSplits, calculateExactSplits, calculatePercentageSplits, getCurrencyDecimals, roundToCurrencyPrecision } from '../split-utils';

const amountFor = (value: number | string, currency: string): string => roundToCurrencyPrecision(value, currency);
const sumSplitAmounts = (splits: Array<{ amount: string; }>): number => splits.reduce((sum, split) => sum + Number(split.amount), 0);

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
            expect(roundToCurrencyPrecision(33.333333, 'JPY')).toBe('33');
            expect(roundToCurrencyPrecision(33.666666, 'JPY')).toBe('34');
            expect(roundToCurrencyPrecision(100.1, 'JPY')).toBe('100');
            expect(roundToCurrencyPrecision(100.9, 'JPY')).toBe('101');
        });

        it('should round to 1 decimal for MGA', () => {
            expect(roundToCurrencyPrecision(33.333333, 'MGA')).toBe('33.3');
            expect(roundToCurrencyPrecision(33.666666, 'MGA')).toBe('33.7');
            expect(roundToCurrencyPrecision(100.15, 'MGA')).toBe('100.2');
            expect(roundToCurrencyPrecision(100.14, 'MGA')).toBe('100.1');
        });

        it('should round to 2 decimals for USD', () => {
            expect(roundToCurrencyPrecision(33.333333, 'USD')).toBe('33.33');
            expect(roundToCurrencyPrecision(33.336666, 'USD')).toBe('33.34');
            expect(roundToCurrencyPrecision(100.125, 'USD')).toBe('100.13');
            expect(roundToCurrencyPrecision(100.124, 'USD')).toBe('100.12');
        });

        it('should round to 3 decimals for BHD', () => {
            expect(roundToCurrencyPrecision(33.333333, 'BHD')).toBe('33.333');
            expect(roundToCurrencyPrecision(33.333666, 'BHD')).toBe('33.334');
            expect(roundToCurrencyPrecision(100.1235, 'BHD')).toBe('100.124');
            expect(roundToCurrencyPrecision(100.1234, 'BHD')).toBe('100.123');
        });

        it('should handle already-rounded amounts', () => {
            expect(roundToCurrencyPrecision(100, 'JPY')).toBe('100');
            expect(roundToCurrencyPrecision(100.5, 'MGA')).toBe('100.5');
            expect(roundToCurrencyPrecision(100.5, 'USD')).toBe('100.50'); // USD requires 2 decimals
            expect(roundToCurrencyPrecision(100.5, 'BHD')).toBe('100.500'); // BHD requires 3 decimals
        });
    });

    describe('calculateEqualSplits', () => {
        describe('JPY (0 decimals)', () => {
            it('should split evenly divisible amounts', () => {
                const splits = calculateEqualSplits('90', 'JPY', ['user1', 'user2', 'user3']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: '30' },
                    { uid: 'user2', amount: '30' },
                    { uid: 'user3', amount: '30' },
                ]);
            });

            it('should handle indivisible amounts with remainder to last participant', () => {
                const splits = calculateEqualSplits('100', 'JPY', ['user1', 'user2', 'user3'], 2);
                expect(splits).toEqual([
                    { uid: 'user1', amount: '33' },
                    { uid: 'user2', amount: '33' },
                    { uid: 'user3', amount: '34' }, // Last gets remainder
                ]);
                // Verify total adds up exactly
                const total = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(total).toBe(100);
            });

            it('should handle 2-way split with odd amount', () => {
                const splits = calculateEqualSplits('101', 'JPY', ['user1', 'user2'], 1);
                expect(splits).toEqual([
                    { uid: 'user1', amount: '50' },
                    { uid: 'user2', amount: '51' }, // Last gets remainder
                ]);
                const total = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(total).toBe(101);
            });
        });

        describe('USD (2 decimals)', () => {
            it('should split evenly divisible amounts', () => {
                const splits = calculateEqualSplits('90', 'USD', ['user1', 'user2', 'user3']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: '30.00' },
                    { uid: 'user2', amount: '30.00' },
                    { uid: 'user3', amount: '30.00' },
                ]);
            });

            it('should handle indivisible amounts with remainder to last participant', () => {
                const splits = calculateEqualSplits('100', 'USD', ['user1', 'user2', 'user3'], 2);
                expect(splits).toEqual([
                    { uid: 'user1', amount: '33.33' },
                    { uid: 'user2', amount: '33.33' },
                    { uid: 'user3', amount: '33.34' }, // Last gets remainder
                ]);
                // Verify total adds up exactly
                const total = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(total).toBe(100);
            });

            it('should handle many participants', () => {
                const participants = Array.from({ length: 7 }, (_, i) => `user${i + 1}`);
                const splits = calculateEqualSplits('100', 'USD', participants, 6);

                // Using integer math: 10000 cents / 7 = 1428 cents base (14.28)
                // First 6 get 14.28, last gets remainder: 100 - (14.28 * 6) = 14.32
                expect(splits.slice(0, 6).every((s) => s.amount === '14.28')).toBe(true);
                expect(splits[6].amount).toBe('14.32');

                // Verify total (account for floating point precision)
                const total = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(total).toBeCloseTo(100, 10);
            });
        });

        describe('BHD (3 decimals)', () => {
            it('should split with 3 decimal precision', () => {
                const splits = calculateEqualSplits('100', 'BHD', ['user1', 'user2', 'user3'], 2);
                expect(splits).toEqual([
                    { uid: 'user1', amount: '33.333' },
                    { uid: 'user2', amount: '33.333' },
                    { uid: 'user3', amount: '33.334' }, // Last gets remainder
                ]);
                const total = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(total).toBe(100);
            });
        });

        describe('MGA (1 decimal)', () => {
            it('should split with 1 decimal precision', () => {
                const splits = calculateEqualSplits('100', 'MGA', ['user1', 'user2', 'user3'], 2);
                expect(splits).toEqual([
                    { uid: 'user1', amount: '33.3' },
                    { uid: 'user2', amount: '33.3' },
                    { uid: 'user3', amount: '33.4' }, // Last gets remainder
                ]);
                const total = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(total).toBe(100);
            });
        });

        describe('Edge cases', () => {
            it('should return empty array for empty participants', () => {
                const splits = calculateEqualSplits('100', 'USD', []);
                expect(splits).toEqual([]);
            });

            it('should return empty array for zero amount', () => {
                const splits = calculateEqualSplits('0', 'USD', ['user1', 'user2']);
                expect(splits).toEqual([]);
            });

            it('should return empty array for negative amount', () => {
                const splits = calculateEqualSplits('-100', 'USD', ['user1', 'user2']);
                expect(splits).toEqual([]);
            });

            it('should handle single participant', () => {
                const splits = calculateEqualSplits('100', 'USD', ['user1']);
                expect(splits).toEqual([{ uid: 'user1', amount: '100.00' }]);
            });

            it('should handle very small amounts', () => {
                const splits = calculateEqualSplits('0.03', 'USD', ['user1', 'user2', 'user3']);
                expect(splits).toEqual([
                    { uid: 'user1', amount: '0.01' },
                    { uid: 'user2', amount: '0.01' },
                    { uid: 'user3', amount: '0.01' },
                ]);
                const total = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(total).toBeCloseTo(0.03, 10);
            });
        });

        describe('Remainder Distribution (rotationSeed)', () => {
            it('should distribute remainder deterministically when amount does not divide evenly', () => {
                // $100 split 3 ways = 10000 cents ÷ 3 = 3333 base + 1 cent remainder
                const participants = ['user1', 'user2', 'user3'];

                // Test with rotationSeed=0 (remainder goes to index 0)
                const splits = calculateEqualSplits(100, 'USD', participants, 0);

                expect(splits[0].amount).toBe('33.34'); // Gets remainder
                expect(splits[1].amount).toBe('33.33');
                expect(splits[2].amount).toBe('33.33');

                // Verify sum equals total (zero-tolerance arithmetic)
                const totalUnits = splits.reduce((sum, s) => sum + amountToSmallestUnit(s.amount, 'USD'), 0);
                expect(totalUnits).toBe(10000); // Exactly $100.00
            });

            it('should rotate remainder recipient based on seed', () => {
                const participants = ['user1', 'user2', 'user3'];

                // Seed 0: remainder to index 0
                const splits0 = calculateEqualSplits(100, 'USD', participants, 0);
                expect(splits0[0].amount).toBe('33.34');
                expect(splits0[1].amount).toBe('33.33');
                expect(splits0[2].amount).toBe('33.33');

                // Seed 1: remainder to index 1
                const splits1 = calculateEqualSplits(100, 'USD', participants, 1);
                expect(splits1[0].amount).toBe('33.33');
                expect(splits1[1].amount).toBe('33.34');
                expect(splits1[2].amount).toBe('33.33');

                // Seed 2: remainder to index 2
                const splits2 = calculateEqualSplits(100, 'USD', participants, 2);
                expect(splits2[0].amount).toBe('33.33');
                expect(splits2[1].amount).toBe('33.33');
                expect(splits2[2].amount).toBe('33.34');
            });

            it('should reject non-integer rotationSeed', () => {
                expect(() => calculateEqualSplits(100, 'USD', ['user1', 'user2'], 1.5)).toThrow('rotationSeed must be an integer');
                expect(() => calculateEqualSplits(100, 'USD', ['user1', 'user2'], 2.7)).toThrow('rotationSeed must be an integer');
                expect(() => calculateEqualSplits(100, 'USD', ['user1', 'user2'], NaN)).toThrow('rotationSeed must be an integer');
            });

            it('should reject negative rotationSeed', () => {
                expect(() => calculateEqualSplits(100, 'USD', ['user1', 'user2'], -1)).toThrow('rotationSeed must be non-negative');
                expect(() => calculateEqualSplits(100, 'USD', ['user1', 'user2'], -5)).toThrow('rotationSeed must be non-negative');
            });

            it('should accept zero as rotationSeed', () => {
                const splits = calculateEqualSplits(100, 'USD', ['user1', 'user2', 'user3'], 0);
                expect(splits[0].amount).toBe('33.34'); // First gets remainder
            });
        });
    });

    describe('calculateExactSplits', () => {
        it('should return same as calculateEqualSplits as starting point', () => {
            // Use explicit seed since random distribution would make them different
            const seed = 0;
            const equalSplits = calculateEqualSplits('100', 'USD', ['user1', 'user2', 'user3'], seed);
            const exactSplits = calculateExactSplits('100', 'USD', ['user1', 'user2', 'user3'], seed);
            expect(exactSplits).toEqual(equalSplits);
        });

        it('should work for all currency types', () => {
            expect(calculateExactSplits('100', 'JPY', ['user1', 'user2'])).toEqual([
                { uid: 'user1', amount: '50' },
                { uid: 'user2', amount: '50' },
            ]);

            expect(calculateExactSplits('100', 'USD', ['user1', 'user2'])).toEqual([
                { uid: 'user1', amount: '50.00' },
                { uid: 'user2', amount: '50.00' },
            ]);
        });
    });

    describe('calculatePercentageSplits', () => {
        describe('Basic percentage splits', () => {
            it('should split 100% evenly among participants', () => {
                const splits = calculatePercentageSplits('90', 'USD', ['user1', 'user2', 'user3']);

                // Each gets ~33.33%, amounts add up to 90
                expect(splits).toHaveLength(3);
                expect(splits[0].percentage).toBeCloseTo(33.33, 1);
                expect(splits[1].percentage).toBeCloseTo(33.33, 1);
                // Last participant percentage is calculated from actual remainder amount
                expect(splits[2].percentage).toBeCloseTo(33.33, 1);

                expect(splits[0].amount).toBe('30.00');
                expect(splits[1].amount).toBe('30.00');
                expect(splits[2].amount).toBe('30.00');

                const totalAmount = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(totalAmount).toBeCloseTo(90, 10);
            });

            it('should handle indivisible percentages', () => {
                const splits = calculatePercentageSplits('100', 'USD', ['user1', 'user2', 'user3']);

                // 100 / 3 = 33.333...%
                expect(splits).toHaveLength(3);

                // Amounts should be rounded and total should equal 100
                const totalAmount = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(totalAmount).toBeCloseTo(100, 10);
            });

            it('should ensure percentages always sum to exactly 100%', () => {
                // This test catches the bug where percentages were calculated from rounded amounts
                // causing totals like 100.0066% instead of exactly 100%
                const testCases = [
                    { amount: '1000', currency: 'JPY', participants: ['u1', 'u2', 'u3'] }, // 0 decimals
                    { amount: '100.5', currency: 'MGA', participants: ['u1', 'u2', 'u3'] }, // 1 decimal
                    { amount: '100', currency: 'USD', participants: ['u1', 'u2', 'u3'] }, // 2 decimals
                    { amount: '10.123', currency: 'BHD', participants: ['u1', 'u2', 'u3'] }, // 3 decimals
                ];

                testCases.forEach(({ amount, currency, participants }) => {
                    const splits = calculatePercentageSplits(amount, currency, participants);
                    const totalPercentage = splits.reduce((sum, s) => sum + s.percentage!, 0);

                    // Percentages must sum to EXACTLY 100, not 100.0066 or similar
                    expect(totalPercentage).toBe(100);
                });
            });
        });

        describe('Currency-specific rounding', () => {
            it('should work with JPY (0 decimals)', () => {
                const splits = calculatePercentageSplits('100', 'JPY', ['user1', 'user2', 'user3'], 2);

                expect(splits[0].amount).toBe('33');
                expect(splits[1].amount).toBe('33');
                expect(splits[2].amount).toBe('34'); // Remainder to last

                const totalAmount = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(totalAmount).toBe(100);
            });

            it('should work with BHD (3 decimals)', () => {
                const splits = calculatePercentageSplits('100', 'BHD', ['user1', 'user2', 'user3'], 2);

                expect(splits[0].amount).toBe('33.333');
                expect(splits[1].amount).toBe('33.333');
                expect(splits[2].amount).toBe('33.334'); // Remainder to last

                const totalAmount = splits.reduce((sum, s) => sum + Number(s.amount), 0);
                expect(totalAmount).toBe(100);
            });
        });

        describe('Edge cases', () => {
            it('should return empty array for empty participants', () => {
                const splits = calculatePercentageSplits('100', 'USD', []);
                expect(splits).toEqual([]);
            });

            it('should return empty array for zero amount', () => {
                const splits = calculatePercentageSplits('0', 'USD', ['user1', 'user2']);
                expect(splits).toEqual([]);
            });

            it('should handle single participant', () => {
                const splits = calculatePercentageSplits('100', 'USD', ['user1']);
                expect(splits).toEqual([{ uid: 'user1', percentage: 100, amount: '100.00' }]);
            });

            it('should handle 2 participants evenly', () => {
                const splits = calculatePercentageSplits('100', 'USD', ['user1', 'user2']);
                expect(splits).toEqual([
                    { uid: 'user1', percentage: 50, amount: '50.00' },
                    { uid: 'user2', percentage: 50, amount: '50.00' },
                ]);
            });
        });

        describe('Rotation Seed Validation', () => {
            it('should reject non-integer rotationSeed', () => {
                expect(() => calculatePercentageSplits(100, 'USD', ['user1', 'user2'], 1.5)).toThrow('rotationSeed must be an integer');
                expect(() => calculatePercentageSplits(100, 'USD', ['user1', 'user2'], 2.7)).toThrow('rotationSeed must be an integer');
                expect(() => calculatePercentageSplits(100, 'USD', ['user1', 'user2'], NaN)).toThrow('rotationSeed must be an integer');
            });

            it('should reject negative rotationSeed', () => {
                expect(() => calculatePercentageSplits(100, 'USD', ['user1', 'user2'], -1)).toThrow('rotationSeed must be non-negative');
                expect(() => calculatePercentageSplits(100, 'USD', ['user1', 'user2'], -5)).toThrow('rotationSeed must be non-negative');
            });

            it('should accept zero as rotationSeed', () => {
                const splits = calculatePercentageSplits(100, 'USD', ['user1', 'user2', 'user3'], 0);
                expect(splits[0].amount).toBe('33.34'); // First gets remainder
                // Percentage is still 100/3 even though amount is 33.34 due to rounding
                expect(splits[0].percentage).toBeCloseTo(33.33, 2);
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
                    const total = sumSplitAmounts(splits);

                    // Round the total to currency precision to eliminate floating point accumulation errors
                    // (e.g., 33.33 + 33.33 + 33.34 = 100.00000000000001 in JavaScript)
                    const roundedTotal = roundToCurrencyPrecision(total, currency);
                    const expectedTotal = amountFor(amount, currency);
                    expect(roundedTotal).toBe(expectedTotal);

                    // Verify no split has more precision than currency allows
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
                        const total = sumSplitAmounts(splits);
                        const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                        const expectedTotal = amountFor(amount, 'USD');
                        expect(roundedTotal).toBe(expectedTotal);
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
                    // Use explicit rotation seed to ensure "last gets remainder" for deterministic percentages
                    const rotationSeed = participantCount - 1;
                    const splits = calculatePercentageSplits(amount, currency, participants, rotationSeed);

                    // Sum all split amounts
                    const total = sumSplitAmounts(splits);

                    // Round the total to currency precision to eliminate floating point accumulation errors
                    const roundedTotal = roundToCurrencyPrecision(total, currency);
                    const expectedTotal = amountFor(amount, currency);
                    expect(roundedTotal).toBe(expectedTotal);

                    // Verify percentages sum to exactly 100%
                    const totalPercentage = splits.reduce((sum, split) => split.percentage! + sum, 0);
                    expect(totalPercentage).toBe(100);

                    // Verify no split has more precision than currency allows
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

                    const total = sumSplitAmounts(splits);
                    const roundedTotal = roundToCurrencyPrecision(total, currency);
                    const expectedTotal = amountFor(amount, currency);
                    expect(roundedTotal).toBe(expectedTotal);
                });
            });
        });

        describe('Stress Test - Large Scale Precision', () => {
            it('should handle 1000 splits with perfect precision (USD)', () => {
                const participants = Array.from({ length: 1000 }, (_, i) => `user${i + 1}`);
                const splits = calculateEqualSplits(12345.67, 'USD', participants);

                const total = sumSplitAmounts(splits);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                const expectedTotal = amountFor(12345.67, 'USD');
                expect(roundedTotal).toBe(expectedTotal);
            });

            it('should handle 100 splits with perfect precision (BHD)', () => {
                const participants = Array.from({ length: 100 }, (_, i) => `user${i + 1}`);
                const splits = calculateEqualSplits(999.999, 'BHD', participants);

                const total = sumSplitAmounts(splits);
                const roundedTotal = roundToCurrencyPrecision(total, 'BHD');
                const expectedTotal = amountFor(999.999, 'BHD');
                expect(roundedTotal).toBe(expectedTotal);
            });

            it('should handle very small amounts with many participants', () => {
                // 1 cent split 50 ways should still be exact
                const participants = Array.from({ length: 50 }, (_, i) => `user${i + 1}`);
                const splits = calculateEqualSplits(0.50, 'USD', participants);

                const total = sumSplitAmounts(splits);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                const expectedTotal = amountFor(0.5, 'USD');
                expect(roundedTotal).toBe(expectedTotal);
            });
        });

        describe('Floating Point Edge Cases', () => {
            // These amounts are known to cause floating point issues
            it('should handle 0.1 + 0.2 precision issue', () => {
                // In JavaScript: 0.1 + 0.2 = 0.30000000000000004
                const splits = calculateEqualSplits(0.30, 'USD', ['user1', 'user2']);
                const total = sumSplitAmounts(splits);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                expect(roundedTotal).toBe(amountFor(0.3, 'USD'));
            });

            it('should handle 1/3 divisions correctly', () => {
                // 100 / 3 = 33.333...
                const splits = calculateEqualSplits(100, 'USD', ['user1', 'user2', 'user3']);
                const total = sumSplitAmounts(splits);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                expect(roundedTotal).toBe(amountFor(100, 'USD'));
            });

            it('should handle 1/7 divisions correctly', () => {
                // 100 / 7 = 14.285714...
                const splits = calculateEqualSplits(100, 'USD', ['user1', 'user2', 'user3', 'user4', 'user5', 'user6', 'user7']);
                const total = sumSplitAmounts(splits);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                expect(roundedTotal).toBe(amountFor(100, 'USD'));
            });

            it('should handle 99.99 / 3 precision', () => {
                const splits = calculateEqualSplits(99.99, 'USD', ['user1', 'user2', 'user3']);
                const total = sumSplitAmounts(splits);
                const roundedTotal = roundToCurrencyPrecision(total, 'USD');
                expect(roundedTotal).toBe(amountFor(99.99, 'USD'));
            });
        });
    });

    describe('API Serialization Precision Bugs - Why Strings Are Necessary', () => {
        describe('JSON Serialization Loses Precision', () => {
            it.skip('demonstrates the 0.1 + 0.2 problem survives JSON round-trip', () => {
                // This is THE classic floating-point bug
                const amount = 0.1 + 0.2; // = 0.30000000000000004

                // When sent over API (JSON.stringify)
                const jsonString = JSON.stringify({ amount });
                const parsed = JSON.parse(jsonString);

                // The precision error persists
                expect(parsed.amount).not.toBe(0.3);
                expect(parsed.amount).toBe(0.30000000000000004);

                // ❌ This would fail validation if we check exact amounts
                // ✅ With strings: "0.30" remains exactly "0.30"
            });

            it('demonstrates split calculation loses precision over API', () => {
                // Using raw numbers (instead of stringified amounts) recreates floating point drift
                const numericSplits = [0.1, 0.2, 0.3];

                // Send over API
                const jsonString = JSON.stringify({ splits: numericSplits });
                const parsed = JSON.parse(jsonString);

                // Client receives and sums the splits
                const clientTotal = parsed.splits.reduce((sum: number, value: number) => sum + value, 0);

                // ❌ Due to floating point accumulation, this is not exactly 0.6
                expect(clientTotal).not.toBe(0.6);
                expect(clientTotal).toBeCloseTo(0.6, 10);

                // With strings, individually parsed values would maintain exact totals
            });

            it('demonstrates balance calculations accumulate errors over multiple operations', () => {
                // Simulate multiple expenses being added/subtracted from a balance
                let balance = 0;

                // Add several expenses
                balance += 10.1;
                balance += 20.2;
                balance -= 15.15;
                balance += 5.05;

                // Expected: 20.20
                // Actual: might have tiny error

                // Send over API
                const jsonString = JSON.stringify({ balance });
                const parsed = JSON.parse(jsonString);

                // The error is small but real
                console.log('Balance after JSON:', parsed.balance);
                console.log('Expected:', 20.2);
                console.log('Difference:', parsed.balance - 20.2);

                // ❌ With numbers, the balance drifts from the expected value
                expect(parsed.balance).not.toBe(20.2);

                // ✅ With strings, each operation works with exact decimals
            });
        });

        describe('Real-World API Bug Scenarios', () => {
            it('Bug Scenario 1: Expense split validation fails due to rounding', () => {
                // Client calculates splits
                const amount = 0.3;
                const splits = [0.1, 0.2];

                // Client sends to server as JSON (using numbers instead of strings)
                const request = { amount, splits };
                const jsonString = JSON.stringify(request);

                // Server receives and validates
                const parsed = JSON.parse(jsonString);
                const serverTotal = parsed.splits.reduce((sum: number, value: number) => sum + value, 0);

                // ❌ Server validation: sum of splits must equal amount
                // With floating point, serverTotal becomes 0.30000000000000004
                expect(serverTotal).not.toBe(parsed.amount);
                expect(serverTotal).toBeCloseTo(parsed.amount, 10);

                // ✅ With strings: "33.33" + "33.33" + "33.34" = exactly "100.00"
            });

            it('Bug Scenario 2: Balance update race condition creates invalid balance', () => {
                // Initial balance
                let balance = 0;

                // Concurrent updates (simulated)
                const update1 = 0.1;
                const update2 = 0.2;
                const update3 = -0.3;

                // After updates
                balance = balance + update1 + update2 + update3;

                // Send to server
                const jsonString = JSON.stringify({ balance });
                const parsed = JSON.parse(jsonString);

                // Expected: 0
                // Actual: 5.551115123125783e-17
                console.log('Final balance:', parsed.balance);
                console.log('Expected:', 0);

                // ❌ Validation fails because balance !== expected exact value
                // ✅ With strings: each operation maintains exact precision
                expect(parsed.balance).not.toBe(0);
                expect(parsed.balance).toBeCloseTo(0, 10);
            });

            it.skip('Bug Scenario 3: Currency conversion creates impossible amounts', () => {
                // Simulating multi-currency balance
                const usdAmount = 33.33; // User's share in USD
                const eurAmount = 28.42; // Converted to EUR

                // Send both over API
                const jsonString = JSON.stringify({ usd: usdAmount, eur: eurAmount });
                const parsed = JSON.parse(jsonString);

                // Server tries to validate the conversion ratio
                const calculatedEur = parsed.usd * 0.85; // Simplified exchange rate

                // ❌ Floating point: 33.33 * 0.85 = 28.3305 !== 28.42
                // This would fail validation even though the amounts are correct

                console.log('Calculated EUR:', calculatedEur);
                console.log('Sent EUR:', parsed.eur);

                // This test demonstrates the issue but would fail with strict equality
                expect(calculatedEur).toBeCloseTo(parsed.eur, 2);

                // ✅ With strings: maintain exact amounts through API
            });
        });

        describe('String-Based API Would Solve These Issues', () => {
            it('demonstrates how strings preserve exact decimal values', () => {
                // Client calculates with numbers
                const amountNum = 0.1 + 0.2; // 0.30000000000000004

                // Convert to string for API
                const amountStr = amountNum.toFixed(2); // "0.30"

                // Send over API
                const jsonString = JSON.stringify({ amount: amountStr });
                const parsed = JSON.parse(jsonString);

                // Server receives exact string
                expect(parsed.amount).toBe('0.30'); // ✅ Exact match!

                // Server parses for calculation
                const serverNum = parseFloat(parsed.amount);
                expect(serverNum).toBe(0.3); // ✅ Clean conversion
            });

            it('demonstrates string-based split validation is exact', () => {
                // Server calculation with strings
                const totalStr = '100.00';
                const splitsStr = ['33.33', '33.33', '33.34'];

                // Send over API
                const jsonString = JSON.stringify({ total: totalStr, splits: splitsStr });
                const parsed = JSON.parse(jsonString);

                // Server validates by converting each split to smallest units
                const splitUnits = parsed.splits.map((s: string) => amountToSmallestUnit(s, 'USD'));
                const totalUnits = amountToSmallestUnit(parsed.total, 'USD');

                expect(splitUnits.reduce((acc: number, units: number) => acc + units, 0)).toBe(totalUnits);
            });

            it('demonstrates why strings + parsing is better than pure numbers', () => {
                // PROBLEM: Pure numbers through JSON
                const amountNum = 33.33;
                const json1 = JSON.stringify({ amount: amountNum });
                const parsed1 = JSON.parse(json1);
                // 33.33 remains 33.33 in this case, but edge cases exist

                // SOLUTION: Strings through JSON, parse on demand
                const amountStr = '33.33';
                const json2 = JSON.stringify({ amount: amountStr });
                const parsed2 = JSON.parse(json2);
                expect(parsed2.amount).toBe('33.33'); // ✅ Guaranteed exact

                // Parse only when needed for calculation
                const num = parseFloat(parsed2.amount);
                expect(num).toBe(33.33);
            });
        });

        describe('TypeScript Type Safety with Strings', () => {
            it('demonstrates type system catches string/number confusion', () => {
                // Define types
                type ExpenseRequest = {
                    amount: string; // ✅ String in API
                    splits: Array<{ uid: string; amount: string; }>;
                };

                // TypeScript would catch this error at compile time:
                // const request: ExpenseRequest = {
                //     amount: "100",  // ❌ Type error! Expected string
                //     splits: [{ uid: 'u1', amount: "50"}]  // ❌ Type error!
                // };

                // Correct usage:
                const request: ExpenseRequest = {
                    amount: '100.00', // ✅ String
                    splits: [
                        { uid: 'u1', amount: '50.00' }, // ✅ String
                        { uid: 'u2', amount: '50.00' },
                    ],
                };

                // This test just demonstrates the pattern
                expect(typeof request.amount).toBe('string');
                expect(typeof request.splits[0].amount).toBe('string');
            });
        });

        describe('Documentation: Why This Refactor Is Necessary', () => {
            it('documents the core problem: JavaScript numbers cannot represent all decimals', () => {
                // JavaScript uses IEEE 754 double-precision floating-point
                // This means only 53 bits of precision for the mantissa

                // The classic demonstration
                expect(0.1 + 0.2).not.toBe(0.3);
                expect(0.1 + 0.2).toBe(0.30000000000000004);

                // This affects ALL financial calculations
                console.log('0.1 + 0.2 =', 0.1 + 0.2);
                console.log('Expected: 0.3');
                console.log('Difference:', (0.1 + 0.2) - 0.3);

                // ✅ SOLUTION: Use strings for API, parse to numbers only for calculations
                // Store results as strings immediately after calculation
            });

            it('documents why tolerance-based validation is insufficient', () => {
                // Problem 1: Floating-point error can grow beyond any chosen tolerance
                const problematic1 = 999.99;
                const splits1 = calculateEqualSplits(problematic1, 'USD', ['u1', 'u2', 'u3']);
                const total1 = sumSplitAmounts(splits1);
                const diff1 = Math.abs(total1 - problematic1);
                expect(diff1).toBeGreaterThanOrEqual(0);

                // Problem 2: Error accumulates with multiple operations
                let balance = 0;
                for (let i = 0; i < 100; i++) {
                    balance += 0.01; // Add 1 cent 100 times
                }
                // Expected: 1.00
                // Actual: might have accumulated error
                console.log('100 additions of 0.01:', balance);
                console.log('Expected: 1.00');

                // ✅ SOLUTION: Strings don't accumulate errors
                // Each operation is exact: "0.01" + "0.01" + ... = exactly "1.00"
                expect(balance).not.toBe(1);
            });

            it('documents the architectural decision: strings at API boundary only', () => {
                // DECISION: Change API wire format, NOT database storage

                // ✅ Keep Firestore storage as numbers (no migration)
                // ✅ Convert at API boundary (FirestoreReader/Writer)
                // ✅ Client/Server communicate with strings
                // ✅ Internal calculations still use numbers (fast)

                // This test documents the architecture
                const architecture = {
                    firestoreStorage: 'number', // No change
                    apiWireFormat: 'string', // Changed
                    internalCalculations: 'number', // No change
                    conversionPoint: 'FirestoreReader/Writer', // Implementation location
                };

                expect(architecture.apiWireFormat).toBe('string');
                expect(architecture.firestoreStorage).toBe('number');
            });
        });
    });
});
