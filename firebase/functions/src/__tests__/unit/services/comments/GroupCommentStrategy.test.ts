import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroupCommentStrategy } from '../../../../services/comments/GroupCommentStrategy';
import { StubFirestoreReader } from '../../mocks/firestore-stubs';
import { ApiError } from '../../../../utils/errors';
import { HTTP_STATUS } from '../../../../constants';
import { GroupBuilder } from '@splitifyd/test-support';
import { FirestoreCollections } from '@splitifyd/shared';

const createStubGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn(),
    getGroupMember: vi.fn(),
    getAllGroupMembers: vi.fn(),
});

describe('GroupCommentStrategy', () => {
    let strategy: GroupCommentStrategy;
    let stubFirestoreReader: StubFirestoreReader;
    let stubGroupMemberService: ReturnType<typeof createStubGroupMemberService>;

    beforeEach(() => {
        stubFirestoreReader = new StubFirestoreReader();
        stubGroupMemberService = createStubGroupMemberService();
        strategy = new GroupCommentStrategy(stubFirestoreReader, stubGroupMemberService as any);
    });

    describe('verifyAccess', () => {
        it('should allow access when group exists and user is member', async () => {
            const testGroup = new GroupBuilder().withId('test-group').build();

            // Simple stub data setup
            stubFirestoreReader.setDocument('groups', 'test-group', testGroup);
            stubGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);

            await expect(strategy.verifyAccess('test-group', 'user-id')).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            // No need to set up anything - stub returns null by default for non-existent documents

            await expect(strategy.verifyAccess('nonexistent-group', 'user-id')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('nonexistent-group', 'user-id').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.NOT_FOUND);
            expect(error.code).toBe('GROUP_NOT_FOUND');
        });

        it('should throw FORBIDDEN when user is not a group member', async () => {
            const testGroup = new GroupBuilder().withId('test-group').build();

            // Set up group but user is not a member
            stubFirestoreReader.setDocument('groups', 'test-group', testGroup);
            stubGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

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
