import { Amount, amountToSmallestUnit, CurrencyISOCode, ExpenseSplit, normalizeAmount, UserId } from '@billsplit-wl/shared';
import { ErrorDetail, Errors } from '../../errors';
import { ISplitStrategy } from './ISplitStrategy';

export class PercentageSplitStrategy implements ISplitStrategy {
    validateSplits(totalAmount: Amount, participants: UserId[], splits: ExpenseSplit[], currencyCode: CurrencyISOCode): void {
        if (!Array.isArray(splits) || splits.length !== participants.length) {
            throw Errors.validationError('splits', ErrorDetail.MISSING_FIELD);
        }

        // Validate that all splits have percentages
        for (const split of splits) {
            if (split.percentage === undefined || split.percentage === null) {
                throw Errors.validationError('percentage', ErrorDetail.MISSING_FIELD);
            }
            if (typeof split.percentage !== 'number' || Number.isNaN(split.percentage)) {
                throw Errors.validationError('percentage', ErrorDetail.INVALID_AMOUNT);
            }
            if (split.percentage < 0 || split.percentage > 100) {
                throw Errors.validationError('percentage', ErrorDetail.INVALID_AMOUNT);
            }
        }

        // Validate that percentages sum to 100 (within thousandths to account for rounding)
        const totalPercentage = splits.reduce((sum, split) => sum + split.percentage!, 0);
        const totalPercentageUnits = Math.round(totalPercentage * 1000);
        const expectedPercentageUnits = 100 * 1000;
        if (totalPercentageUnits !== expectedPercentageUnits) {
            throw Errors.validationError('splits', ErrorDetail.INVALID_PERCENTAGE_TOTAL);
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
            throw Errors.validationError('splits', ErrorDetail.INVALID_PERCENTAGE_TOTAL);
        }

        // Validate no duplicate users
        const splitUserIds = splits.map((s: ExpenseSplit) => s.uid);
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
    }
}
