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
    // Direct import to avoid circular dependency issues
    // Using import() would be async, so we use a direct object instead
    return {
        email: `${prefix}-${id}@example.com`,
        displayName: `${prefix} ${id}`,
        password: DEFAULT_PASSWORD,
    };
}

export function randomString(length: number = 8): string {
    return Math.random()
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

export function randomCategory(): string {
    return randomChoice(['food', 'transport', 'entertainment', 'utilities', 'shopping', 'other']);
}
