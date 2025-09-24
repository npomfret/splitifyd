// Currency definitions - single source of truth for the entire application
import currencyData from './currency-data';

/**
 * Currency interface matching the structure in currencies.json
 */
export interface Currency {
    acronym: string;
    name: string;
    symbol: string;
    decimal_digits: number;
    countries: string[];
}

/**
 * All available currencies (read-only array)
 */
export const CURRENCIES: readonly Currency[] = currencyData as Currency[];

/**
 * Currency lookup map for fast access by currency code
 */
const currencyMap = new Map<string, Currency>(CURRENCIES.map((currency) => [currency.acronym.toUpperCase(), currency]));

/**
 * Get currency by code (3-letter ISO code like 'USD', 'EUR', etc.)
 *
 * @param code - Currency code (case-insensitive)
 * @returns Currency object
 * @throws Error if currency not found (fail-fast principle)
 */
export function getCurrency(code: string): Currency {
    const upperCode = code.toUpperCase();
    const currency = currencyMap.get(upperCode);

    if (!currency) {
        throw new Error(`Invalid currency code: ${code}. Must be a valid 3-letter ISO currency code.`);
    }

    return currency;
}

/**
 * Check if a currency code is valid
 *
 * @param code - Currency code to validate
 * @returns true if valid, false otherwise
 */
export function isValidCurrency(code: string): boolean {
    return currencyMap.has(code.toUpperCase());
}

/**
 * Get all available currency codes
 *
 * @returns Array of all currency codes
 */
export function getAllCurrencyCodes(): string[] {
    return CURRENCIES.map((c) => c.acronym);
}

/**
 * Commonly used currencies for UI dropdowns
 */
export const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'MXN', 'BRL', 'ZAR'] as const;
