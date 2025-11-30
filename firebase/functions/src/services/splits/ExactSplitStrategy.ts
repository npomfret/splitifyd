import { Amount, amountToSmallestUnit, CurrencyISOCode, ExpenseSplit, normalizeAmount, UserId } from '@billsplit-wl/shared';
import { ErrorDetail, Errors } from '../../errors';
import { ISplitStrategy } from './ISplitStrategy';

export class ExactSplitStrategy implements ISplitStrategy {
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
    }
}
