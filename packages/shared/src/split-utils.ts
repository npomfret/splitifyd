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
 * Parse a monetary amount (string or number) to a number for calculation.
 *
 * This function provides backward compatibility during the string migration:
 * - Accepts both string and number inputs
 * - Validates string format for decimal numbers
 * - Returns normalized number for calculations
 *
 * @param amount - Amount as string (e.g., "123.45") or number
 * @returns Parsed number for calculations
 * @throws Error if string format is invalid
 *
 * @example
 * parseMonetaryAmount("123.45") // 123.45
 * parseMonetaryAmount(123.45)   // 123.45 (backward compatible)
 * parseMonetaryAmount("invalid") // throws Error
 */
export function parseMonetaryAmount(amount: string | number): number {
    // Backward compatibility: if already a number, return it
    if (typeof amount === 'number') {
        if (!isFinite(amount)) {
            throw new Error(`Amount is not finite: ${amount}`);
        }
        return amount;
    }

    // String validation and parsing
    if (typeof amount !== 'string') {
        throw new Error('Amount must be a string or number');
    }

    const trimmed = amount.trim();
    if (trimmed === '') {
        throw new Error('Amount cannot be empty');
    }

    // Validate format: optional minus, digits, optional decimal point, optional digits
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
        throw new Error(`Invalid monetary amount format: "${amount}"`);
    }

    const num = Number(trimmed);
    if (!isFinite(num)) {
        throw new Error(`Amount is not finite: "${amount}"`);
    }

    return num;
}

/**
 * Format a number to a string for API transmission.
 * Uses fixed decimal places based on currency to ensure exact representation.
 *
 * @param amount - Numeric amount to format
 * @param currencyCode - 3-letter ISO currency code
 * @returns Formatted string with correct decimal places
 *
 * @example
 * formatMonetaryAmount(123.456, 'USD') // "123.46" (2 decimals)
 * formatMonetaryAmount(123.456, 'JPY') // "123" (0 decimals)
 * formatMonetaryAmount(123.456, 'BHD') // "123.456" (3 decimals)
 */
export function formatMonetaryAmount(amount: number, currencyCode: string): string {
    const decimals = getCurrencyDecimals(currencyCode);
    return amount.toFixed(decimals);
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

    const decimals = getCurrencyDecimals(currencyCode);
    const multiplier = Math.pow(10, decimals);

    // Convert to smallest currency unit (integer arithmetic to avoid floating point errors)
    const totalUnits = Math.round(totalAmount * multiplier);
    const numParticipants = participantIds.length;

    // Calculate base split in smallest units (integer division)
    const baseUnits = Math.floor(totalUnits / numParticipants);

    // Calculate splits: all but last get base amount
    const splits: ExpenseSplit[] = participantIds.map((uid, index) => ({
        uid,
        amount: baseUnits / multiplier,
    }));

    // Calculate the last split as total - sum of others to ensure perfect precision
    // This accounts for any floating point errors in the division
    const sumOfOthers = splits.slice(0, -1).reduce((sum, split) => sum + split.amount, 0);
    splits[splits.length - 1].amount = roundToCurrencyPrecision(totalAmount - sumOfOthers, currencyCode);

    return splits;
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

    const decimals = getCurrencyDecimals(currencyCode);
    const multiplier = Math.pow(10, decimals);

    // Convert to smallest currency unit (integer arithmetic to avoid floating point errors)
    const totalUnits = Math.round(totalAmount * multiplier);
    const numParticipants = participantIds.length;

    // Calculate base percentage
    const basePercentage = 100 / numParticipants;

    // Calculate base split in smallest units (integer division)
    const baseUnits = Math.floor(totalUnits / numParticipants);

    // Calculate splits: all but last get base percentage and amount
    const splits: ExpenseSplit[] = participantIds.map((uid) => ({
        uid,
        percentage: basePercentage,
        amount: baseUnits / multiplier,
    }));

    // Calculate the last split's amount as total - sum of others to ensure perfect precision
    const sumOfOthers = splits.slice(0, -1).reduce((sum, split) => sum + split.amount, 0);
    splits[splits.length - 1].amount = roundToCurrencyPrecision(totalAmount - sumOfOthers, currencyCode);

    // Adjust last participant's percentage to ensure total is exactly 100%
    splits[splits.length - 1].percentage = 100 - basePercentage * (numParticipants - 1);

    return splits;
}
