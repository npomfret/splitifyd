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
import type { IFirestoreReader } from '../../services/firestore';
import type { PaginatedResult } from '../../types/firestore-reader-types';

// Import types for proper typing
import type { UserDocument, GroupDocument } from '../../schemas';
import type { PolicyDocument } from '@splitifyd/shared';
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
    public getGroupsForUserV2 = vi.fn();
    public getGroupMembers = vi.fn();
    public getGroupMember = vi.fn();
    public getAllGroupMembers = vi.fn();
    public getAllGroupMemberIds = vi.fn();
    public getExpensesForGroup = vi.fn();
    public getSettlementsForGroup = vi.fn();
    // Note: getRecentGroupChanges removed as GROUP_CHANGES collection was unused
    public getGroupInTransaction = vi.fn();
    public getUserInTransaction = vi.fn();
    public documentExists = vi.fn();

    // New methods added to interface
    public getUserNotification = vi.fn();
    public userNotificationExists = vi.fn();
    public findShareLinkByToken = vi.fn();
    public getShareLinksForGroup = vi.fn();
    public getShareLink = vi.fn();
    public getCommentsForTarget = vi.fn();
    public getComment = vi.fn();
    public getCommentByReference = vi.fn();

    // New methods added for centralized Firestore access
    public getExpenseHistory = vi.fn();
    public getExpensesForGroupPaginated = vi.fn();
    public getGroupDeletionData = vi.fn();

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
                    ...userData,
                } as UserDocument;
            }
            return null;
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
                    ...groupData,
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
            totalEstimate: groups.length + (hasMore ? 10 : 0),
        };

        this.getGroupsForUserV2.mockResolvedValue(paginatedResult);

        // Also mock individual group gets
        groups.forEach((group) => {
            if (!this.getGroup.getMockImplementation()) {
                this.mockGroupExists(group.id, group);
            }
        });
    }

    /**
     * Mock paginated groups with specific pagination behavior
     * Useful for testing pagination edge cases - using V2 method
     */
    public mockPaginatedGroups(userId: string, allGroups: GroupDocument[], pageSize: number = 10): void {
        // Mock the V2 method with pagination logic
        this.getGroupsForUserV2.mockImplementation(async (uid, options) => {
            if (uid !== userId) {
                return { data: [], hasMore: false };
            }

            const limit = options?.limit || pageSize;
            const cursor = options?.cursor;

            let startIndex = 0;
            if (cursor) {
                try {
                    const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString());
                    const cursorIndex = allGroups.findIndex((group) => group.id === cursorData.lastGroupId);
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
                    lastUpdatedAt: lastGroup.updatedAt,
                };
                nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
            }

            return {
                data: pageData,
                hasMore,
                nextCursor,
                totalEstimate: allGroups.length,
            };
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
            ...overrides,
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
                settingsManagement: 'anyone',
            },
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            ...overrides,
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
            amount: 10.0,
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
            ...overrides,
        };
    }

    // Note: Group changes mock helpers removed as GROUP_CHANGES collection was unused

    // ========================================================================
    // Policy Mock Helpers
    // ========================================================================

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
                },
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...overrides,
        };
    }

    // ========================================================================
    // Mock implementations for new methods
    // ========================================================================

    getSettlementsForGroupPaginated = vi.fn().mockResolvedValue({
        settlements: [],
        hasMore: false,
        nextCursor: undefined,
    });



    verifyGroupMembership = vi.fn().mockResolvedValue(true);







    getRawDocumentInTransaction = vi.fn().mockResolvedValue(null);


    // New encapsulated raw document methods
    getRawGroupDocument = vi.fn().mockResolvedValue(null);
    getRawPolicyDocument = vi.fn().mockResolvedValue(null);
    getRawGroupDocumentInTransaction = vi.fn().mockResolvedValue(null);

    // Additional transaction methods for complete migration
    getRawExpenseDocumentInTransaction = vi.fn().mockResolvedValue(null);
    getRawSettlementDocumentInTransaction = vi.fn().mockResolvedValue(null);
    getRawUserDocumentInTransaction = vi.fn().mockResolvedValue(null);
    getGroupMembershipsInTransaction = vi.fn().mockResolvedValue({ empty: true, docs: [] });
}
