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
    CommentTarget,
    PaginatedResult
} from '../../types/firestore-reader-types';

// Import types for proper typing
import type {
    UserDocument,
    GroupDocument,
    ExpenseDocument,
    SettlementDocument,
    GroupChangeDocument
} from '../../schemas';
import type { PolicyDocument } from '@splitifyd/shared';
import type { ParsedComment as CommentDocument } from '../../schemas';
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
    public getAllPolicies = vi.fn();
    public getUsersById = vi.fn();
    public getGroupsForUser = vi.fn();
    public getGroupMembers = vi.fn();
    public getMemberFromSubcollection = vi.fn();
    public getMembersFromSubcollection = vi.fn();
    public getExpensesForGroup = vi.fn();
    public getSettlementsForGroup = vi.fn();
    public getRecentGroupChanges = vi.fn();
    public getGroupInTransaction = vi.fn();
    public getUserInTransaction = vi.fn();
    public getMultipleInTransaction = vi.fn();
    public documentExists = vi.fn();

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
     * Mock multiple groups for a user with pagination support
     */
    public mockGroupsForUser(userId: string, groups: GroupDocument[], hasMore: boolean = false, nextCursor?: string): void {
        const paginatedResult: PaginatedResult<GroupDocument[]> = {
            data: groups,
            hasMore,
            nextCursor,
            totalEstimate: groups.length + (hasMore ? 10 : 0)
        };
        
        this.getGroupsForUser.mockResolvedValue(paginatedResult);
        
        // Also mock individual group gets
        groups.forEach(group => {
            if (!this.getGroup.getMockImplementation()) {
                this.mockGroupExists(group.id, group);
            }
        });
    }

    /**
     * Mock paginated groups with specific pagination behavior
     * Useful for testing pagination edge cases
     */
    public mockPaginatedGroups(
        userId: string, 
        allGroups: GroupDocument[], 
        pageSize: number = 10
    ): void {
        this.getGroupsForUser.mockImplementation(async (uid, options) => {
            if (uid !== userId) {
                return { data: [], hasMore: false };
            }
            
            const limit = options?.limit || pageSize;
            const cursor = options?.cursor;
            
            let startIndex = 0;
            if (cursor) {
                try {
                    const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString());
                    const cursorIndex = allGroups.findIndex(group => group.id === cursorData.lastGroupId);
                    if (cursorIndex >= 0) {
                        startIndex = cursorIndex + 1;
                    }
                } catch (error) {
                    // Invalid cursor, start from beginning
                }
            }
            
            const endIndex = startIndex + limit;
            const pageData = allGroups.slice(startIndex, endIndex);
            const hasMore = endIndex < allGroups.length;
            
            let nextCursor: string | undefined;
            if (hasMore && pageData.length > 0) {
                const lastGroup = pageData[pageData.length - 1];
                const cursorData = {
                    lastGroupId: lastGroup.id,
                    lastUpdatedAt: lastGroup.updatedAt
                };
                nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
            }
            
            return {
                data: pageData,
                hasMore,
                nextCursor,
                totalEstimate: allGroups.length
            };
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
     * Mock document existence checks
     */
    public mockDocumentExists(collection: string, documentId: string, exists: boolean = true): void {
        this.documentExists.mockImplementation(async (col, id) => {
            return col === collection && id === documentId ? exists : false;
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

    /**
     * Mock group members subcollection data
     */
    public mockGroupMembersSubcollection(groupId: string, members: GroupMemberDocument[]): void {
        this.getMembersFromSubcollection.mockImplementation(async (id) => {
            return id === groupId ? members : [];
        });

        this.getMemberFromSubcollection.mockImplementation(async (id, userId) => {
            if (id === groupId) {
                return members.find(m => m.userId === userId) || null;
            }
            return null;
        });
    }

    /**
     * Mock a single member in a group's subcollection
     */
    public mockMemberInSubcollection(groupId: string, member: GroupMemberDocument): void {
        this.getMemberFromSubcollection.mockImplementation(async (id, userId) => {
            return (id === groupId && userId === member.userId) ? member : null;
        });
    }

    /**
     * Create a test GroupMemberDocument with default values
     */
    public createTestGroupMemberDocument(overrides: Partial<GroupMemberDocument> = {}): GroupMemberDocument {
        return {
            userId: 'test-user',
            groupId: 'test-group',
            memberRole: 'member' as any,
            theme: {
                light: '#007bff',
                dark: '#0066cc',
                name: 'Blue',
                pattern: 'solid' as any,
                assignedAt: new Date().toISOString(),
                colorIndex: 0
            },
            joinedAt: new Date().toISOString(),
            memberStatus: 'active' as any,
            ...overrides
        };
    }

    /**
     * Mock recent group changes for a user - helper method using builder
     */
    public mockRecentGroupChanges(userId: string, changes: GroupChangeDocument[]): void {
        this.getRecentGroupChanges.mockResolvedValue(changes.filter(change => change.users.includes(userId)));
    }

    /**
     * Mock empty recent group changes for a user
     */
    public mockNoRecentGroupChanges(userId: string): void {
        this.getRecentGroupChanges.mockResolvedValue([]);
    }

    // ========================================================================
    // Policy Mock Helpers
    // ========================================================================

    /**
     * Mock a policy to exist
     */
    public mockPolicyExists(policyId: string, policyData: Partial<PolicyDocument> = {}): void {
        this.getPolicy.mockImplementation(async (id) => {
            if (id === policyId) {
                return {
                    id: policyId,
                    policyName: 'Test Policy',
                    currentVersionHash: 'test-hash',
                    versions: {
                        'test-hash': {
                            text: 'Test policy content',
                            createdAt: new Date().toISOString(),
                        }
                    },
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...policyData
                } as PolicyDocument;
            }
            return null;
        });
    }

    /**
     * Mock all policies to return a list
     */
    public mockAllPolicies(policies: PolicyDocument[]): void {
        this.getAllPolicies.mockResolvedValue(policies);
    }

    /**
     * Mock empty policies list
     */
    public mockNoPolicies(): void {
        this.getAllPolicies.mockResolvedValue([]);
    }

    /**
     * Create a test PolicyDocument with default values
     */
    public createTestPolicyDocument(overrides: Partial<PolicyDocument> = {}): PolicyDocument {
        return {
            id: 'test-policy',
            policyName: 'Test Policy',
            currentVersionHash: 'test-hash',
            versions: {
                'test-hash': {
                    text: 'Test policy content',
                    createdAt: new Date().toISOString(),
                }
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...overrides
        };
    }
}