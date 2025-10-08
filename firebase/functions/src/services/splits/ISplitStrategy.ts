import { ExpenseSplit } from '@splitifyd/shared';

export interface ISplitStrategy {
    /**
     * Validates that the provided splits are valid for this split type
     * @param totalAmount The total expense amount
     * @param participants Array of participant user IDs
     * @param splits The splits to validate (may be undefined for EQUAL type)
     * @param currencyCode Optional currency code for precision validation
     * @throws ApiError if validation fails
     */
    validateSplits(totalAmount: number, participants: string[], splits?: ExpenseSplit[], currencyCode?: string): void;

    /**
     * Calculates the final split amounts for all participants
     * @param totalAmount The total expense amount
     * @param participants Array of participant user IDs
     * @param splits The splits data (may be undefined for EQUAL type)
     * @returns Array of ExpenseSplit with calculated amounts
     */
    calculateSplits(totalAmount: number, participants: string[], splits?: ExpenseSplit[]): ExpenseSplit[];

    /**
     * Returns whether this split type requires explicit splits data
     */
    requiresSplitsData(): boolean;
}
