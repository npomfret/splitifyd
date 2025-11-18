import { Amount, amountToSmallestUnit, ExpenseSplit, normalizeAmount } from '@billsplit-wl/shared';
import { HTTP_STATUS } from '../../constants';
import { ApiError } from '../../utils/errors';
import { ISplitStrategy } from './ISplitStrategy';

export class ExactSplitStrategy implements ISplitStrategy {
    validateSplits(totalAmount: Amount, participants: string[], splits: ExpenseSplit[], currencyCode: string): void {
        if (!Array.isArray(splits) || splits.length !== participants.length) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLITS', 'Splits must be provided for all participants');
        }

        // Validate that all splits have amounts
        for (const split of splits) {
            if (split.amount === undefined || split.amount === null) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_SPLIT_AMOUNT', 'Split amount is required for exact splits');
            }
        }

        const normalizedTotal = normalizeAmount(totalAmount, currencyCode);
        const normalizedSplits = splits.map((split) => ({
            ...split,
            amount: normalizeAmount(split.amount, currencyCode),
        }));

        // Validate that split amounts sum to total amount
        const totalUnits = amountToSmallestUnit(normalizedTotal, currencyCode);
        const splitUnits = normalizedSplits.reduce(
            (sum, split) => sum + amountToSmallestUnit(split.amount, currencyCode),
            0,
        );

        if (splitUnits !== totalUnits) {
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
    }
}
