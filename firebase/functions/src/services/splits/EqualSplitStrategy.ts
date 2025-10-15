import { Amount, ExpenseSplit, amountToSmallestUnit, compareAmounts, getCurrencyDecimals, normalizeAmount } from '@splitifyd/shared';
import { HTTP_STATUS } from '../../constants';
import { getCurrencyTolerance } from '../../utils/amount-validation';
import { ApiError } from '../../utils/errors';
import { ISplitStrategy } from './ISplitStrategy';

export class EqualSplitStrategy implements ISplitStrategy {
    validateSplits(totalAmount: Amount, participants: string[], splits: ExpenseSplit[], currencyCode: string): void {
        if (!Array.isArray(splits) || splits.length !== participants.length) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLITS', 'Splits must be provided for all participants');
        }

        // Validate that all splits have amounts
        for (const split of splits) {
            if (split.amount === undefined || split.amount === null) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_SPLIT_AMOUNT', 'Split amount is required');
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

        // Use currency-specific tolerance, fallback to 0.01 if currency not provided
        const tolerance = currencyCode ? getCurrencyTolerance(currencyCode) : 0.01;
        const decimals = currencyCode ? getCurrencyDecimals(currencyCode) : 2;
        const multiplier = Math.pow(10, decimals);
        const toleranceUnits = Math.round(tolerance * multiplier);

        if (Math.abs(splitUnits - totalUnits) > toleranceUnits) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount');
        }

        // Validate no duplicate users
        const splitUserIds = normalizedSplits.map((s: ExpenseSplit) => s.uid);
        const uniqueSplitUserIds = new Set(splitUserIds);
        if (splitUserIds.length !== uniqueSplitUserIds.size) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'DUPLICATE_SPLIT_USERS', 'Each participant can only appear once in splits');
        }

        // Validate all split users are participants
        const participantSet = new Set(participants);
        for (const userId of splitUserIds) {
            if (!participantSet.has(userId)) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_USER', 'Split user must be a participant');
            }
        }

        // Validate splits are actually equal (allowing for remainder distribution)
        // For equal splits, most amounts should be the same, with at most one person getting a larger share
        const amounts = normalizedSplits.map((s) => s.amount!);
        const uniqueAmounts = [...new Set(amounts)];

        // For equal splits, we should have at most 2 unique amounts (base amount and base + remainder)
        if (uniqueAmounts.length > 2) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EQUAL_SPLITS', 'For equal split type, all participants should have equal amounts');
        }

        // If there are 2 unique amounts, verify that only one person gets the larger amount
        if (uniqueAmounts.length === 2) {
            const [smallerAmount, largerAmount] = uniqueAmounts.sort((a, b) => compareAmounts(a, b, currencyCode));
            const diffUnits = Math.abs(
                amountToSmallestUnit(largerAmount, currencyCode) - amountToSmallestUnit(smallerAmount, currencyCode),
            );

            // Count how many people get the larger amount
            const largerCount = amounts.filter((a) => a === largerAmount).length;

            // Only one person should get the larger amount (the remainder)
            if (largerCount !== 1) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EQUAL_SPLITS', 'For equal split type, all participants should have equal amounts');
            }

            // The difference should be small (less than number of participants * tolerance)
            // This allows for rounding remainders to go to one person
            const maxDiffUnits = toleranceUnits * participants.length;
            if (diffUnits > maxDiffUnits) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_EQUAL_SPLITS', 'For equal split type, all participants should have equal amounts');
            }
        }
    }
}
