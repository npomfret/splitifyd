import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommentService } from '../../../services/CommentService';
import { MockFirestoreReader } from '../../test-utils/MockFirestoreReader';
import type { IFirestoreWriter, WriteResult } from '../../../services/firestore/IFirestoreWriter';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreGroupBuilder, FirestoreExpenseBuilder } from '@splitifyd/test-support';
import { CommentTargetTypes } from '@splitifyd/shared';
import { Timestamp } from 'firebase-admin/firestore';

// Mock getAuth at the module level
vi.mock('../../../firebase', () => ({
    getAuth: () => ({
        getUser: vi.fn().mockResolvedValue({
            displayName: 'Test User',
            email: 'test@example.com',
            photoURL: 'https://example.com/photo.jpg'
        })
    })
}));

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
            addComment: vi.fn().mockResolvedValue({ id: 'mock-comment-id', success: true }),
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
                (commentService as any).verifyCommentAccess(CommentTargetTypes.GROUP, 'test-group', 'user-id')
            ).resolves.not.toThrow();

            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(mockGroupMemberService.isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'user-id');
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                (commentService as any).verifyCommentAccess(CommentTargetTypes.GROUP, 'nonexistent-group', 'user-id')
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
                (commentService as any).verifyCommentAccess(CommentTargetTypes.GROUP, 'test-group', 'unauthorized-user')
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
                (commentService as any).verifyCommentAccess(CommentTargetTypes.EXPENSE, 'test-expense', 'user-id')
            ).resolves.not.toThrow();

            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('test-expense');
            expect(mockFirestoreReader.getGroup).toHaveBeenCalledWith('test-group');
            expect(mockGroupMemberService.isGroupMemberAsync).toHaveBeenCalledWith('test-group', 'user-id');
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            mockFirestoreReader.getExpense.mockResolvedValue(null);

            await expect(
                (commentService as any).verifyCommentAccess(CommentTargetTypes.EXPENSE, 'nonexistent-expense', 'user-id')
            ).rejects.toThrow(ApiError);

            expect(mockFirestoreReader.getExpense).toHaveBeenCalledWith('nonexistent-expense');
        });

    });

    describe('listComments', () => {
        it('should return paginated comments for GROUP target', async () => {
            const testGroup = new FirestoreGroupBuilder()
                .withId('test-group')
                .build();

            const mockComments = [
                {
                    id: 'comment-1',
                    authorId: 'user-1',
                    authorName: 'User 1',
                    authorAvatar: null,
                    text: 'Test comment 1',
                    createdAt: Timestamp.fromDate(new Date('2023-01-01')),
                    updatedAt: Timestamp.fromDate(new Date('2023-01-01'))
                }
            ];

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);
            mockFirestoreReader.getCommentsForTarget.mockResolvedValue({
                comments: mockComments,
                hasMore: false,
                nextCursor: null
            });

            const result = await commentService.listComments(
                CommentTargetTypes.GROUP,
                'test-group',
                'user-id',
                { limit: 10 }
            );

            expect(result.comments).toHaveLength(1);
            expect(result.comments[0].id).toBe('comment-1');
            expect(result.comments[0].text).toBe('Test comment 1');
            expect(result.hasMore).toBe(false);
            
            expect(mockFirestoreReader.getCommentsForTarget).toHaveBeenCalledWith(
                CommentTargetTypes.GROUP,
                'test-group',
                {
                    limit: 10,
                    cursor: undefined,
                    orderBy: 'createdAt',
                    direction: 'desc'
                }
            );
        });

        it('should return paginated comments for EXPENSE target', async () => {
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
            mockFirestoreReader.getCommentsForTarget.mockResolvedValue({
                comments: [],
                hasMore: true,
                nextCursor: 'next-cursor'
            });

            const result = await commentService.listComments(
                CommentTargetTypes.EXPENSE,
                'test-expense',
                'user-id',
                { limit: 5, cursor: 'start-cursor' }
            );

            expect(result.comments).toHaveLength(0);
            expect(result.hasMore).toBe(true);
            expect(result.nextCursor).toBe('next-cursor');
            
            expect(mockFirestoreReader.getCommentsForTarget).toHaveBeenCalledWith(
                CommentTargetTypes.EXPENSE,
                'test-expense',
                {
                    limit: 5,
                    cursor: 'start-cursor',
                    orderBy: 'createdAt',
                    direction: 'desc'
                }
            );
        });

        it('should throw error when user lacks access', async () => {
            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                commentService.listComments(CommentTargetTypes.GROUP, 'nonexistent-group', 'user-id')
            ).rejects.toThrow(ApiError);
        });
    });

    describe('createComment', () => {

        it('should create a GROUP comment successfully', async () => {
            const testGroup = new FirestoreGroupBuilder()
                .withId('test-group')
                .build();

            const createdComment = {
                id: 'new-comment-id',
                authorId: 'user-id',
                authorName: 'Test User',
                authorAvatar: 'https://example.com/photo.jpg',
                text: 'New test comment',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);
            (mockFirestoreWriter.addComment as any).mockResolvedValue({
                id: 'new-comment-id',
                success: true
            });
            mockFirestoreReader.getComment.mockResolvedValue(createdComment);

            const result = await commentService.createComment(
                CommentTargetTypes.GROUP,
                'test-group',
                { text: 'New test comment', targetType: CommentTargetTypes.GROUP, targetId: 'test-group' },
                'user-id'
            );

            expect(result.id).toBe('new-comment-id');
            expect(result.text).toBe('New test comment');
            expect(result.authorId).toBe('user-id');
            expect(result.authorName).toBe('Test User');

            expect(mockFirestoreWriter.addComment).toHaveBeenCalledWith(
                CommentTargetTypes.GROUP,
                'test-group',
                expect.objectContaining({
                    authorId: 'user-id',
                    authorName: 'Test User',
                    text: 'New test comment'
                })
            );
        });

        it('should throw error when comment creation fails', async () => {
            const testGroup = new FirestoreGroupBuilder()
                .withId('test-group')
                .build();

            mockFirestoreReader.getGroup.mockResolvedValue(testGroup);
            mockGroupMemberService.isGroupMemberAsync.mockResolvedValue(true);
            (mockFirestoreWriter.addComment as any).mockResolvedValue({
                id: 'new-comment-id',
                success: true
            });
            mockFirestoreReader.getComment.mockResolvedValue(null); // Simulate creation failure

            await expect(
                commentService.createComment(
                    CommentTargetTypes.GROUP,
                    'test-group',
                    { text: 'Test comment', targetType: CommentTargetTypes.GROUP, targetId: 'test-group' },
                    'user-id'
                )
            ).rejects.toThrow(ApiError);
        });

        it('should throw error when user lacks access', async () => {
            mockFirestoreReader.getGroup.mockResolvedValue(null);

            await expect(
                commentService.createComment(
                    CommentTargetTypes.GROUP,
                    'nonexistent-group',
                    { text: 'Test comment', targetType: CommentTargetTypes.GROUP, targetId: 'nonexistent-group' },
                    'user-id'
                )
            ).rejects.toThrow(ApiError);
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