import { Amount, CurrencyISOCode, getCurrency } from '@billsplit-wl/shared';

/**
 * Determine the maximum number of decimal places that a currency supports.
 */
function getMaxDecimalPlaces(currencyCode: CurrencyISOCode): number {
    const currency = getCurrency(currencyCode);
    return currency.decimal_digits;
}

/**
 * Count decimal places in an amount string (or numeric) without relying on floating-point math.
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
 * Validate that an amount has the correct precision for the provided currency.
 *
 * @throws Error when the precision exceeds the currency's supported decimal places.
 */
export function validateAmountPrecision(amount: Amount, currencyCode: CurrencyISOCode): void {
    const maxDecimals = getMaxDecimalPlaces(currencyCode);
    const actualDecimals = countDecimalPlaces(amount);

    if (actualDecimals > maxDecimals) {
        const currency = getCurrency(currencyCode);
        if (maxDecimals === 0) {
            throw new Error(
                `Amount must be a whole number for ${currencyCode} (${currency.name}). Received ${actualDecimals} decimal place(s).`,
            );
        }

        throw new Error(
            `Amount must have at most ${maxDecimals} decimal place(s) for ${currencyCode} (${currency.name}). Received ${actualDecimals} decimal place(s).`,
        );
    }
}
