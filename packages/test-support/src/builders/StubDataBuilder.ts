import { generateShortId } from '../test-helpers';

/**
 * Builder for creating stub/mock data for StubFirestoreReader and StubAuthService
 * Used in unit tests to set up mock documents and user records
 */
export class StubDataBuilder {

    /**
     * Creates a basic group document structure for StubFirestoreReader.setDocument
     */
    static groupDocument(overrides: Partial<any> = {}): any {
        const groupId = `group-${generateShortId()}`;
        return {
            id: groupId,
            name: 'Test Group',
            description: 'Test group description',
            members: {},
            createdBy: `user-${generateShortId()}`,
            ...overrides,
        };
    }

    /**
     * Creates a basic user document structure for StubFirestoreReader.setDocument
     */
    static userDocument(overrides: Partial<any> = {}): any {
        const userId = `user-${generateShortId()}`;
        return {
            uid: userId,
            email: `${userId}@test.com`,
            displayName: `Test User ${userId.slice(-4)}`,
            ...overrides,
        };
    }

    /**
     * Creates a basic auth user record for StubAuthService.setUser
     */
    static authUserRecord(overrides: Partial<any> = {}): any {
        const userId = `user-${generateShortId()}`;
        return {
            uid: userId,
            email: `${userId}@test.com`,
            displayName: `Test User ${userId.slice(-4)}`,
            emailVerified: true,
            ...overrides,
        };
    }

    /**
     * Creates a group member document structure
     */
    static groupMemberDocument(overrides: Partial<any> = {}): any {
        const userId = `user-${generateShortId()}`;
        const groupId = `group-${generateShortId()}`;
        return {
            uid: userId,
            groupId: groupId,
            memberRole: 'member',
            memberStatus: 'active',
            joinedAt: new Date().toISOString(),
            ...overrides,
        };
    }

    /**
     * Creates an expense document structure
     */
    static expenseDocument(overrides: Partial<any> = {}): any {
        const expenseId = `expense-${generateShortId()}`;
        const userId = `user-${generateShortId()}`;
        const groupId = `group-${generateShortId()}`;
        return {
            id: expenseId,
            groupId: groupId,
            description: 'Test Expense',
            amount: 100,
            currency: 'USD',
            paidBy: userId,
            createdBy: userId,
            ...overrides,
        };
    }

    /**
     * Creates a settlement document structure
     */
    static settlementDocument(overrides: Partial<any> = {}): any {
        const settlementId = `settlement-${generateShortId()}`;
        const payerId = `user-${generateShortId()}`;
        const payeeId = `user-${generateShortId()}`;
        const groupId = `group-${generateShortId()}`;
        return {
            id: settlementId,
            groupId: groupId,
            amount: 50,
            currency: 'USD',
            payer: payerId,
            payee: payeeId,
            note: 'Test Settlement',
            ...overrides,
        };
    }
}