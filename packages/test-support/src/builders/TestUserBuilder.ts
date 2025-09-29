import { generateShortId, randomChoice } from '../test-helpers';

export interface TestUser {
    email: string;
    password: string;
    displayName: string;
}

/**
 * Builder for creating test user authentication data
 * Used in E2E and integration tests for user creation and authentication
 */
export class TestUserBuilder {
    private user: TestUser;

    constructor() {
        this.user = {
            email: `test-${generateShortId()}@example.com`,
            password: 'rrRR44$$', // Strong password that meets validation requirements
            displayName: `${randomChoice(['Test', 'Demo', 'Sample'])} ${randomChoice(['User', 'Person', 'Account'])}`,
        };
    }

    withEmail(email: string): this {
        this.user.email = email;
        return this;
    }

    withPassword(password: string): this {
        this.user.password = password;
        return this;
    }

    withDisplayName(displayName: string): this {
        this.user.displayName = displayName;
        return this;
    }

    build(): TestUser {
        return { ...this.user };
    }

    static validUser(): TestUserBuilder {
        return new TestUserBuilder()
            .withEmail(`test-${generateShortId()}@example.com`)
            .withPassword('rrRR44$$')
            .withDisplayName('Test User');
    }

    static userWithWeakPassword(): TestUserBuilder {
        const weakPasswords = ['weak', '123', 'password', '12345678', 'abc123'];
        return new TestUserBuilder()
            .withPassword(randomChoice(weakPasswords));
    }

    static userWithStrongPassword(): TestUserBuilder {
        const strongPasswords = ['StrongPassword123!', 'MySecureP@ssw0rd', 'Complex!Pass123', 'Tr0ub4dor&3', 'correct-horse-battery-staple-123'];
        return new TestUserBuilder()
            .withPassword(randomChoice(strongPasswords));
    }
}