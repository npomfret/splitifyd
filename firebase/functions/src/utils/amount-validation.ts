import { getCurrency, parseMonetaryAmount } from '@splitifyd/shared';
import { Amount } from '@splitifyd/shared';
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
 * Count decimal places in an amount string (or numeric) without relying on floating-point math
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
 * @throws Error if precision is invalid
 */
export function validateAmountPrecision(amount: Amount, currencyCode: string): void {
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
export function createJoiAmountSchema(currencyField?: string): Joi.StringSchema {
    return Joi
        .string()
        .trim()
        .pattern(/^\d+(\.\d+)?$/, 'decimal number')
        .custom((value, helpers) => {
            try {
                // Parse to number using shared utility (handles both types)
                const numValue = parseMonetaryAmount(value);

                // Validate range
                if (numValue <= 0) {
                    return helpers.error('amount.positive');
                }
                if (numValue > 999999.99) {
                    return helpers.error('amount.max');
                }

                // Validate precision if currency field is available
                if (currencyField) {
                    const currency = helpers.state.ancestors[0][currencyField];
                    if (currency) {
                        try {
                            validateAmountPrecision(value, currency);
                        } catch (error) {
                            return helpers.error('amount.precision', { message: (error as Error).message });
                        }
                    }
                }

                // Return normalized string amount
                return value;
            } catch (error) {
                return helpers.error('amount.invalid', { message: (error as Error).message });
            }
        })
        .messages({
            'string.pattern.name': 'Amount must be a valid decimal number',
            'amount.positive': 'Amount must be greater than zero',
            'amount.max': 'Amount cannot exceed 999,999.99',
            'amount.precision': '{#message}',
            'amount.invalid': 'Invalid amount format',
        });
}
