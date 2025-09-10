import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommentService } from '../../../services/CommentService';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import type { IFirestoreWriter, WriteResult } from '../../../services/firestore/IFirestoreWriter';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreGroupBuilder, FirestoreExpenseBuilder } from '@splitifyd/test-support';

// Create a mock GroupMemberService with the methods CommentService needs
const createMockGroupMemberService = () => ({
    isGroupMemberAsync: vi.fn(),
    // Add other methods that CommentService might call
    getGroupMember: vi.fn(),
    getAllGroupMembers: vi.fn(),
});

describe('CommentService', () => {
    let commentService: CommentService;
    let mockFirestoreReader: MockFirestoreReader;
    let mockFirestoreWriter: IFirestoreWriter;
    let mockGroupMemberService: ReturnType<typeof createMockGroupMemberService>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockFirestoreReader = new MockFirestoreReader();
        mockFirestoreWriter = {
            addComment: vi.fn(),
        } as unknown as IFirestoreWriter;
        mockGroupMemberService = createMockGroupMemberService();
        commentService = new CommentService(mockFirestoreReader, mockFirestoreWriter, mockGroupMemberService as any);
    });

    describe('verifyCommentAccess for GROUP comments', () => {
        it('should allow access when group exists and user is member', async () => {
            const testGroup = new FirestoreGroupBuilder()
                .withId('test-group')
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);

            // Should not throw
            await expect(
                (commentService as any).verifyCommentAccess('group', 'test-group', 'user-id')
            ).resolves.not.toThrow();

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(mockGroupMemberService.isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'user-id');
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                (commentService as any).verifyCommentAccess('group', 'nonexistent-group', 'user-id')
            ).rejects.toThrow(ApiError);

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('nonexistent-group');
        });

        it('should throw FORBIDDEN when user is not a group member', async () => {
            const testGroup = new FirestoreGroupBuilder()
                .withId('test-group')
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(false);

            await expect(
                (commentService as any).verifyCommentAccess('group', 'test-group', 'unauthorized-user')
            ).rejects.toThrow(ApiError);

            const error = await (commentService as any).verifyCommentAccess('group', 'test-group', 'unauthorized-user')
                .catch((e: ApiError) => e);
            
            expect(error.statusCode).toBe(HTTP_STATUS.FORBIDDEN);
        });
    });

    describe('verifyCommentAccess for EXPENSE comments', () => {
        it('should allow access when expense exists and user is group member', async () => {
            const testExpense = new FirestoreExpenseBuilder()
                .withId('test-expense')
                .withGroupId('test-group')
                .build();

            const testGroup = new FirestoreGroupBuilder()
                .withId('test-group')
                .build();

            mockFirestoreReader.getExpense.mockResolvedValue(testExpense);
            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);

            await expect(
                (commentService as any).verifyCommentAccess('expense', 'test-expense', 'user-id', 'test-group')
            ).resolves.not.toThrow();

            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('test-expense');
            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(mockGroupMemberService.isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'user-id');
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            mockFirestoreReader.getExpense.mockResolvedValue(null);

            await expect(
                (commentService as any).verifyCommentAccess('expense', 'nonexistent-expense', 'user-id', 'test-group')
            ).rejects.toThrow(ApiError);

            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('nonexistent-expense');
        });

        it('should throw EXPENSE_GROUP_MISMATCH when expense belongs to different group', async () => {
            const testExpense = new FirestoreExpenseBuilder()
                .withId('test-expense')
                .withGroupId('different-group') // Different from the provided groupId
                .build();

            const testGroup = new FirestoreGroupBuilder()
                .withId('test-group')
                .build();

            mockFirestoreReader.getExpense.mockResolvedValue(testExpense);
            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);

            await expect(
                (commentService as any).verifyCommentAccess('expense', 'test-expense', 'user-id', 'test-group')
            ).rejects.toThrow(ApiError);

            const error = await (commentService as any).verifyCommentAccess('expense', 'test-expense', 'user-id', 'test-group')
                .catch((e: ApiError) => e);
            
            expect(error.message).toContain('does not belong to the specified group');
        });
    });

    describe('dependency injection', () => {
        it('should use injected FirestoreReader for group reads', async () => {
            const testGroup = new FirestoreGroupBuilder()
                .withId('test-group')
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);

            await (commentService as any).verifyCommentAccess('group', 'test-group', 'user-id');

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
        });

        it('should use injected FirestoreReader for expense reads', async () => {
            const testExpense = new FirestoreExpenseBuilder()
                .withId('test-expense')
                .withGroupId('test-group')
                .build();

            mockFirestoreReader.getExpense.mockResolvedValue(testExpense);

            // Test the listComments method which calls getExpense
            await expect(
                (commentService as any).listComments('expense', 'test-expense', 'user-id', { groupId: 'test-group' })
            ).rejects.toThrow(); // Will throw due to incomplete mocking, but we verify the reader call

            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('test-expense');
        });
    });
});