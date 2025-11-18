import {CurrencyISOCode, getCurrency, getCurrencyDecimals } from '@billsplit-wl/shared';
import { Amount } from '@billsplit-wl/shared';

/**
 * Count decimal places in an amount without relying on floating-point math
 * Matches backend implementation in firebase/functions/src/utils/amount-validation.ts
 */
function countDecimalPlaces(value: Amount | number): number {
    const str = typeof value === 'number' ? value.toString() : value;
    const normalized = str.trim().replace(/^-/, '');
    const decimalIndex = normalized.indexOf('.');
    if (decimalIndex === -1) {
        return 0;
    }
    return normalized.length - decimalIndex - 1;
}

/**
 * Validate that an amount has the correct precision for the currency
 * Matches backend implementation in firebase/functions/src/utils/amount-validation.ts
 * @throws Error if precision is invalid
 */
function validateAmountPrecision(amount: Amount, currencyCode: CurrencyISOCode): void {
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
export function getAmountPrecisionError(amount: Amount, currencyCode: CurrencyISOCode): string | null {
    try {
        validateAmountPrecision(amount, currencyCode);
        return null;
    } catch (error) {
        return (error as Error).message;
    }
}
