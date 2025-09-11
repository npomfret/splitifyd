import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupCommentStrategy } from '../../../../services/comments/GroupCommentStrategy';
import { MockFirestoreReader } from '../../../test-utils/MockFirestoreReader';
import { ApiError } from '../../../../utils/errors';
import { HTTP_STATUS } from '../../../../constants';
import { FirestoreGroupBuilder } from '@splitifyd/test-support';
import { FirestoreCollections } from '@splitifyd/shared';

const createMockGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn(),
    getGroupMember: vi.fn(),
    getAllGroupMembers: vi.fn(),
});

describe('GroupCommentStrategy', () => {
    let strategy: GroupCommentStrategy;
    let mockFirestoreReader: MockFirestoreReader;
    let mockGroupMemberService: ReturnType<typeof createMockGroupMemberService>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFirestoreReader = new MockFirestoreReader();
        mockGroupMemberService = createMockGroupMemberService();
        strategy = new GroupCommentStrategy(mockFirestoreReader, mockGroupMemberService as any);
    });

    describe('verifyAccess', () => {
        it('should allow access when group exists and user is member', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);

            await expect(strategy.verifyAccess('test-group', 'user-id')).resolves.not.toThrow();

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(mockGroupMemberService.isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'user-id');
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(strategy.verifyAccess('nonexistent-group', 'user-id')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('nonexistent-group', 'user-id').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('GROUP_NOT_FOUND');
            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('nonexistent-group');
        });

        it('should throw FORBIDDEN when user is not a group member', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

            await expect(strategy.verifyAccess('test-group', 'unauthorized-user')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('test-group', 'unauthorized-user').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
            expect(error.code).toBe('ACCESS_DENIED');
        });
    });

    describe('resolveGroupId', () => {
        it('should return the targetId directly for group comments', async () => {
            const groupId = 'test-group-123';

            const result = await strategy.resolveGroupId(groupId);

            expect(result).toBe(groupId);
        });
    });

    describe('getCollectionPath', () => {
        it('should generate correct Firestore collection path for group comments', () => {
            const groupId = 'test-group-456';

            const path = strategy.getCollectionPath(groupId);

            expect(path).toBe(`${FirestoreCollections.GROUPS}/${groupId}/${FirestoreCollections.COMMENTS}`);
            expect(path).toBe(`groups/${groupId}/comments`);
        });

        it('should handle different group IDs correctly', () => {
            const groupIds = ['group-1', 'group-abc', 'group-with-special-chars'];

            groupIds.forEach((groupId) => {
                const path = strategy.getCollectionPath(groupId);
                expect(path).toBe(`groups/${groupId}/comments`);
            });
        });
    });
});
