import { toCurrencyISOCode, toUserId, USD } from '@billsplit-wl/shared';
import { ExpenseSplitBuilder } from '@billsplit-wl/test-support';
import { describe, expect, it } from 'vitest';
import { ExactSplitStrategy } from '../../../../services/splits/ExactSplitStrategy';
import { ErrorCode } from '../../../../errors';

describe('ExactSplitStrategy', () => {
    const strategy = new ExactSplitStrategy();

    const userId1 = toUserId('user1');
    const userId2 = toUserId('user2');
    const userId3 = toUserId('user3');
    const userId4 = toUserId('user4');

    describe('validateSplits', () => {
        const participants = [userId1, userId2, userId3];

        it('should validate correct exact splits', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '30')
                .withSplit(userId2, '40')
                .withSplit(userId3, '30')
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should throw error if splits are not provided', () => {
            expect(() => strategy.validateSplits('100', participants, undefined as any, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should throw error if splits array is empty', () => {
            expect(() => strategy.validateSplits('100', participants, [], USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should throw error if split amounts do not sum to total amount', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '30')
                .withSplit(userId2, '40')
                .withSplit(userId3, '20') // Total = 90, not 100
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should throw error if split amounts exceed total amount', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '30')
                .withSplit(userId2, '40')
                .withSplit(userId3, '40') // Total = 110, not 100
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should allow remainder distribution that still sums exactly to the total', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '33.33')
                .withSplit(userId2, '33.33')
                .withSplit(userId3, '33.34') // Total = 100.00 exactly
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should reject splits that leave part of the total unassigned', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '33.33')
                .withSplit(userId2, '33.33')
                .withSplit(userId3, '33.32') // Total = 99.98 (missing remainder)
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should throw error if split amount is null', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '50')
                .withInvalidAmountSplit('user2', null)
                .withSplit(userId3, '50')
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should throw error if split amount is undefined', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '50')
                .withInvalidAmountSplit('user2', undefined)
                .withSplit(userId3, '50')
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should allow negative amounts if they sum correctly', () => {
            // Edge case: refunds or corrections could result in negative splits
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '120')
                .withSplit(userId2, '-10')
                .withSplit(userId3, '-10') // Total = 100
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should allow zero amounts if they sum correctly', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '100')
                .withSplit(userId2, '0')
                .withSplit(userId3, '0') // Total = 100
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).not.toThrow();
        });

        it('should handle single participant', () => {
            const singleParticipant = [userId1];
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '50')
                .build();
            expect(() => strategy.validateSplits('50', singleParticipant, splits, USD)).not.toThrow();
        });

        it('should throw error if wrong number of splits provided', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '50')
                .withSplit(userId2, '50')
                // Missing user3
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should throw error if too many splits provided', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '25')
                .withSplit(userId2, '25')
                .withSplit(userId3, '25')
                .withSplit(userId4, '25') // Extra user not in participants
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should throw error if duplicate users in splits', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '30')
                .withSplit(userId1, '40') // Duplicate user1
                .withSplit(userId2, '30')
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should throw error if split user is not a participant', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '50')
                .withSplit(userId2, '25')
                .withSplit(userId4, '25') // user4 not in participants
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should handle large amounts correctly', () => {
            const largeParticipants = [userId1, userId2];
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '999999.99')
                .withSplit(userId2, '0.01')
                .build();
            expect(() => strategy.validateSplits('1000000', largeParticipants, splits, USD)).not.toThrow();
        });

        it('should handle very small amounts with proper rounding correctly', () => {
            const smallParticipants = [userId1, userId2];
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '0.01')
                .withSplit(userId2, '0.00')
                .build();
            expect(() => strategy.validateSplits('0.01', smallParticipants, splits, USD)).not.toThrow();
        });

        it('should handle zero total amount correctly', () => {
            const zeroParticipants = [userId1, userId2];
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '0')
                .withSplit(userId2, '0')
                .build();
            expect(() => strategy.validateSplits('0', zeroParticipants, splits, USD)).not.toThrow();
        });

        it('should handle floating point precision edge case (0.1 + 0.2)', () => {
            const precisionParticipants = [userId1, userId2, userId3];
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '0.1')
                .withSplit(userId2, '0.2')
                .withSplit(userId3, '0.0')
                .build();
            // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
            expect(() => strategy.validateSplits('0.3', precisionParticipants, splits, USD)).not.toThrow();
        });

        it('should handle currency with no decimal places (like JPY)', () => {
            const jpyParticipants = [userId1, userId2];
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '150')
                .withSplit(userId2, '100')
                .build();
            expect(() => strategy.validateSplits('250', jpyParticipants, splits, toCurrencyISOCode('JPY'))).not.toThrow();
        });

        it('should handle JPY currency edge cases with exact amounts', () => {
            const jpyParticipants = [userId1, userId2, userId3];

            // Test case where decimal amounts wouldn't make sense for JPY
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '334')
                .withSplit(userId2, '333')
                .withSplit(userId3, '333')
                .build();
            expect(() => strategy.validateSplits('1000', jpyParticipants, splits, toCurrencyISOCode('JPY'))).not.toThrow();
        });

        it('should handle other zero-decimal currencies (KRW, VND)', () => {
            // Korean Won example
            const krwParticipants = [userId1, userId2];
            const krwSplits = new ExpenseSplitBuilder()
                .withSplit(userId1, '15000')
                .withSplit(userId2, '10000')
                .build();
            expect(() => strategy.validateSplits('25000', krwParticipants, krwSplits, toCurrencyISOCode('KRW'))).not.toThrow();

            // Vietnamese Dong example
            const vndParticipants = [userId1, userId2, userId3];
            const vndSplits = new ExpenseSplitBuilder()
                .withSplit(userId1, '100000')
                .withSplit(userId2, '150000')
                .withSplit(userId3, '50000')
                .build();
            expect(() => strategy.validateSplits('300000', vndParticipants, vndSplits, toCurrencyISOCode('VND'))).not.toThrow();
        });

        it('should reject fractional amounts that would be invalid for zero-decimal currencies', () => {
            const jpyParticipants = [userId1, userId2];
            const fractionalSplits = new ExpenseSplitBuilder()
                .withSplit(userId1, '100.5')
                .withSplit(userId2, '99.5')
                .build();
            expect(() => strategy.validateSplits('200', jpyParticipants, fractionalSplits, toCurrencyISOCode('JPY'))).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });

        it('should reject splits that depend on fractional rounding for currency precision', () => {
            const splits = new ExpenseSplitBuilder()
                .withSplit(userId1, '33.333')
                .withSplit(userId2, '33.333')
                .withSplit(userId3, '33.333') // Total = 99.999, which is 0.001 off
                .build();
            expect(() => strategy.validateSplits('100', participants, splits, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );

            const splitsOutsideTolerance = new ExpenseSplitBuilder()
                .withSplit(userId1, '33.32')
                .withSplit(userId2, '33.32')
                .withSplit(userId3, '33.32') // Total = 99.96, which is 0.04 off
                .build();
            expect(() => strategy.validateSplits('100', participants, splitsOutsideTolerance, USD)).toThrow(
                expect.objectContaining({ code: ErrorCode.VALIDATION_ERROR })
            );
        });
    });
});
