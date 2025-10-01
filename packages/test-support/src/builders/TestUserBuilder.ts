import { generateShortId, randomChoice } from '../test-helpers';

interface TestUser {
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
}