import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupMemberService } from '../../../services/GroupMemberService';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import type { GroupMemberDocument } from '@splitifyd/shared';

// Create mock services
const createMockUserService = () => ({
    getUsers: vi.fn().mockResolvedValue(new Map()),
    getUser: vi.fn(),
    updateProfile: vi.fn(),
    changePassword: vi.fn(),
    deleteAccount: vi.fn(),
    registerUser: vi.fn(),
    createUserDirect: vi.fn()
});

const createMockNotificationService = () => ({
    initializeUserNotifications: vi.fn(),
    updateUserNotification: vi.fn(),
    getUserNotifications: vi.fn()
});

const createMockGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn(),
    getGroupMember: vi.fn(),
    getAllGroupMembers: vi.fn(),
    getGroupMembersResponseFromSubcollection: vi.fn()
});

describe('GroupMemberService', () => {
    let groupMemberService: GroupMemberService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockUserService: ReturnType<typeof createMockUserService>;
    let mockNotificationService: ReturnType<typeof createMockNotificationService>;
    let mockGroupMemberServiceRef: ReturnType<typeof createMockGroupMemberService>;

    beforeEach(() => {
        mockFirestoreReader = new MockFirestoreReader();
        mockUserService = createMockUserService();
        mockNotificationService = createMockNotificationService();
        mockGroupMemberServiceRef = createMockGroupMemberService();
        groupMemberService = new GroupMemberService(
            mockFirestoreReader,
            {} as any, // mockFirestoreWriter
            mockUserService as any,
            mockNotificationService as any
        );
    });

    // Note: getGroupMembersResponseFromSubcollection method was moved to UserService

    describe('getGroupMember', () => {
        it('should return member if exists', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const testMember = mockFirestoreReader.createTestGroupMemberDocument({
                userId,
                groupId
            });

            mockFirestoreReader.mockMemberInSubcollection(groupId, testMember);

            const result = await groupMemberService.getGroupMember(groupId, userId);

            expect(result).toEqual(testMember);
            expect(mockFirestoreReader.getGroupMember).toHaveBeenCalledWith(groupId, userId);
        });

        it('should return null if member does not exist', async () => {
            const groupId = 'test-group';
            const userId = 'nonexistent-user';

            mockFirestoreReader.getGroupMember.mockResolvedValue(null);

            const result = await groupMemberService.getGroupMember(groupId, userId);

            expect(result).toBeNull();
            expect(mockFirestoreReader.getGroupMember).toHaveBeenCalledWith(groupId, userId);
        });
    });

    describe('getAllGroupMembers', () => {
        it('should return all members for a group', async () => {
            const groupId = 'test-group';
            const testMembers: GroupMemberDocument[] = [
                mockFirestoreReader.createTestGroupMemberDocument({
                    userId: 'user1',
                    groupId
                }),
                mockFirestoreReader.createTestGroupMemberDocument({
                    userId: 'user2',
                    groupId
                })
            ];

            mockFirestoreReader.mockGroupMembersSubcollection(groupId, testMembers);

            const result = await groupMemberService.getAllGroupMembers(groupId);

            expect(result).toEqual(testMembers);
            expect(mockFirestoreReader.getAllGroupMembers).toHaveBeenCalledWith(groupId);
        });
    });
});