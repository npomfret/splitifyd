/**
 * Local copy of test helpers to avoid TypeScript rootDir issues
 */

/**
 * Generates a short, readable UUID for test data
 * Format: 8 alphanumeric characters
 */
function generateShortId(): string {
    return Math.random().toString(36).substring(2, 10);
}

export const DEFAULT_PASSWORD = 'TestPassword123!';

export function generateNewUserDetails(prefix = "u") {
    const id = generateShortId();
    return {
        displayName: `${prefix} ${id}`,
        email: `${prefix}-${id}@example.com`,
        password: DEFAULT_PASSWORD
    };
}