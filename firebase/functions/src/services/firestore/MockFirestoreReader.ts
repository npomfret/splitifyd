/**
 * Mock FirestoreReader Implementation for Testing
 * 
 * Provides a fully-mocked implementation of IFirestoreReader using Vitest mocks.
 * This allows for fast, isolated unit tests without requiring a Firebase emulator.
 * 
 * Features:
 * - Type-safe mock functions for all interface methods
 * - Helper methods for common test scenarios
 * - Automatic mock reset functionality
 * - Builder pattern support for complex test data
 */

import { vi } from 'vitest';
import type { IFirestoreReader } from './IFirestoreReader';
import type {
    PaginationOptions,
    QueryOptions,
    GroupMemberQueryOptions,
    CommentTarget,
    GroupSubscriptionCallback,
    ExpenseListSubscriptionCallback,
    CommentListSubscriptionCallback,
    UnsubscribeFunction
} from '../../types/firestore-reader-types';

// Import types for proper typing
import type {
    UserDocument,
    GroupDocument,
    ExpenseDocument,
    SettlementDocument,
    PolicyDocument
} from '../../schemas';
import type { ParsedComment as CommentDocument } from '../../schemas';
import type { ParsedShareLink as ShareLinkDocument } from '../../schemas';
import type { GroupMemberDocument } from '@splitifyd/shared';

export class MockFirestoreReader implements IFirestoreReader {
    // ========================================================================
    // All methods as simple vi.fn() mocks
    // ========================================================================

    public getUser = vi.fn();
    public getGroup = vi.fn();
    public getExpense = vi.fn();
    public getSettlement = vi.fn();
    public getPolicy = vi.fn();
    public getUsersById = vi.fn();
    public getUsersForGroup = vi.fn();
    public getGroupsForUser = vi.fn();
    public getGroupMembers = vi.fn();
    public getExpensesForGroup = vi.fn();
    public getExpensesByUser = vi.fn();
    public getSettlementsForGroup = vi.fn();
    public getSettlementsForUser = vi.fn();
    public getCommentsForTarget = vi.fn();
    public getActiveShareLinkByToken = vi.fn();
    public getPolicyVersionsForUser = vi.fn();
    public getGroupInTransaction = vi.fn();
    public getUserInTransaction = vi.fn();
    public getMultipleInTransaction = vi.fn();
    public subscribeToGroup = vi.fn();
    public subscribeToGroupExpenses = vi.fn();
    public subscribeToComments = vi.fn();
    public getBatchDocuments = vi.fn();
    public documentExists = vi.fn();
    public countDocuments = vi.fn();

    // ========================================================================
    // Test Utility Methods
    // ========================================================================

    /**
     * Reset all mocks to their initial state
     */
    public resetAllMocks(): void {
        vi.resetAllMocks();
    }

    /**
     * Clear all mock call history but keep mock implementations
     */
    public clearAllMocks(): void {
        vi.clearAllMocks();
    }

    /**
     * Restore all mocks to their original non-mocked implementations
     */
    public restoreAllMocks(): void {
        vi.restoreAllMocks();
    }

    // ========================================================================
    // Helper Methods for Common Test Scenarios
    // ========================================================================

    /**
     * Mock a user to exist with the provided data
     */
    public mockUserExists(userId: string, userData: Partial<UserDocument> = {}): void {
        this.getUser.mockImplementation(async (id) => {
            if (id === userId) {
                return {
                    id: userId,
                    email: `${userId}@test.com`,
                    displayName: `Test User ${userId}`,
                    emailVerified: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...userData
                } as UserDocument;
            }
            return null;
        });
    }

    /**
     * Mock multiple users to exist
     */
    public mockUsersExist(users: Array<{ id: string; data?: any }>): void {
        this.getUser.mockImplementation(async (id: string) => {
            const user = users.find(u => u.id === id);
            if (user) {
                return {
                    id,
                    email: `${id}@test.com`,
                    displayName: `Test User ${id}`,
                    emailVerified: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...user.data
                };
            }
            return null;
        });

        this.getUsersById.mockImplementation(async (ids: string[]) => {
            return ids
                .map((id: string) => users.find((user: any) => user.id === id))
                .filter(Boolean)
                .map((user: any) => ({
                    id: user.id,
                    email: `${user.id}@test.com`,
                    displayName: `Test User ${user.id}`,
                    emailVerified: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...user.data
                }));
        });
    }

    /**
     * Mock a group to exist with the provided data
     */
    public mockGroupExists(groupId: string, groupData: Partial<GroupDocument> = {}): void {
        this.getGroup.mockImplementation(async (id) => {
            if (id === groupId) {
                return {
                    id: groupId,
                    name: `Test Group ${groupId}`,
                    description: 'A test group',
                    createdBy: 'test-user',
                    members: {},
                    securityPreset: 'open',
                    permissions: {},
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...groupData
                } as GroupDocument;
            }
            return null;
        });
    }

    /**
     * Mock multiple groups for a user
     */
    public mockGroupsForUser(userId: string, groups: GroupDocument[]): void {
        this.getGroupsForUser.mockResolvedValue(groups);
        
        // Also mock individual group gets
        groups.forEach(group => {
            if (!this.getGroup.getMockImplementation()) {
                this.mockGroupExists(group.id, group);
            }
        });
    }

    /**
     * Mock expenses for a group
     */
    public mockExpensesForGroup(groupId: string, expenses: ExpenseDocument[]): void {
        this.getExpensesForGroup.mockImplementation(async (id) => {
            if (id === groupId) {
                return expenses;
            }
            return [];
        });
        
        // Also mock individual expense gets
        expenses.forEach(expense => {
            this.mockExpenseExists(expense.id, expense);
        });
    }

    /**
     * Mock an expense to exist
     */
    public mockExpenseExists(expenseId: string, expenseData: Partial<ExpenseDocument> = {}): void {
        this.getExpense.mockImplementation(async (id) => {
            if (id === expenseId) {
                return {
                    id: expenseId,
                    groupId: 'test-group',
                    description: 'Test expense',
                    amount: 10.00,
                    currency: 'USD',
                    paidBy: 'test-user',
                    createdBy: 'test-user',
                    date: new Date(),
                    splits: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...expenseData
                } as ExpenseDocument;
            }
            return null;
        });
    }

    /**
     * Mock settlements for a group
     */
    public mockSettlementsForGroup(groupId: string, settlements: SettlementDocument[]): void {
        this.getSettlementsForGroup.mockImplementation(async (id) => {
            if (id === groupId) {
                return settlements;
            }
            return [];
        });
    }

    /**
     * Mock a settlement to exist
     */
    public mockSettlementExists(settlementId: string, settlementData: Partial<SettlementDocument> = {}): void {
        this.getSettlement.mockImplementation(async (id) => {
            if (id === settlementId) {
                return {
                    id: settlementId,
                    groupId: 'test-group',
                    payer: 'test-payer',
                    payee: 'test-payee',
                    amount: 25.00,
                    currency: 'USD',
                    settlementDate: new Date(),
                    createdBy: 'test-user',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    ...settlementData
                } as SettlementDocument;
            }
            return null;
        });
    }

    /**
     * Mock comments for a target
     */
    public mockCommentsForTarget(target: CommentTarget, comments: CommentDocument[]): void {
        this.getCommentsForTarget.mockImplementation(async (t) => {
            if (t.type === target.type && t.id === target.id) {
                return comments;
            }
            return [];
        });
    }

    /**
     * Mock real-time subscriptions (returns a mock unsubscribe function)
     */
    public mockSubscriptions(): void {
        const mockUnsubscribe = vi.fn();
        
        this.subscribeToGroup.mockReturnValue(mockUnsubscribe);
        this.subscribeToGroupExpenses.mockReturnValue(mockUnsubscribe);
        this.subscribeToComments.mockReturnValue(mockUnsubscribe);
    }

    /**
     * Mock document existence checks
     */
    public mockDocumentExists(collection: string, documentId: string, exists: boolean = true): void {
        this.documentExists.mockImplementation(async (col, id) => {
            return col === collection && id === documentId ? exists : false;
        });
    }

    /**
     * Mock batch document retrieval
     */
    public mockBatchDocuments<T>(collection: string, documents: Record<string, T>): void {
        this.getBatchDocuments.mockImplementation(async (col: string, ids: string[]) => {
            if (col === collection) {
                return ids.map((id: string) => documents[id]).filter(Boolean) as T[];
            }
            return [];
        });
    }

    /**
     * Mock document counting
     */
    public mockDocumentCount(collection: string, count: number, filters?: Record<string, any>): void {
        this.countDocuments.mockImplementation(async (col, f) => {
            if (col === collection) {
                // Simple filter matching - could be enhanced for more complex scenarios
                if (!filters || JSON.stringify(f) === JSON.stringify(filters)) {
                    return count;
                }
            }
            return 0;
        });
    }

    // ========================================================================
    // Data Builder Helpers
    // ========================================================================

    /**
     * Create a minimal test user
     */
    public static createTestUser(id: string, overrides: Partial<UserDocument> = {}): UserDocument {
        return {
            id,
            email: `${id}@test.com`,
            displayName: `Test User ${id}`,
            photoURL: null,
            emailVerified: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        };
    }

    /**
     * Create a minimal test group
     */
    public static createTestGroup(id: string, overrides: any = {}): any {
        return {
            id,
            name: `Test Group ${id}`,
            description: 'A test group',
            createdBy: 'test-user',
            members: {},
            securityPreset: 'open',
            permissions: {
                expenseEditing: 'anyone',
                expenseDeletion: 'anyone', 
                memberInvitation: 'anyone',
                memberApproval: 'automatic',
                settingsManagement: 'anyone'
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            ...overrides
        };
    }

    /**
     * Create a minimal test expense
     */
    public static createTestExpense(id: string, overrides: any = {}): any {
        return {
            id,
            groupId: 'test-group',
            description: 'Test expense',
            amount: 10.00,
            currency: 'USD',
            category: 'general',
            paidBy: 'test-user',
            createdBy: 'test-user',
            date: new Date(),
            splitType: 'equal',
            splits: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            ...overrides
        };
    }

    /**
     * Create a minimal test settlement
     */
    public static createTestSettlement(id: string, overrides: any = {}): any {
        return {
            id,
            groupId: 'test-group',
            payerId: 'test-payer',
            payeeId: 'test-payee', 
            payer: 'test-payer',
            payee: 'test-payee',
            amount: 25.00,
            currency: 'USD',
            date: new Date(),
            settlementDate: new Date(),
            createdBy: 'test-user',
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            ...overrides
        };
    }
}