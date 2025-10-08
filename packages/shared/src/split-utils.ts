import { getCurrency } from './currencies';
import { ExpenseSplit } from './shared-types';

/**
 * Get the decimal precision for a currency
 * @param currencyCode - 3-letter ISO currency code (e.g., 'USD', 'JPY', 'BHD')
 * @returns Number of decimal places (0, 1, 2, or 3)
 */
export function getCurrencyDecimals(currencyCode: string): number {
    const currency = getCurrency(currencyCode);
    return currency.decimal_digits;
}

/**
 * Round an amount to the correct decimal precision for a currency
 * @param amount - The amount to round
 * @param currencyCode - 3-letter ISO currency code
 * @returns Amount rounded to currency precision
 *
 * @example
 * roundToCurrencyPrecision(33.333333, 'JPY') // 33 (0 decimals)
 * roundToCurrencyPrecision(33.333333, 'USD') // 33.33 (2 decimals)
 * roundToCurrencyPrecision(33.333333, 'BHD') // 33.333 (3 decimals)
 */
export function roundToCurrencyPrecision(amount: number, currencyCode: string): number {
    const decimals = getCurrencyDecimals(currencyCode);
    const multiplier = Math.pow(10, decimals);
    return Math.round(amount * multiplier) / multiplier;
}

/**
 * Calculate equal splits for an expense
 * Distributes amount evenly among participants, with any remainder going to the last participant
 *
 * @param totalAmount - Total expense amount
 * @param currencyCode - 3-letter ISO currency code
 * @param participantIds - Array of participant user IDs
 * @returns Array of ExpenseSplit objects with currency-aware amounts
 *
 * @example
 * // JPY 100 split 3 ways: [33, 33, 34] (last person gets remainder)
 * calculateEqualSplits(100, 'JPY', ['user1', 'user2', 'user3'])
 *
 * @example
 * // USD 100 split 3 ways: [33.33, 33.33, 33.34]
 * calculateEqualSplits(100, 'USD', ['user1', 'user2', 'user3'])
 */
export function calculateEqualSplits(totalAmount: number, currencyCode: string, participantIds: string[]): ExpenseSplit[] {
    if (participantIds.length === 0) {
        return [];
    }

    if (totalAmount <= 0) {
        return [];
    }

    // Calculate base split amount and round to currency precision
    const splitAmount = totalAmount / participantIds.length;
    const roundedAmount = roundToCurrencyPrecision(splitAmount, currencyCode);

    // Calculate total allocated so far
    const totalAllocated = roundedAmount * (participantIds.length - 1);

    // Last participant gets the remainder to ensure total adds up exactly
    const remainder = roundToCurrencyPrecision(totalAmount - totalAllocated, currencyCode);

    // Create splits: all but last get rounded amount, last gets remainder
    return participantIds.map((uid, index) => ({
        uid,
        amount: index === participantIds.length - 1 ? remainder : roundedAmount,
    }));
}

/**
 * Calculate initial exact splits for an expense
 * Used as starting point for manual "exact" split type - user can then adjust individual amounts
 *
 * @param totalAmount - Total expense amount
 * @param currencyCode - 3-letter ISO currency code
 * @param participantIds - Array of participant user IDs
 * @returns Array of ExpenseSplit objects with equal amounts as starting point
 */
export function calculateExactSplits(totalAmount: number, currencyCode: string, participantIds: string[]): ExpenseSplit[] {
    // For exact splits, use same logic as equal splits as a starting point
    // User will then manually adjust amounts
    return calculateEqualSplits(totalAmount, currencyCode, participantIds);
}

/**
 * Calculate initial percentage splits for an expense
 * Distributes 100% evenly among participants, with any remainder going to the last participant
 *
 * @param totalAmount - Total expense amount
 * @param currencyCode - 3-letter ISO currency code
 * @param participantIds - Array of participant user IDs
 * @returns Array of ExpenseSplit objects with percentage and calculated amounts
 *
 * @example
 * // 100% split 3 ways: [33.33%, 33.33%, 33.34%]
 * calculatePercentageSplits(100, 'USD', ['user1', 'user2', 'user3'])
 */
export function calculatePercentageSplits(totalAmount: number, currencyCode: string, participantIds: string[]): ExpenseSplit[] {
    if (participantIds.length === 0) {
        return [];
    }

    if (totalAmount <= 0) {
        return [];
    }

    // Calculate base percentage
    const basePercentage = 100 / participantIds.length;

    // Calculate amount for base percentage
    const baseAmount = (totalAmount * basePercentage) / 100;
    const roundedAmount = roundToCurrencyPrecision(baseAmount, currencyCode);

    // Calculate total allocated so far
    const totalAllocated = roundedAmount * (participantIds.length - 1);

    // Last participant gets remainder
    const remainder = roundToCurrencyPrecision(totalAmount - totalAllocated, currencyCode);

    // Last participant's percentage ensures total is exactly 100%
    const lastPercentage = 100 - basePercentage * (participantIds.length - 1);

    // Create splits
    return participantIds.map((uid, index) => {
        const isLast = index === participantIds.length - 1;
        return {
            uid,
            percentage: isLast ? lastPercentage : basePercentage,
            amount: isLast ? remainder : roundedAmount,
        };
    });
}
