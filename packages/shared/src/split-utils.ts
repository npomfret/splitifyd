import { getCurrency } from './currencies';
import {Amount, ExpenseSplit} from './shared-types';

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
export function formatMonetaryAmount(amount: Amount, currencyCode: string): string {
    return roundToCurrencyPrecision(amount, currencyCode);
}

/**
 * Round an amount to the correct decimal precision for a currency
 * @param amount - The amount to round
 * @param currencyCode - 3-letter ISO currency code
 * @returns Amount rounded to currency precision as a string
 *
 * @example
 * roundToCurrencyPrecision(33.333333, 'JPY') // "33" (0 decimals)
 * roundToCurrencyPrecision(33.333333, 'USD') // "33.33" (2 decimals)
 * roundToCurrencyPrecision(33.333333, 'BHD') // "33.333" (3 decimals)
 */
export function roundToCurrencyPrecision(amount: Amount | number, currencyCode: string): string {
    const numericAmount = parseMonetaryAmount(amount);
    const decimals = getCurrencyDecimals(currencyCode);
    const multiplier = Math.pow(10, decimals);
    const rounded = Math.round(numericAmount * multiplier) / multiplier;
    return rounded.toFixed(decimals);
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
export function calculateEqualSplits(totalAmount: Amount | number, currencyCode: string, participantIds: string[]): ExpenseSplit[] {
    if (participantIds.length === 0) {
        return [];
    }

    const totalAmountNumber = parseMonetaryAmount(totalAmount);
    if (totalAmountNumber <= 0) {
        return [];
    }

    // Normalize to string with correct precision before converting to smallest units
    const normalizedTotal = roundToCurrencyPrecision(totalAmount, currencyCode);

    // Convert to smallest currency unit (integer arithmetic to avoid floating point errors)
    const totalUnits = amountToSmallestUnit(normalizedTotal, currencyCode);
    const numParticipants = participantIds.length;

    // Calculate base split in smallest units (integer division)
    const baseUnits = Math.floor(totalUnits / numParticipants);
    const totalUnitsAllocatedToBase = baseUnits * (numParticipants - 1);

    // Calculate splits: all but last get base amount
    const splits: ExpenseSplit[] = participantIds.map((uid, index) => {
        const isLastParticipant = index === numParticipants - 1;
        const amountUnits = isLastParticipant ? totalUnits - totalUnitsAllocatedToBase : baseUnits;
        return {
            uid,
            amount: smallestUnitToAmountString(amountUnits, currencyCode),
        };
    });

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
export function calculateExactSplits(totalAmount: Amount | number, currencyCode: string, participantIds: string[]): ExpenseSplit[] {
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
export function calculatePercentageSplits(totalAmount: Amount | number, currencyCode: string, participantIds: string[]): ExpenseSplit[] {
    if (participantIds.length === 0) {
        return [];
    }

    const totalAmountNumber = parseMonetaryAmount(totalAmount);
    if (totalAmountNumber <= 0) {
        return [];
    }

    // Normalize to string with correct precision before converting to smallest units
    const normalizedTotal = roundToCurrencyPrecision(totalAmount, currencyCode);

    // Convert to smallest currency unit (integer arithmetic to avoid floating point errors)
    const totalUnits = amountToSmallestUnit(normalizedTotal, currencyCode);
    const numParticipants = participantIds.length;

    // Calculate base percentage
    const basePercentage = 100 / numParticipants;

    // Calculate base split in smallest units (integer division)
    const baseUnits = Math.floor(totalUnits / numParticipants);

    // Calculate splits: all but last get base percentage and amount
    const splits: ExpenseSplit[] = participantIds.map((uid, index) => {
        const isLastParticipant = index === numParticipants - 1;
        const amountUnits = isLastParticipant ? totalUnits - baseUnits * (numParticipants - 1) : baseUnits;
        const percentage = isLastParticipant ? 100 - basePercentage * (numParticipants - 1) : basePercentage;
        return {
            uid,
            percentage,
            amount: smallestUnitToAmountString(amountUnits, currencyCode),
        };
    });

    return splits;
}

/**
 * Parses a string monetary amount into its smallest currency unit (e.g., cents) as an integer.
 * This is the recommended way to convert amounts for calculation to avoid floating-point errors.
 * @param amountStr The amount as a string (e.g., "50.25").
 * @param currencyCode The 3-letter ISO currency code.
 * @returns The amount in the smallest integer unit (e.g., 5025 for "50.25" USD).
 */
export function amountToSmallestUnit(amountStr: string, currencyCode: string): number {
    // Use existing parser for basic validation (is it a number-like string?)
    parseMonetaryAmount(amountStr);

    const allowedDecimals = getCurrencyDecimals(currencyCode);

    if (amountStr.includes('.')) {
        const fractionalPart = amountStr.split('.')[1];
        if (fractionalPart.length > allowedDecimals) {
            throw new Error(`Amount "${amountStr}" has too many decimal places for currency ${currencyCode}. Maximum allowed is ${allowedDecimals}.`);
        }
    }

    // If validation passes, proceed with the conversion.
    const asNumber = parseMonetaryAmount(amountStr);
    const multiplier = Math.pow(10, allowedDecimals);
    // Final Math.round is a safeguard against floating point representation issues (e.g., 123.45 * 100 = 12344.999...)
    return Math.round(asNumber * multiplier);
}

/**
 * Converts an amount from its smallest currency unit (e.g., cents) back to a standard string representation.
 * @param amountInSmallestUnit The amount as an integer (e.g., 5025 for USD).
 * @param currencyCode The 3-letter ISO currency code.
 * @returns A string representation of the amount, formatted to the currency's decimal places (e.g., "50.25").
 */
export function smallestUnitToAmountString(amountInSmallestUnit: number, currencyCode: string): string {
    const decimals = getCurrencyDecimals(currencyCode);
    if (decimals === 0) {
        return String(amountInSmallestUnit);
    }
    const divisor = Math.pow(10, decimals);
    const amount = amountInSmallestUnit / divisor;
    return amount.toFixed(decimals);
}
