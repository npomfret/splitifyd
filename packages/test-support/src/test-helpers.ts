// Import currency utilities from shared package
import { CurrencyISOCode, Email, ExpenseLabel, toAmount, toCurrencyISOCode, toEmail, toExpenseLabel, toPassword } from '@billsplit-wl/shared';
import { Amount, getCurrencyDecimals, roundToCurrencyPrecision } from '@billsplit-wl/shared';
import { ISOString, toISOString } from '@billsplit-wl/shared';
import { toDisplayName } from '@billsplit-wl/shared';

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

// Default test credentials - used for the bootstrap admin user and all test users
export const DEFAULT_PASSWORD = toPassword('passwordpass');
export const DEFAULT_ADMIN_EMAIL = toEmail('test1@test.com');
export const DEFAULT_ADMIN_DISPLAY_NAME = toDisplayName('Bill Splitter');

export function generateNewUserDetails(prefix = 'u') {
    const id = generateShortId();
    // Direct object return to avoid circular dependency issues with TestUserBuilder
    // TestUserBuilder imports from this file, so we can't import it here
    return {
        email: toEmail(`${prefix}-${id}@example.com`),
        displayName: toDisplayName(`${prefix} ${id}`),
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

export function randomEmail(): Email {
    return toEmail(`${randomString(8)}@${randomString(5)}.com`);
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
export function randomValidCurrencyAmountPair(min: number = 5, max: number = 500): { currency: CurrencyISOCode; amount: Amount; } {
    // Currency lists by decimal precision (excluding USD)
    const currenciesByDecimals: Record<number, CurrencyISOCode[]> = {
        0: ['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'PYG'].map(item => toCurrencyISOCode(item)), // Zero decimals
        1: ['MGA', 'MRU'].map(item => toCurrencyISOCode(item)), // One decimal
        2: ['EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN'].map(item => toCurrencyISOCode(item)), // Two decimals (excluding USD)
        3: ['BHD', 'KWD', 'OMR', 'JOD', 'TND'].map(item => toCurrencyISOCode(item)), // Three decimals
    };

    // Pick a random decimal precision group
    const decimalOptions: number[] = [0, 1, 2, 3];
    const selectedDecimals: number = randomChoice<number>(decimalOptions);

    // Pick a random currency from that group
    const currencyList: CurrencyISOCode[] = currenciesByDecimals[selectedDecimals];
    const currency: CurrencyISOCode = randomChoice<CurrencyISOCode>(currencyList);

    // Generate amount with correct decimal precision
    const numericAmount = randomDecimal(min, max, selectedDecimals);
    const amount: Amount = roundToCurrencyPrecision(toAmount(numericAmount), currency);

    return { currency, amount };
}

const RANDOM_LABELS = ['food', 'transport', 'entertainment', 'utilities', 'shopping', 'groceries', 'rent', 'travel'];

export function randomLabels(): ExpenseLabel[] {
    const count = Math.floor(Math.random() * 3);
    if (count === 0) return [];
    const shuffled = [...RANDOM_LABELS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map(toExpenseLabel);
}

export function convertToISOString(createdAt: ISOString | Date | string) {
    if (typeof createdAt === 'string') {
        return toISOString(createdAt);
    } else if (createdAt instanceof Date) {
        return toISOString(createdAt.toISOString());
    } else {
        return createdAt;
    }
}
