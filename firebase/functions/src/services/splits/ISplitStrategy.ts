import { ExpenseSplit } from '@splitifyd/shared';

export interface ISplitStrategy {
    /**
     * Validates that the provided splits are valid for this split type
     * @param totalAmount The total expense amount
     * @param participants Array of participant user IDs
     * @param splits The splits to validate (always required - client calculates splits)
     * @param currencyCode Optional currency code for precision validation
     * @throws ApiError if validation fails
     */
    validateSplits(totalAmount: number, participants: string[], splits?: ExpenseSplit[], currencyCode?: string): void;
}
