import { getCurrency } from '@splitifyd/shared';
import * as Joi from 'joi';

/**
 * Get the maximum allowed decimal places for a currency
 */
export function getMaxDecimalPlaces(currencyCode: string): number {
    const currency = getCurrency(currencyCode);
    return currency.decimal_digits;
}

/**
 * Get the tolerance for amount comparisons based on currency precision
 * - 0 decimals: tolerance = 1 (e.g., JPY, KRW)
 * - 1 decimal: tolerance = 0.1 (e.g., MGA, MRU)
 * - 2 decimals: tolerance = 0.01 (e.g., USD, EUR)
 * - 3 decimals: tolerance = 0.001 (e.g., BHD, KWD)
 */
export function getCurrencyTolerance(currencyCode: string): number {
    const decimalPlaces = getMaxDecimalPlaces(currencyCode);
    return Math.pow(10, -decimalPlaces);
}

/**
 * Count decimal places in a number
 */
function countDecimalPlaces(value: number): number {
    if (Math.floor(value) === value) return 0;
    const str = value.toString();
    if (str.indexOf('.') === -1) return 0;
    return str.split('.')[1].length;
}

/**
 * Validate that an amount has the correct precision for the currency
 * @throws Error if precision is invalid
 */
export function validateAmountPrecision(amount: number, currencyCode: string): void {
    const maxDecimals = getMaxDecimalPlaces(currencyCode);
    const actualDecimals = countDecimalPlaces(amount);

    if (actualDecimals > maxDecimals) {
        const currency = getCurrency(currencyCode);
        if (maxDecimals === 0) {
            throw new Error(
                `Amount must be a whole number for ${currencyCode} (${currency.name}). Received ${actualDecimals} decimal place(s).`,
            );
        } else {
            throw new Error(
                `Amount must have at most ${maxDecimals} decimal place(s) for ${currencyCode} (${currency.name}). Received ${actualDecimals} decimal place(s).`,
            );
        }
    }
}

/**
 * Create a Joi schema for currency-aware amount validation
 * @param currencyField - Optional field name that contains the currency code (for validation that depends on another field)
 */
export function createJoiAmountSchema(currencyField?: string): Joi.NumberSchema {
    let schema = Joi.number().positive().max(999999.99);

    if (currencyField) {
        // Add custom validation that checks precision based on the currency field
        schema = schema.custom((value, helpers) => {
            const currency = helpers.state.ancestors[0][currencyField];
            if (currency) {
                try {
                    validateAmountPrecision(value, currency);
                } catch (error) {
                    return helpers.error('number.precision', { message: (error as Error).message });
                }
            }
            return value;
        });
    }

    return schema;
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
