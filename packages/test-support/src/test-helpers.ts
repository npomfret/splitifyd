// Import currency utilities from shared package
import { getCurrencyDecimals, roundToCurrencyPrecision } from '@splitifyd/shared';

/**
 * Generates a short, readable UUID for test data
 * Format: 8 alphanumeric characters
 */
export function generateShortId(): string {
    return Math.random().toString(36).substring(2, 10);
}

/**
 * Generates a unique test group name using short ID
 */
export function generateTestGroupName(prefix: string = 'Group'): string {
    return `${prefix} ${generateShortId()}`;
}

/**
 * Generates a unique test email using short ID
 */
export function generateTestEmail(prefix: string = 'test'): string {
    return generateNewUserDetails(prefix).email;
}

/**
 * Generates a unique test user name using short ID
 */
export function generateTestUserName(prefix: string = 'User'): string {
    return generateNewUserDetails(prefix).displayName;
}

export const DEFAULT_PASSWORD = 'rrRR44$$';

export function generateNewUserDetails(prefix = 'u') {
    const id = generateShortId();
    // Direct object return to avoid circular dependency issues with TestUserBuilder
    // TestUserBuilder imports from this file, so we can't import it here
    return {
        email: `${prefix}-${id}@example.com`,
        displayName: `${prefix} ${id}`,
        password: DEFAULT_PASSWORD,
    };
}

export function randomString(length: number = 8): string {
    return Math
        .random()
        .toString(36)
        .substring(2, 2 + length);
}

export function randomNumber(min: number = 1, max: number = 1000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomDecimal(min: number = 1, max: number = 1000, decimals: number = 2): number {
    const value = Math.random() * (max - min) + min;
    return Number(value.toFixed(decimals));
}

export function randomBoolean(): boolean {
    return Math.random() < 0.5;
}

export function randomChoice<T>(choices: T[]): T {
    return choices[Math.floor(Math.random() * choices.length)];
}

export function randomDate(daysAgo: number = 30): string {
    const now = new Date();
    const pastDate = new Date(now.getTime() - Math.random() * daysAgo * 24 * 60 * 60 * 1000);
    return pastDate.toISOString();
}

export function randomUrl(): string {
    return `https://example.com/${randomString(10)}`;
}

export function randomEmail(): string {
    return `${randomString(8)}@${randomString(5)}.com`;
}

export function randomCurrency(): string {
    return randomChoice(['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY']);
}

// Re-export currency utilities for backward compatibility
export { getCurrencyDecimals, roundToCurrencyPrecision };

/**
 * Generates a valid random currency/amount pair
 * Ensures the amount has the correct decimal precision for the selected currency
 * Excludes USD as requested
 *
 * @param min Minimum amount (default: 5)
 * @param max Maximum amount (default: 500)
 * @returns Object with currency code and valid amount
 */
export function randomValidCurrencyAmountPair(min: number = 5, max: number = 500): { currency: string; amount: number; } {
    // Currency lists by decimal precision (excluding USD)
    const currenciesByDecimals: Record<number, string[]> = {
        0: ['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'PYG'], // Zero decimals
        1: ['MGA', 'MRU'], // One decimal
        2: ['EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN'], // Two decimals (excluding USD)
        3: ['BHD', 'KWD', 'OMR', 'JOD', 'TND'], // Three decimals
    };

    // Pick a random decimal precision group
    const decimalOptions: number[] = [0, 1, 2, 3];
    const selectedDecimals: number = randomChoice<number>(decimalOptions);

    // Pick a random currency from that group
    const currencyList: string[] = currenciesByDecimals[selectedDecimals];
    const currency: string = randomChoice<string>(currencyList);

    // Generate amount with correct decimal precision
    const amount: number = randomDecimal(min, max, selectedDecimals);

    return { currency, amount };
}

export function randomCategory(): string {
    return randomChoice(['food', 'transport', 'entertainment', 'utilities', 'shopping', 'other']);
}

/**
 * Type for timestamp values in builders
 * Supports Date objects, ISO strings, and Firestore Timestamps
 */
export type BuilderTimestamp = Date | string | { toDate(): Date; };

/**
 * Converts various timestamp formats to ISO string
 * Handles Date objects, ISO strings, and Firestore Timestamps
 */
export function timestampToISOString(timestamp: BuilderTimestamp | null): string {
    if (!timestamp) {
        return new Date().toISOString();
    }
    if (typeof timestamp === 'string') {
        return timestamp;
    }
    if (timestamp instanceof Date) {
        return timestamp.toISOString();
    }
    // Firestore Timestamp
    return timestamp.toDate().toISOString();
}
