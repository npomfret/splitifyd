import { DisplayName, toDisplayName } from '@billsplit-wl/shared';
import type { Email } from '@billsplit-wl/shared';
import { generateShortId, randomChoice } from '../test-helpers';
import {toEmail} from "@billsplit-wl/shared";

interface TestUser {
    email: Email;
    password: string;
    displayName: DisplayName;
}

/**
 * Builder for creating test user authentication data
 * Used in E2E and integration tests for user creation and authentication
 */
export class TestUserBuilder {
    private user: TestUser;

    constructor() {
        this.user = {
            email: toEmail(`test-${generateShortId()}@example.com`),
            password: 'passwordpass', // Default test password: 12 characters, no complexity required
            displayName: toDisplayName(`${randomChoice(['Test', 'Demo', 'Sample'])} ${randomChoice(['User', 'Person', 'Account'])}`),
        };
    }

    withEmail(email: Email | string): this {
        this.user.email = typeof email === 'string' ? toEmail(email) : email;
        return this;
    }

    withPassword(password: string): this {
        this.user.password = password;
        return this;
    }

    withDisplayName(displayName: DisplayName): this {
        this.user.displayName = displayName;
        return this;
    }

    build(): TestUser {
        return { ...this.user };
    }
}
