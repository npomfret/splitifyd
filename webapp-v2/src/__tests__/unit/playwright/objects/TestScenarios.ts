import { generateShortId } from '@splitifyd/test-support';

/**
 * Test scenarios object that provides consistent test data for Playwright tests
 * Replaces the static TEST_SCENARIOS constant with an object-oriented approach
 */
export class TestScenarios {
    // Static instances to ensure consistency within test runs
    private static _validUser: { email: string; password: string; displayName: string } | null = null;

    // User data scenarios
    static get validUser() {
        if (!this._validUser) {
            this._validUser = {
                email: `test-${generateShortId()}@example.com`,
                password: 'password123',
                displayName: 'Test User'
            };
        }
        return this._validUser;
    }

    // Password scenarios
    static get weakPasswords() {
        return [
            'weak',
            '123',
            'password',
            '12345678',
            'abc123'
        ];
    }

    static get strongPasswords() {
        return [
            'StrongPassword123!',
            'MySecureP@ssw0rd',
            'Complex!Pass123',
            'Tr0ub4dor&3',
            'correct-horse-battery-staple-123'
        ];
    }

}