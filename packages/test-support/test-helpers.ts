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
    return generateNewUserDetails(prefix).email
}

/**
 * Generates a unique test user name using short ID
 */
export function generateTestUserName(prefix: string = 'User'): string {
    return generateNewUserDetails(prefix).displayName;
}

export const DEFAULT_PASSWORD = 'rrRR44$$';

export function generateNewUserDetails(prefix= "u") {
    const id = generateShortId();
    return {
        displayName: `${prefix} ${id}`,
        email: `${prefix}-${id}@example.com`,
        password: DEFAULT_PASSWORD
    };
}