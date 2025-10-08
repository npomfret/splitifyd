import { getCurrency, getCurrencyDecimals } from '@splitifyd/shared';

/**
 * Count decimal places in a number
 * Matches backend implementation in firebase/functions/src/utils/amount-validation.ts
 */
function countDecimalPlaces(value: number): number {
    if (Math.floor(value) === value) return 0;
    const str = value.toString();
    if (str.indexOf('.') === -1) return 0;
    return str.split('.')[1].length;
}

/**
 * Validate that an amount has the correct precision for the currency
 * Matches backend implementation in firebase/functions/src/utils/amount-validation.ts
 * @throws Error if precision is invalid
 */
export function validateAmountPrecision(amount: number, currencyCode: string): void {
    const maxDecimals = getCurrencyDecimals(currencyCode);
    const actualDecimals = countDecimalPlaces(amount);

    if (actualDecimals > maxDecimals) {
        const currency = getCurrency(currencyCode);
        if (maxDecimals === 0) {
            throw new Error(`Amount must be a whole number for ${currencyCode} (${currency.name}). Received ${actualDecimals} decimal place(s).`);
        } else {
            throw new Error(`Amount must have at most ${maxDecimals} decimal place(s) for ${currencyCode} (${currency.name}). Received ${actualDecimals} decimal place(s).`);
        }
    }
}

/**
 * Validate amount precision and return formatted error message
 * Returns null if valid, error message if invalid
 */
export function getAmountPrecisionError(amount: number, currencyCode: string): string | null {
    try {
        validateAmountPrecision(amount, currencyCode);
        return null;
    } catch (error) {
        return (error as Error).message;
    }
}
