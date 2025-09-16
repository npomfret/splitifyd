/**
 * Shared fixtures and test data for Playwright E2E tests
 * Using existing builders from @packages/test-support
 */

import { UserProfileBuilder, MockGroupBuilder, randomString, randomEmail, randomChoice, randomDecimal, generateShortId, DEFAULT_PASSWORD } from '@splitifyd/test-support';

// Simple credentials builder for login tests (no existing builder for this)
class CredentialsBuilder {
    private creds: any = {
        email: randomEmail(),
        password: DEFAULT_PASSWORD,
    };

    static create() {
        return new CredentialsBuilder();
    }

    withEmail(email: string) {
        this.creds.email = email;
        return this;
    }

    withPassword(password: string) {
        this.creds.password = password;
        return this;
    }

    build() {
        return { ...this.creds };
    }
}

// Group builder for E2E test UI data (simpler than MockGroupBuilder)
class SimpleGroupBuilder {
    private group: any = {
        id: `group-${generateShortId()}`,
        name: `${randomChoice(['Team', 'Group', 'Squad', 'Club', 'Circle'])} ${randomString(6)}`,
        description: `${randomChoice(['Fun', 'Cool', 'Awesome', 'Great', 'Nice'])} group for ${randomString(8)}`,
        memberCount: randomChoice([2, 3, 4, 5, 6]),
        totalExpenses: randomDecimal(100, 5000),
        userBalance: randomDecimal(-200, 200),
        balanceState: randomChoice(['owe', 'owed', 'settled'] as const),
    };

    static create() {
        return new SimpleGroupBuilder();
    }

    withId(id: string) {
        this.group.id = id;
        return this;
    }

    withName(name: string) {
        this.group.name = name;
        return this;
    }

    withDescription(description: string) {
        this.group.description = description;
        return this;
    }

    withMemberCount(count: number) {
        this.group.memberCount = count;
        return this;
    }

    withTotalExpenses(amount: number) {
        this.group.totalExpenses = amount;
        return this;
    }

    withUserBalance(balance: number, state?: 'owe' | 'owed' | 'settled') {
        this.group.userBalance = balance;
        if (state) {
            this.group.balanceState = state;
        } else {
            // Auto-determine state based on balance
            this.group.balanceState = balance > 0 ? 'owed' : balance < 0 ? 'owe' : 'settled';
        }
        return this;
    }

    build() {
        return { ...this.group };
    }
}

// Export builders
export { UserProfileBuilder as UserBuilder, MockGroupBuilder, CredentialsBuilder, SimpleGroupBuilder };

// Pre-built common test data using existing builders
export const mockUsers = {
    john: new UserProfileBuilder().withUid('user-john-123').withEmail('john@example.com').withDisplayName('John Doe').build(),
    jane: new UserProfileBuilder().withUid('user-jane-456').withEmail('jane@example.com').withDisplayName('Jane Smith').build(),
};

export const mockGroups = [
    new SimpleGroupBuilder()
        .withId('group-1')
        .withName('Apartment Expenses')
        .withDescription('Shared apartment costs')
        .withMemberCount(3)
        .withTotalExpenses(1250.5)
        .withUserBalance(-45.25, 'owe')
        .build(),
    new SimpleGroupBuilder()
        .withId('group-2')
        .withName('Vacation Trip')
        .withDescription('Summer vacation to Greece')
        .withMemberCount(5)
        .withTotalExpenses(3200.0)
        .withUserBalance(120.75, 'owed')
        .build(),
    new SimpleGroupBuilder().withId('group-3').withName('Settled Group').withDescription('All expenses settled').withMemberCount(2).withTotalExpenses(800.0).withUserBalance(0, 'settled').build(),
];

export const validCredentials = CredentialsBuilder.create().withEmail('test@example.com').withPassword('password123').build();

export const invalidCredentials = CredentialsBuilder.create().withEmail('invalid@example.com').withPassword('wrongpassword').build();

// Test data for group creation
export const validGroupData = new SimpleGroupBuilder().withName('New Test Group').withDescription('A group for testing purposes').build();

export const invalidGroupData = {
    empty: { name: '', description: '' },
    tooShort: { name: 'A', description: 'Too short name' },
    tooLong: { name: 'A'.repeat(51), description: 'Name too long' },
};
