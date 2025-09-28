import { TestUserBuilder } from '@splitifyd/test-support';

/**
 * Test scenarios object that provides consistent test data for Playwright tests
 * Uses builder factory functions instead of static object literals
 */
export class TestScenarios {
    // Static instances to ensure consistency within test runs
    private static _validUser: { email: string; password: string; displayName: string } | null = null;

    // User data scenarios using builder factory functions
    static validUserBuilder(): TestUserBuilder {
        return TestUserBuilder.validUser();
    }

    static get validUser() {
        if (!this._validUser) {
            this._validUser = this.validUserBuilder().build();
        }
        return this._validUser;
    }

    static userWithWeakPasswordBuilder(): TestUserBuilder {
        return TestUserBuilder.userWithWeakPassword();
    }

    static userWithStrongPasswordBuilder(): TestUserBuilder {
        return TestUserBuilder.userWithStrongPassword();
    }

    // Password scenarios (kept as simple arrays since they're just data)
    static get weakPasswords() {
        return ['weak', '123', 'password', '12345678', 'abc123'];
    }

    static get strongPasswords() {
        return ['StrongPassword123!', 'MySecureP@ssw0rd', 'Complex!Pass123', 'Tr0ub4dor&3', 'correct-horse-battery-staple-123'];
    }
}
