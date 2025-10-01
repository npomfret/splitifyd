import { ExpenseSplit } from '@splitifyd/shared';
import { ApiError } from '../../utils/errors';
import { HTTP_STATUS } from '../../constants';
import { ISplitStrategy } from './ISplitStrategy';

export class ExactSplitStrategy implements ISplitStrategy {

    requiresSplitsData(): boolean {
        return true;
    }

    validateSplits(totalAmount: number, participants: string[], splits?: ExpenseSplit[]): void {
        if (!Array.isArray(splits) || splits.length !== participants.length) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLITS', 'Splits must be provided for all participants');
        }

        // Validate that all splits have amounts
        for (const split of splits) {
            if (split.amount === undefined || split.amount === null) {
                throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'MISSING_SPLIT_AMOUNT', 'Split amount is required for exact splits');
            }
        }

        // Validate that split amounts sum to total amount
        const totalSplit = splits.reduce((sum: number, split: ExpenseSplit) => {
            return sum + split.amount!;
        }, 0);

        if (Math.abs(totalSplit - totalAmount) > 0.01) {
            throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_SPLIT_TOTAL', 'Split amounts must equal total amount');
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

    calculateSplits(totalAmount: number, participants: string[], splits?: ExpenseSplit[]): ExpenseSplit[] {
        if (!splits) {
            throw new Error('Splits are required for exact split type');
        }

        // For exact splits, we just return the provided splits as they already contain the exact amounts
        return splits.map((split) => {
            const result: ExpenseSplit = {
                uid: split.uid,
                amount: split.amount!,
            };

            // Only include percentage if it's actually defined (not undefined)
            if (split.percentage !== undefined) {
                result.percentage = split.percentage;
            }

            return result;
        });
    }
}
