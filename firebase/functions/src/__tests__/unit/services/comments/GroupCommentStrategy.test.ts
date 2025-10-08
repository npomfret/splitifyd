import { GroupDTOBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HTTP_STATUS } from '../../../../constants';
import { GroupCommentStrategy } from '../../../../services/comments/GroupCommentStrategy';
import { ApiError } from '../../../../utils/errors';
import { StubFirestoreReader } from '../../mocks/firestore-stubs';

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
            const testGroup = new GroupDTOBuilder().withId('test-group').build();

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
            const testGroup = new GroupDTOBuilder().withId('test-group').build();

            // Set up group but user is not a member
            stubFirestoreReader.setDocument('groups', 'test-group', testGroup);
            stubGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

            await expect(strategy.verifyAccess('test-group', 'unauthorized-user')).rejects.toThrow(ApiError);

            const error = (await strategy.verifyAccess('test-group', 'unauthorized-user').catch((e: ApiError) => e)) as ApiError;

            expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
            expect(error.code).toBe('ACCESS_DENIED');
        });
    });
});
