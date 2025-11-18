import { Amount, amountToSmallestUnit, CurrencyISOCode, ExpenseSplit, normalizeAmount, UserId } from '@billsplit-wl/shared';
import { HTTP_STATUS } from '../../constants';
import { ApiError } from '../../utils/errors';
import { ISplitStrategy } from './ISplitStrategy';

export class PercentageSplitStrategy implements ISplitStrategy {
    validateSplits(totalAmount: Amount, participants: UserId[], splits: ExpenseSplit[], currencyCode: CurrencyISOCode): void {
        if (!Array.isArray(splits) || splits.length !== participants.length) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLITS', 'Splits must be provided for all participants');
        }

        // Validate that all splits have percentages
        for (const split of splits) {
            if (split.percentage === undefined || split.percentage === null) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_SPLIT_PERCENTAGE', 'Split percentage is required for percentage splits');
            }
            if (typeof split.percentage !== 'number' || Number.isNaN(split.percentage)) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_PERCENTAGE', 'Split percentage must be a valid number');
            }
            if (split.percentage < 0 || split.percentage > 100) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_PERCENTAGE', 'Split percentage must be between 0 and 100');
            }
        }

        // Validate that percentages sum to 100 (within thousandths to account for rounding)
        const totalPercentage = splits.reduce((sum, split) => sum + split.percentage!, 0);
        const totalPercentageUnits = Math.round(totalPercentage * 1000);
        const expectedPercentageUnits = 100 * 1000;
        if (totalPercentageUnits !== expectedPercentageUnits) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PERCENTAGE_TOTAL', 'Percentages must add up to 100');
        }

        // Validate that monetary amounts represented by the percentages cover the full total
        const normalizedTotal = normalizeAmount(totalAmount, currencyCode);
        const totalUnits = amountToSmallestUnit(normalizedTotal, currencyCode);
        const normalizedSplits = splits.map((split) => ({
            ...split,
            amount: normalizeAmount(split.amount, currencyCode),
        }));
        const splitUnits = normalizedSplits.reduce((sum, split) => sum + amountToSmallestUnit(split.amount, currencyCode), 0);
        if (splitUnits !== totalUnits) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PERCENTAGE_TOTAL', 'Percentages must add up to 100');
        }

        // Validate no duplicate users
        const splitUserIds = splits.map((s: ExpenseSplit) => s.uid);
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
