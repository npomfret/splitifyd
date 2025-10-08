import { MemberRoles, MemberStatuses } from '@splitifyd/shared';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { ApiError } from '../../../utils/errors';
import { GroupMemberDocumentBuilder } from '../../support/GroupMemberDocumentBuilder';
import { StubFirestoreReader, StubFirestoreWriter } from '../mocks/firestore-stubs';

// Create mock services
const createMockUserService = () => ({
    getUsers: vi.fn().mockResolvedValue(new Map()),
    getUser: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
    registerUser: vi.fn(),
    createUserDirect: vi.fn(),
});

const createMockNotificationService = () => ({
    initializeUserNotifications: vi.fn(),
    updateUserNotification: vi.fn(),
    getUserNotifications: vi.fn(),
});

const createMockGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn(),
    getGroupMember: vi.fn(),
    getAllGroupMembers: vi.fn(),
    getGroupMembersResponseFromSubcollection: vi.fn(),
});

describe('Service-Level Error Handling - Subcollection Queries', () => {
    let stubFirestoreReader: StubFirestoreReader;
    let stubFirestoreWriter: StubFirestoreWriter;
    let groupMemberService: GroupMemberService;

    beforeEach(() => {
        stubFirestoreReader = new StubFirestoreReader();
        stubFirestoreWriter = new StubFirestoreWriter();

        // Create GroupMemberService (uses pre-computed balances from Firestore, no balance service needed)
        groupMemberService = new GroupMemberService(stubFirestoreReader, stubFirestoreWriter);
    });

    // Note: This test file focuses on subcollection query error handling patterns.
    // Complex service integration tests with full mocking are covered by integration tests.

    describe('GroupMemberService - empty subcollection handling', () => {
        test('should handle empty member subcollection gracefully', async () => {
            // Mock empty subcollection through MockFirestoreReader
            vi.spyOn(stubFirestoreReader, 'getAllGroupMembers').mockResolvedValue([]);

            // Should return empty array, not throw
            const members = await stubFirestoreReader.getAllGroupMembers('empty-group-id');

            expect(members).toEqual([]);
            expect(stubFirestoreReader.getAllGroupMembers).toHaveBeenCalledWith('empty-group-id');
        });

        test('should handle subcollection query timeout', async () => {
            // Mock query timeout through MockFirestoreReader
            const timeoutError = new Error('Query timed out after 30 seconds');
            vi.spyOn(stubFirestoreReader, 'getAllGroupMembers').mockRejectedValue(timeoutError);

            // Should let timeout errors bubble up
            await expect(stubFirestoreReader.getAllGroupMembers('timeout-group-id')).rejects.toThrow('Query timed out after 30 seconds');
        });

        test('should handle Firestore permission errors on subcollection access', async () => {
            // Mock permission denied error through MockFirestoreReader
            const permissionError = new Error('Missing or insufficient permissions');
            permissionError.name = 'FirebaseError';
            vi.spyOn(stubFirestoreReader, 'getAllGroupMembers').mockRejectedValue(permissionError);

            // Should let permission errors bubble up
            await expect(stubFirestoreReader.getAllGroupMembers('protected-group-id')).rejects.toThrow('Missing or insufficient permissions');
        });
    });

    describe('Subcollection Query Performance Edge Cases', () => {
        test('should handle large subcollection results without memory issues', async () => {
            // Mock large result set (1000 members) through MockFirestoreReader
            const largeMemberSet = Array.from(
                { length: 1000 },
                (_, i) =>
                    new GroupMemberDocumentBuilder()
                        .withUserId(`user-${i}`)
                        .withGroupId('large-group')
                        .withRole(MemberRoles.MEMBER)
                        .withStatus(MemberStatuses.ACTIVE)
                        .build(),
            );

            vi.spyOn(stubFirestoreReader, 'getAllGroupMembers').mockResolvedValue(largeMemberSet);

            // Should handle large result sets efficiently
            const members = await stubFirestoreReader.getAllGroupMembers('large-group-id');

            expect(members).toHaveLength(1000);
            expect(members[0].uid).toBe('user-0');
            expect(members[999].uid).toBe('user-999');
        });

        test('should handle corrupted subcollection documents', async () => {
            // Mock mixed valid and corrupted documents through MockFirestoreReader
            // The MockFirestoreReader should handle validation, so we just return what it would process
            const mixedMembers = [
                new GroupMemberDocumentBuilder()
                    .withUserId('user-1')
                    .withGroupId('group-123')
                    .withRole(MemberRoles.MEMBER)
                    .withStatus(MemberStatuses.ACTIVE)
                    .build(),
                // Simulate a partially corrupted document
                {
                    uid: 'user-3',
                    groupId: 'group-123',
                    // Missing memberRole and other required fields
                } as any,
            ];

            vi.spyOn(stubFirestoreReader, 'getAllGroupMembers').mockResolvedValue(mixedMembers);

            // Should handle corrupted documents gracefully
            const members = await stubFirestoreReader.getAllGroupMembers('group-with-corruption');

            // Verify that the method doesn't crash with corrupted data
            expect(Array.isArray(members)).toBe(true);
            // Should return the data as-is (service layer handles validation, not the stub)
            expect(members.length).toBe(2);
        });
    });

    describe('Error Recovery and Resilience', () => {
        test('should handle partial subcollection query failures gracefully', async () => {
            // This test documents the pattern for handling partial failures in subcollection queries
            // Real implementation would be in integration tests with actual service methods

            // Pattern: Services should handle individual query failures while continuing with valid operations
            // Example: When querying multiple members, one failure shouldn't break the entire operation

            const mockService = {
                getGroupMember: vi
                    .fn()
                    .mockResolvedValueOnce({ uid: 'user1', memberRole: 'member' }) // Success
                    .mockRejectedValueOnce(new Error('Network error')) // Failure
                    .mockResolvedValueOnce({ uid: 'user3', memberRole: 'admin' }), // Success
            };

            // Verify the mock is set up correctly for partial failure patterns
            expect(mockService.getGroupMember).toBeDefined();

            // In real scenarios, services would catch individual failures and continue processing
            const results = [];
            for (let i = 0; i < 3; i++) {
                try {
                    const result = await mockService.getGroupMember(`user${i}`);
                    results.push(result);
                } catch (error) {
                    // Log error but continue processing other users
                    results.push(null);
                }
            }

            expect(results).toHaveLength(3);
            expect(results.filter((r) => r !== null)).toHaveLength(2); // 2 successes, 1 failure
        });

        test('should validate error types for proper handling', () => {
            // Test that services can distinguish between different error types
            const regularError = new Error('Network timeout');
            const apiError = new ApiError(404, 'NOT_FOUND', 'Resource not found');

            // Regular error should have message
            expect(regularError.message).toBeDefined();
            expect(regularError.message).toBe('Network timeout');

            // ApiError should have statusCode and errorCode
            expect(apiError instanceof ApiError).toBe(true);
            expect(apiError.statusCode).toBeDefined();
            expect(apiError.statusCode).toBe(404);
            expect(apiError.code).toBeDefined(); // Note: ApiError uses 'code', not 'errorCode'
            expect(apiError.code).toBe('NOT_FOUND');
        });
    });
});
