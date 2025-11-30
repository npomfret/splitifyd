import { Amount, amountToSmallestUnit, compareAmounts, CurrencyISOCode, ExpenseSplit, normalizeAmount, UserId } from '@billsplit-wl/shared';
import { ErrorDetail, Errors } from '../../errors';
import { ISplitStrategy } from './ISplitStrategy';

export class EqualSplitStrategy implements ISplitStrategy {
    validateSplits(totalAmount: Amount, participants: UserId[], splits: ExpenseSplit[], currencyCode: CurrencyISOCode): void {
        if (!Array.isArray(splits) || splits.length !== participants.length) {
            throw Errors.validationError('splits', ErrorDetail.MISSING_FIELD);
        }

        // Validate that all splits have amounts
        for (const split of splits) {
            if (split.amount === undefined || split.amount === null) {
                throw Errors.validationError('amount', ErrorDetail.MISSING_FIELD);
            }
        }

        // Normalize all amounts to currency precision
        const normalizedTotal = normalizeAmount(totalAmount, currencyCode);
        const normalizedSplits = splits.map((split) => ({
            ...split,
            amount: normalizeAmount(split.amount, currencyCode),
        }));

        // Validate that split amounts sum to total amount
        const totalUnits = amountToSmallestUnit(normalizedTotal, currencyCode);
        const splitUnits = normalizedSplits.reduce((sum, split) => sum + amountToSmallestUnit(split.amount, currencyCode), 0);

        if (splitUnits !== totalUnits) {
            throw Errors.validationError('splits', ErrorDetail.INVALID_SPLIT_TOTAL);
        }

        // Validate no duplicate users
        const splitUserIds = normalizedSplits.map((s: ExpenseSplit) => s.uid);
        const uniqueSplitUserIds = new Set(splitUserIds);
        if (splitUserIds.length !== uniqueSplitUserIds.size) {
            throw Errors.validationError('splits', ErrorDetail.DUPLICATE_SPLIT_USERS);
        }

        // Validate all split users are participants
        const participantSet = new Set(participants);
        for (const userId of splitUserIds) {
            if (!participantSet.has(userId)) {
                throw Errors.validationError('splits', ErrorDetail.INVALID_PARTICIPANT);
            }
        }

        // Validate splits are actually equal (allowing for remainder distribution)
        // For equal splits, most amounts should be the same, with at most one person getting a larger share
        const amounts = normalizedSplits.map((s) => s.amount!);
        const uniqueAmounts = [...new Set(amounts)];

        // For equal splits, we should have at most 2 unique amounts (base amount and base + remainder)
        if (uniqueAmounts.length > 2) {
            throw Errors.validationError('splits', ErrorDetail.INVALID_SPLIT_TOTAL);
        }

        const participantCount = participants.length;
        const remainderUnits = participantCount === 0 ? 0 : totalUnits % participantCount;

        if (remainderUnits === 0) {
            if (uniqueAmounts.length !== 1) {
                throw Errors.validationError('splits', ErrorDetail.INVALID_SPLIT_TOTAL);
            }
            return;
        }

        // If there are 2 unique amounts, verify that only one person gets the larger amount
        if (uniqueAmounts.length === 2) {
            const [smallerAmount, largerAmount] = uniqueAmounts.sort((a, b) => compareAmounts(a, b, currencyCode));
            const diffUnits = Math.abs(
                amountToSmallestUnit(largerAmount, currencyCode) - amountToSmallestUnit(smallerAmount, currencyCode),
            );

            if (diffUnits === 0) {
                throw Errors.validationError('splits', ErrorDetail.INVALID_SPLIT_TOTAL);
            }

            // Count how many people get the larger amount
            const largerCount = amounts.filter((a) => a === largerAmount).length;

            if (largerCount === 0) {
                throw Errors.validationError('splits', ErrorDetail.INVALID_SPLIT_TOTAL);
            }

            // The extra units distributed must exactly match the remainder produced by integer division
            if (largerCount * diffUnits !== remainderUnits) {
                throw Errors.validationError('splits', ErrorDetail.INVALID_SPLIT_TOTAL);
            }
        }
    }
}
