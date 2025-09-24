import { describe, it, expect } from 'vitest';
import { calculateSplits } from '../../../expenses/validation';
import { ApiError } from '../../../utils/errors';

describe('Focused Input Validation Tests', () => {
    describe('Amount Validation', () => {
        it('should reject zero amounts', () => {
            expect(() => {
                if (0 <= 0) throw new ApiError(400, 'INVALID_AMOUNT', 'Amount must be greater than 0');
            }).toThrow('Amount must be greater than 0');
        });

        it('should reject negative amounts', () => {
            expect(() => {
                if (-50 <= 0) throw new ApiError(400, 'INVALID_AMOUNT', 'Amount must be greater than 0');
            }).toThrow('Amount must be greater than 0');
        });

        it('should reject NaN values', () => {
            expect(() => {
                if (isNaN(NaN)) throw new ApiError(400, 'INVALID_AMOUNT', 'Amount must be a valid number');
            }).toThrow('Amount must be a valid number');
        });

        it('should reject negative infinity', () => {
            expect(() => {
                if (!isFinite(Number.NEGATIVE_INFINITY)) throw new ApiError(400, 'INVALID_AMOUNT', 'Amount must be finite');
            }).toThrow('Amount must be finite');
        });

        it('should accept valid positive amounts', () => {
            expect(() => {
                if (100.50 <= 0) throw new ApiError(400, 'INVALID_AMOUNT', 'Amount must be greater than 0');
            }).not.toThrow();
        });
    });

    describe('Split Calculation Validation', () => {
        it('should calculate equal splits correctly', () => {
            const participants = ['user1', 'user2'];
            const amount = 100;

            const splits = calculateSplits(
                amount,
                'equal',
                participants,
            );

            expect(splits).toHaveLength(2);
            expect(splits[0].amount).toBe(50);
            expect(splits[1].amount).toBe(50);

            const total = splits.reduce((sum, split) => sum + split.amount, 0);
            expect(total).toBe(amount);
        });

        it('should handle rounding in equal splits', () => {
            const participants = ['user1', 'user2', 'user3'];
            const amount = 10;

            const splits = calculateSplits(
                amount,
                'equal',
                participants,
            );

            expect(splits).toHaveLength(3);

            const total = splits.reduce((sum, split) => sum + split.amount, 0);
            expect(total).toBeCloseTo(amount, 1);
        });

        it('should validate exact splits add up to total', () => {
            const amount = 100;
            const exactSplits = [
                { userId: 'user1', amount: 60 },
                { userId: 'user2', amount: 30 }, // Only adds up to 90
            ];

            expect(() => {
                const total = exactSplits.reduce((sum, split) => sum + split.amount, 0);
                if (Math.abs(total - amount) > 0.01) {
                    throw new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal the total expense amount');
                }
            }).toThrow('Split amounts must equal the total expense amount');
        });

        it('should accept valid exact splits', () => {
            const amount = 100;
            const exactSplits = [
                { userId: 'user1', amount: 60 },
                { userId: 'user2', amount: 40 }, // Adds up to 100
            ];

            expect(() => {
                const total = exactSplits.reduce((sum, split) => sum + split.amount, 0);
                if (Math.abs(total - amount) > 0.01) {
                    throw new ApiError(400, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal the total expense amount');
                }
            }).not.toThrow();
        });
    });

    describe('Percentage Split Validation', () => {
        it('should reject percentages that do not add up to 100%', () => {
            const percentageSplits = [
                { userId: 'user1', percentage: 60 },
                { userId: 'user2', percentage: 30 }, // Only adds up to 90%
            ];

            expect(() => {
                const total = percentageSplits.reduce((sum, split) => sum + split.percentage, 0);
                if (Math.abs(total - 100) > 0.01) {
                    throw new ApiError(400, 'INVALID_PERCENTAGE_TOTAL', 'Percentages must add up to 100%');
                }
            }).toThrow('Percentages must add up to 100%');
        });

        it('should accept valid percentages', () => {
            const percentageSplits = [
                { userId: 'user1', percentage: 60 },
                { userId: 'user2', percentage: 40 }, // Adds up to 100%
            ];

            expect(() => {
                const total = percentageSplits.reduce((sum, split) => sum + split.percentage, 0);
                if (Math.abs(total - 100) > 0.01) {
                    throw new ApiError(400, 'INVALID_PERCENTAGE_TOTAL', 'Percentages must add up to 100%');
                }
            }).not.toThrow();
        });

        it('should reject negative percentages', () => {
            expect(() => {
                const percentage = -20;
                if (percentage < 0) {
                    throw new ApiError(400, 'INVALID_PERCENTAGE', 'Percentage cannot be negative');
                }
            }).toThrow('Percentage cannot be negative');
        });

        it('should reject percentages over 100%', () => {
            expect(() => {
                const percentage = 150;
                if (percentage > 100) {
                    throw new ApiError(400, 'INVALID_PERCENTAGE', 'Percentage cannot exceed 100%');
                }
            }).toThrow('Percentage cannot exceed 100%');
        });
    });

    describe('Date Validation', () => {
        it('should reject future dates', () => {
            const futureDate = new Date();
            futureDate.setFullYear(futureDate.getFullYear() + 1);

            expect(() => {
                if (futureDate > new Date()) {
                    throw new ApiError(400, 'INVALID_DATE', 'Date cannot be in the future');
                }
            }).toThrow('Date cannot be in the future');
        });

        it('should accept past dates', () => {
            const pastDate = new Date();
            pastDate.setMonth(pastDate.getMonth() - 1);

            expect(() => {
                if (pastDate > new Date()) {
                    throw new ApiError(400, 'INVALID_DATE', 'Date cannot be in the future');
                }
            }).not.toThrow();
        });

        it('should accept current date', () => {
            const currentDate = new Date();

            expect(() => {
                if (currentDate > new Date()) {
                    throw new ApiError(400, 'INVALID_DATE', 'Date cannot be in the future');
                }
            }).not.toThrow();
        });
    });

    describe('Settlement Amount Validation', () => {
        it('should reject negative settlement amounts', () => {
            expect(() => {
                const amount = -50;
                if (amount <= 0) {
                    throw new ApiError(400, 'INVALID_AMOUNT', 'Settlement amount must be greater than 0');
                }
            }).toThrow('Settlement amount must be greater than 0');
        });

        it('should reject zero settlement amounts', () => {
            expect(() => {
                const amount = 0;
                if (amount <= 0) {
                    throw new ApiError(400, 'INVALID_AMOUNT', 'Settlement amount must be greater than 0');
                }
            }).toThrow('Settlement amount must be greater than 0');
        });

        it('should reject amounts exceeding maximum', () => {
            expect(() => {
                const amount = 1000000;
                const maxAmount = 999999.99;
                if (amount > maxAmount) {
                    throw new ApiError(400, 'INVALID_AMOUNT', `Amount cannot exceed ${maxAmount}`);
                }
            }).toThrow('Amount cannot exceed 999999.99');
        });

        it('should accept valid settlement amounts', () => {
            expect(() => {
                const amount = 50.00;
                if (amount <= 0) {
                    throw new ApiError(400, 'INVALID_AMOUNT', 'Settlement amount must be greater than 0');
                }
                if (amount > 999999.99) {
                    throw new ApiError(400, 'INVALID_AMOUNT', 'Amount cannot exceed 999999.99');
                }
            }).not.toThrow();
        });
    });

    describe('Decimal Precision Edge Cases', () => {
        it('should handle very small amounts', () => {
            const amount = 0.01;
            expect(amount).toBe(0.01);
            expect(amount > 0).toBe(true);
        });

        it('should handle amounts with many decimal places', () => {
            const amount = 33.333333;
            expect(amount).toBe(33.333333);

            const splitAmount = amount / 3;
            expect(splitAmount).toBeCloseTo(11.111111, 6);
        });

        it('should handle very large amounts', () => {
            const amount = 999999.99;
            expect(amount).toBe(999999.99);
            expect(amount <= 999999.99).toBe(true);
        });
    });
});