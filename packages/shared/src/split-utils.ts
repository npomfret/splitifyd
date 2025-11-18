import {Amount, CurrencyISOCode, ExpenseSplit, UserId} from './shared-types';


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
