import { getCurrency, parseMonetaryAmount } from '@splitifyd/shared';
import * as Joi from 'joi';

/**
 * Get the maximum allowed decimal places for a currency
 */
function getMaxDecimalPlaces(currencyCode: string): number {
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
            throw new Error(`Amount must be a whole number for ${currencyCode} (${currency.name}). Received ${actualDecimals} decimal place(s).`);
        } else {
            throw new Error(`Amount must have at most ${maxDecimals} decimal place(s) for ${currencyCode} (${currency.name}). Received ${actualDecimals} decimal place(s).`);
        }
    }
}

/**
 * Create a Joi schema for currency-aware amount validation.
 * Accepts both numbers and strings for backward compatibility during migration.
 *
 * @param currencyField - Optional field name that contains the currency code (for validation that depends on another field)
 * @returns Joi alternatives schema that accepts both number and string amounts
 */
export function createJoiAmountSchema(currencyField?: string): Joi.AlternativesSchema {
    const baseSchema = Joi.alternatives()
        .try(
            // Option 1: Accept numbers (backward compatible)
            Joi.number().positive().max(999999.99),
            // Option 2: Accept strings in decimal format
            Joi.string().pattern(/^-?\d+(\.\d+)?$/, 'decimal number'),
        )
        .custom((value, helpers) => {
            try {
                // Parse to number using shared utility (handles both types)
                const numValue = parseMonetaryAmount(value);

                // Validate range
                if (numValue <= 0) {
                    return helpers.error('number.positive');
                }
                if (numValue > 999999.99) {
                    return helpers.error('number.max');
                }

                // Validate precision if currency field is available
                if (currencyField) {
                    const currency = helpers.state.ancestors[0][currencyField];
                    if (currency) {
                        try {
                            validateAmountPrecision(numValue, currency);
                        } catch (error) {
                            return helpers.error('number.precision', { message: (error as Error).message });
                        }
                    }
                }

                // Return normalized number for internal processing
                return numValue;
            } catch (error) {
                return helpers.error('number.invalid', { message: (error as Error).message });
            }
        })
        .messages({
            'alternatives.match': 'Amount must be a positive number or numeric string',
            'number.positive': 'Amount must be greater than zero',
            'number.max': 'Amount cannot exceed 999,999.99',
            'number.invalid': 'Invalid amount format',
        });

    return baseSchema;
}
