import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import { StubFirestoreWriter } from '../mocks/firestore-stubs';
import { ApiError } from '../../../utils/errors';
import type { GroupMemberDocument } from '@splitifyd/shared';

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

describe('GroupMemberService Unit Tests', () => {
    let groupMemberService: GroupMemberService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockFirestoreWriter: StubFirestoreWriter;
    let mockUserService: ReturnType<typeof createMockUserService>;

    const testGroupId = 'test-group-id';
    const testUserId1 = 'user-1';
    const testUserId2 = 'user-2';
    const testUserId3 = 'user-3';

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        mockFirestoreWriter = new StubFirestoreWriter();
        mockUserService = createMockUserService();

        // Setup test group
        const testGroup = MockFirestoreReader.createTestGroup(testGroupId, {
            name: 'Test Group',
            memberCount: 3,
        });
        mockFirestoreReader.getGroup.mockResolvedValue(testGroup);

        groupMemberService = new GroupMemberService(
            mockFirestoreReader,
            mockFirestoreWriter,
            mockUserService as any,
        );
    });

    describe('getGroupMember', () => {
        it('should return member if exists', async () => {
            const testMember = mockFirestoreReader.createTestGroupMemberDocument({
                userId: testUserId1,
                groupId: testGroupId,
            });

            mockFirestoreReader.mockMemberInSubcollection(testGroupId, testMember);

            const result = await groupMemberService.getGroupMember(testGroupId, testUserId1);

            expect(result).toEqual(testMember);
            expect(mockFirestoreReader.getGroupMember).toHaveBeenCalledWith(testGroupId, testUserId1);
        });

        it('should return null if member does not exist', async () => {
            const nonExistentUserId = 'nonexistent-user';

            mockFirestoreReader.getGroupMember.mockResolvedValue(null);

            const result = await groupMemberService.getGroupMember(testGroupId, nonExistentUserId);

            expect(result).toBeNull();
            expect(mockFirestoreReader.getGroupMember).toHaveBeenCalledWith(testGroupId, nonExistentUserId);
        });

        it('should handle invalid group ID', async () => {
            const invalidGroupId = '';

            mockFirestoreReader.getGroupMember.mockResolvedValue(null);

            const result = await groupMemberService.getGroupMember(invalidGroupId, testUserId1);

            expect(result).toBeNull();
        });

        it('should handle invalid user ID', async () => {
            const invalidUserId = '';

            mockFirestoreReader.getGroupMember.mockResolvedValue(null);

            const result = await groupMemberService.getGroupMember(testGroupId, invalidUserId);

            expect(result).toBeNull();
        });
    });

    describe('getAllGroupMembers', () => {
        it('should return all members for a group', async () => {
            const testMembers: GroupMemberDocument[] = [
                mockFirestoreReader.createTestGroupMemberDocument({
                    userId: testUserId1,
                    groupId: testGroupId,
                }),
                mockFirestoreReader.createTestGroupMemberDocument({
                    userId: testUserId2,
                    groupId: testGroupId,
                }),
                mockFirestoreReader.createTestGroupMemberDocument({
                    userId: testUserId3,
                    groupId: testGroupId,
                }),
            ];

            mockFirestoreReader.mockGroupMembersSubcollection(testGroupId, testMembers);

            const result = await groupMemberService.getAllGroupMembers(testGroupId);

            expect(result).toEqual(testMembers);
            expect(result).toHaveLength(3);
            expect(mockFirestoreReader.getAllGroupMembers).toHaveBeenCalledWith(testGroupId);
        });

        it('should return empty array for group with no members', async () => {
            mockFirestoreReader.mockGroupMembersSubcollection(testGroupId, []);

            const result = await groupMemberService.getAllGroupMembers(testGroupId);

            expect(result).toEqual([]);
            expect(result).toHaveLength(0);
            expect(mockFirestoreReader.getAllGroupMembers).toHaveBeenCalledWith(testGroupId);
        });

        it('should handle invalid group ID', async () => {
            const invalidGroupId = '';

            mockFirestoreReader.getAllGroupMembers.mockResolvedValue([]);

            const result = await groupMemberService.getAllGroupMembers(invalidGroupId);

            expect(result).toEqual([]);
        });
    });

    describe('isGroupMemberAsync', () => {
        it('should return true for existing group member', async () => {
            const testMember = mockFirestoreReader.createTestGroupMemberDocument({
                userId: testUserId1,
                groupId: testGroupId,
            });

            mockFirestoreReader.mockMemberInSubcollection(testGroupId, testMember);

            const result = await groupMemberService.isGroupMemberAsync(testGroupId, testUserId1);

            expect(result).toBe(true);
            expect(mockFirestoreReader.getGroupMember).toHaveBeenCalledWith(testGroupId, testUserId1);
        });

        it('should return false for non-existent group member', async () => {
            const nonExistentUserId = 'nonexistent-user';

            mockFirestoreReader.getGroupMember.mockResolvedValue(null);

            const result = await groupMemberService.isGroupMemberAsync(testGroupId, nonExistentUserId);

            expect(result).toBe(false);
            expect(mockFirestoreReader.getGroupMember).toHaveBeenCalledWith(testGroupId, nonExistentUserId);
        });

        it('should return false for invalid group ID', async () => {
            const invalidGroupId = '';

            mockFirestoreReader.getGroupMember.mockResolvedValue(null);

            const result = await groupMemberService.isGroupMemberAsync(invalidGroupId, testUserId1);

            expect(result).toBe(false);
        });

        it('should return false for invalid user ID', async () => {
            const invalidUserId = '';

            mockFirestoreReader.getGroupMember.mockResolvedValue(null);

            const result = await groupMemberService.isGroupMemberAsync(testGroupId, invalidUserId);

            expect(result).toBe(false);
        });
    });

    describe('member document structure validation', () => {
        it('should handle member documents with all required fields', async () => {
            const completeMember = mockFirestoreReader.createTestGroupMemberDocument({
                userId: testUserId1,
                groupId: testGroupId,
                memberRole: 'member',
            });

            mockFirestoreReader.mockMemberInSubcollection(testGroupId, completeMember);

            const result = await groupMemberService.getGroupMember(testGroupId, testUserId1);

            expect(result).toBeDefined();
            expect(result?.userId).toBe(testUserId1);
            expect(result?.groupId).toBe(testGroupId);
            expect(result?.memberRole).toBe('member');
            expect(result?.joinedAt).toBeDefined();
        });

        it('should handle member documents with admin role', async () => {
            const adminMember = mockFirestoreReader.createTestGroupMemberDocument({
                userId: testUserId1,
                groupId: testGroupId,
                memberRole: 'admin',
            });

            mockFirestoreReader.mockMemberInSubcollection(testGroupId, adminMember);

            const result = await groupMemberService.getGroupMember(testGroupId, testUserId1);

            expect(result).toBeDefined();
            expect(result?.memberRole).toBe('admin');
        });
    });

    describe('error handling', () => {
        it('should handle Firestore errors gracefully', async () => {
            mockFirestoreReader.getGroupMember.mockRejectedValue(new Error('Firestore error'));

            await expect(groupMemberService.getGroupMember(testGroupId, testUserId1)).rejects.toThrow('Firestore error');
        });

        it('should handle network errors gracefully', async () => {
            mockFirestoreReader.getAllGroupMembers.mockRejectedValue(new Error('Network error'));

            await expect(groupMemberService.getAllGroupMembers(testGroupId)).rejects.toThrow('Network error');
        });
    });
});
