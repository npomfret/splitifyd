import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommentService } from '../../../services/CommentService';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import { StubFirestoreReader, StubFirestoreWriter, StubAuthService, clearSharedStorage } from '../mocks/firestore-stubs';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreGroupBuilder, FirestoreExpenseBuilder } from '@splitifyd/test-support';
import { CommentTargetTypes } from '@splitifyd/shared';
import { Timestamp } from 'firebase-admin/firestore';
import type { CommentTargetType, CreateCommentRequest } from '@splitifyd/shared';

// Mock logger
vi.mock('../../../logger', () => ({
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
    },
    LoggerContext: {
        setBusinessContext: vi.fn(),
        clearBusinessContext: vi.fn(),
    },
}));

// Mock the strategy factory for unit tests
const mockStrategy = { verifyAccess: vi.fn() };
vi.mock('../../../services/comments/CommentStrategyFactory', () => ({
    CommentStrategyFactory: class {
        getStrategy() {
            return mockStrategy;
        }
    },
}));

describe('CommentService - Consolidated Tests', () => {
    let commentService: CommentService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;
    let applicationBuilder: ApplicationBuilder;

    beforeEach(() => {
        // Create stubs
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        stubAuth = new StubAuthService();

        // Pass stubs directly to ApplicationBuilder constructor
        applicationBuilder = new ApplicationBuilder(stubReader, stubWriter, stubAuth);
        commentService = applicationBuilder.buildCommentService();

        // Set up test user in auth stub
        stubAuth.setUser('user-id', {
            uid: 'user-id',
            email: 'test@example.com',
            displayName: 'Test User',
            photoURL: 'https://example.com/photo.jpg',
        });

        // Reset mocks
        mockStrategy.verifyAccess.mockResolvedValue(undefined);
        stubAuth.clear();
        clearSharedStorage();
        vi.clearAllMocks();
    });

    describe('verifyCommentAccess for GROUP comments', () => {
        it('should allow access when group exists and user is member', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership
            const membershipDoc = {
                userId: 'user-id',
                groupId: 'test-group',
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', 'test-group_user-id', membershipDoc);

            // Should not throw
            await expect((commentService as any).verifyCommentAccess(CommentTargetTypes.GROUP, 'test-group', 'user-id')).resolves.not.toThrow();
            // Reset mock for next test
            mockStrategy.verifyAccess.mockResolvedValue(undefined);
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            mockStrategy.verifyAccess.mockRejectedValue(new ApiError('Group not found', HTTP_STATUS.NOT_FOUND));
            await expect((commentService as any).verifyCommentAccess(CommentTargetTypes.GROUP, 'nonexistent-group', 'user-id')).rejects.toThrow();
        });

        it('should throw FORBIDDEN when user is not a group member', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();
            stubReader.setDocument('groups', 'test-group', testGroup);
            // Don't set up group membership - user will not be a member
            mockStrategy.verifyAccess.mockRejectedValue(new ApiError('Access forbidden', HTTP_STATUS.FORBIDDEN));

            await expect((commentService as any).verifyCommentAccess(CommentTargetTypes.GROUP, 'test-group', 'unauthorized-user')).rejects.toThrow();
        });
    });

    describe('verifyCommentAccess for EXPENSE comments', () => {
        it('should allow access when expense exists and user is group member', async () => {
            const testExpense = new FirestoreExpenseBuilder().withId('test-expense').withGroupId('test-group').build();
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            stubReader.setDocument('expenses', 'test-expense', testExpense);
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership
            const membershipDoc = {
                userId: 'user-id',
                groupId: 'test-group',
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', 'test-group_user-id', membershipDoc);

            await expect((commentService as any).verifyCommentAccess(CommentTargetTypes.EXPENSE, 'test-expense', 'user-id')).resolves.not.toThrow();
            // Reset mock for next test
            mockStrategy.verifyAccess.mockResolvedValue(undefined);
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            mockStrategy.verifyAccess.mockRejectedValue(new ApiError('Expense not found', HTTP_STATUS.NOT_FOUND));
            await expect((commentService as any).verifyCommentAccess(CommentTargetTypes.EXPENSE, 'nonexistent-expense', 'user-id')).rejects.toThrow();
        });
    });

    describe('listComments', () => {
        it('should return paginated comments for GROUP target', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            const mockComments = [
                {
                    id: 'comment-1',
                    authorId: 'user-1',
                    authorName: 'User 1',
                    authorAvatar: null,
                    text: 'Test comment 1',
                    createdAt: Timestamp.fromDate(new Date('2023-01-01')),
                    updatedAt: Timestamp.fromDate(new Date('2023-01-01')),
                },
            ];

            // Set up test data in stubs
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership for user
            const membershipDoc = {
                userId: 'user-id',
                groupId: 'test-group',
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', 'test-group_user-id', membershipDoc);

            // Mock the getCommentsForTarget method since it's complex
            stubReader.getCommentsForTarget = vi.fn().mockResolvedValue({
                comments: mockComments,
                hasMore: false,
                nextCursor: null,
            });

            const result = await commentService.listComments(CommentTargetTypes.GROUP, 'test-group', 'user-id', { limit: 10 });

            expect(result.comments).toHaveLength(1);
            expect(result.comments[0].id).toBe('comment-1');
            expect(result.comments[0].text).toBe('Test comment 1');
            expect(result.hasMore).toBe(false);
        });

        it('should return paginated comments for EXPENSE target', async () => {
            const testExpense = new FirestoreExpenseBuilder().withId('test-expense').withGroupId('test-group').build();

            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            // Set up test data in stubs
            stubReader.setDocument('expenses', 'test-expense', testExpense);
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership for user
            const membershipDoc = {
                userId: 'user-id',
                groupId: 'test-group',
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', 'test-group_user-id', membershipDoc);

            // Mock the getCommentsForTarget method
            stubReader.getCommentsForTarget = vi.fn().mockResolvedValue({
                comments: [],
                hasMore: true,
                nextCursor: 'next-cursor',
            });

            const result = await commentService.listComments(CommentTargetTypes.EXPENSE, 'test-expense', 'user-id', { limit: 5, cursor: 'start-cursor' });

            expect(result.comments).toHaveLength(0);
            expect(result.hasMore).toBe(true);
            expect(result.nextCursor).toBe('next-cursor');
        });

        it('should throw error when user lacks access', async () => {
            // Mock strategy to reject access
            mockStrategy.verifyAccess.mockRejectedValue(new ApiError('Access denied', HTTP_STATUS.FORBIDDEN));

            await expect(commentService.listComments(CommentTargetTypes.GROUP, 'nonexistent-group', 'user-id')).rejects.toThrow();
        });
    });

    describe('createComment', () => {
        it('should create a GROUP comment successfully', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            const createdComment = {
                id: 'new-comment-id',
                authorId: 'user-id',
                authorName: 'Test User',
                authorAvatar: 'https://example.com/photo.jpg',
                text: 'New test comment',
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            };

            // Set up test data in stubs
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership for user
            const membershipDoc = {
                userId: 'user-id',
                groupId: 'test-group',
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', 'test-group_user-id', membershipDoc);

            // Set up user in auth stub (CommentService calls authService.getUser)
            stubAuth.setUser('user-id', {
                uid: 'user-id',
                email: 'test@example.com',
                displayName: 'Test User',
                photoURL: 'https://example.com/photo.jpg',
            });

            // Mock writer and reader methods
            stubWriter.addComment = vi.fn().mockResolvedValue({
                id: 'new-comment-id',
                success: true,
            });
            stubReader.getComment = vi.fn().mockResolvedValue(createdComment);

            const result = await commentService.createComment(
                CommentTargetTypes.GROUP,
                'test-group',
                { text: 'New test comment', targetType: CommentTargetTypes.GROUP, targetId: 'test-group' },
                'user-id',
            );

            expect(result.id).toBe('new-comment-id');
            expect(result.text).toBe('New test comment');
            expect(result.authorId).toBe('user-id');
            expect(result.authorName).toBe('Test User');
        });

        it('should throw error when comment creation fails', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            // Set up test data in stubs
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership for user
            const membershipDoc = {
                userId: 'user-id',
                groupId: 'test-group',
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', 'test-group_user-id', membershipDoc);

            // Mock writer and reader to simulate creation failure
            stubWriter.addComment = vi.fn().mockResolvedValue({
                id: 'new-comment-id',
                success: true,
            });
            stubReader.getComment = vi.fn().mockResolvedValue(null); // Simulate creation failure

            await expect(
                commentService.createComment(CommentTargetTypes.GROUP, 'test-group', { text: 'Test comment', targetType: CommentTargetTypes.GROUP, targetId: 'test-group' }, 'user-id'),
            ).rejects.toThrow(ApiError);
        });

        it('should throw error when user lacks access', async () => {
            // Don't set up any group data - it will be null by default in stubs

            await expect(
                commentService.createComment(CommentTargetTypes.GROUP, 'nonexistent-group', { text: 'Test comment', targetType: CommentTargetTypes.GROUP, targetId: 'nonexistent-group' }, 'user-id'),
            ).rejects.toThrow(ApiError);
        });
    });

    describe('dependency injection', () => {
        it('should use injected FirestoreReader for group reads', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            // Set up test data in stubs
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership for user
            const membershipDoc = {
                userId: 'user-id',
                groupId: 'test-group',
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', 'test-group_user-id', membershipDoc);

            await (commentService as any).verifyCommentAccess('group', 'test-group', 'user-id');

            // This test verifies the dependency injection is working since it doesn't throw
        });

        it('should use injected FirestoreReader for expense reads', async () => {
            const testExpense = new FirestoreExpenseBuilder().withId('test-expense').withGroupId('test-group').build();
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            // Set up test data in stubs
            stubReader.setDocument('expenses', 'test-expense', testExpense);
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership for user
            const membershipDoc = {
                userId: 'user-id',
                groupId: 'test-group',
                memberRole: 'member',
                memberStatus: 'active',
                joinedAt: new Date().toISOString(),
            };
            stubReader.setDocument('group-members', 'test-group_user-id', membershipDoc);

            // Mock the getCommentsForTarget method to avoid further complexity
            stubReader.getCommentsForTarget = vi.fn().mockResolvedValue({
                comments: [],
                hasMore: false,
                nextCursor: null,
            });

            // Test should now pass since all dependencies are set up
            const result = await commentService.listComments(CommentTargetTypes.EXPENSE, 'test-expense', 'user-id');

            // Verify it worked
            expect(result.comments).toEqual([]);
        });
    });

    describe('Unit Test Scenarios - Error Handling and Edge Cases', () => {
        let unitCommentService: CommentService;

        beforeEach(() => {
            // Create a separate service instance for unit tests with direct injection
            unitCommentService = new CommentService(
                stubReader,
                stubWriter,
                {} as any, // GroupMemberService not used in these tests
                stubAuth,
            );
        });

        describe('createComment - Unit Scenarios', () => {
            it('should create a comment successfully with mocked strategy', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';
                const commentData: CreateCommentRequest = {
                    text: 'Test comment',
                    targetType,
                    targetId,
                };

                // Set up auth user
                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });

                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, true);

                const result = await unitCommentService.createComment(targetType, targetId, commentData, userId);

                expect(result).toMatchObject({
                    id: expect.any(String),
                    authorId: userId,
                    authorName: 'Test User',
                    text: 'Test comment',
                    createdAt: expect.any(String),
                });
            });

            it('should handle user with email fallback for display name', async () => {
                const userId = 'user-456';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-789';
                const commentData: CreateCommentRequest = {
                    text: 'Comment from user without display name',
                    targetType,
                    targetId,
                };

                // Set up auth user without displayName
                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'user456@example.com',
                    // No displayName
                });

                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, true);

                const result = await unitCommentService.createComment(targetType, targetId, commentData, userId);

                expect(result.authorName).toBe('user456');
            });

            it('should throw error when user not found', async () => {
                const userId = 'nonexistent-user';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-123';
                const commentData: CreateCommentRequest = {
                    text: 'Test comment',
                    targetType,
                    targetId,
                };

                // User not set in stubAuth

                await expect(
                    unitCommentService.createComment(targetType, targetId, commentData, userId)
                ).rejects.toThrow(ApiError);
            });

            it('should throw error when access verification fails', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';
                const commentData: CreateCommentRequest = {
                    text: 'Test comment',
                    targetType,
                    targetId,
                };

                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });

                // Mock strategy to reject access
                mockStrategy.verifyAccess.mockRejectedValue(new ApiError('Access denied', HTTP_STATUS.FORBIDDEN));

                await expect(
                    unitCommentService.createComment(targetType, targetId, commentData, userId)
                ).rejects.toThrow(ApiError);
            });

            it('should handle firestore write failures', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';
                const commentData: CreateCommentRequest = {
                    text: 'Test comment',
                    targetType,
                    targetId,
                };

                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });

                // Mock firestore write to fail
                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, false, 'Write failed');

                await expect(
                    unitCommentService.createComment(targetType, targetId, commentData, userId)
                ).rejects.toThrow('Write failed');
            });
        });

        describe('listComments - Unit Scenarios', () => {
            it('should list comments successfully', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';

                // Mock existing comments
                const mockComments = [
                    {
                        id: 'comment-1',
                        authorId: 'user-123',
                        authorName: 'Test User',
                        text: 'First comment',
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                    },
                    {
                        id: 'comment-2',
                        authorId: 'user-456',
                        authorName: 'Another User',
                        text: 'Second comment',
                        createdAt: Timestamp.now(),
                        updatedAt: Timestamp.now(),
                    },
                ];

                stubReader.setCommentsForTarget(targetType, targetId, mockComments);

                const result = await unitCommentService.listComments(targetType, targetId, userId);

                expect(result).toMatchObject({
                    comments: expect.arrayContaining([
                        expect.objectContaining({ id: 'comment-1', text: 'First comment' }),
                        expect.objectContaining({ id: 'comment-2', text: 'Second comment' }),
                    ]),
                    hasMore: false,
                });
            });

            it('should return empty list when no comments exist', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';

                stubReader.setCommentsForTarget(targetType, targetId, []);

                const result = await unitCommentService.listComments(targetType, targetId, userId);

                expect(result.comments).toEqual([]);
                expect(result.hasMore).toBe(false);
            });

            it('should throw error when access verification fails', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';

                // Mock strategy to reject access
                mockStrategy.verifyAccess.mockRejectedValue(new ApiError('Access denied', HTTP_STATUS.FORBIDDEN));

                await expect(
                    unitCommentService.listComments(targetType, targetId, userId)
                ).rejects.toThrow(ApiError);
            });
        });

        describe('Target type support - Unit Scenarios', () => {
            it('should support group comments', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';
                const commentData: CreateCommentRequest = {
                    text: 'Group comment',
                    targetType,
                    targetId,
                };

                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });
                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, true);

                const result = await unitCommentService.createComment(targetType, targetId, commentData, userId);

                expect(result.text).toBe('Group comment');
                expect(mockStrategy.verifyAccess).toHaveBeenCalledWith(targetId, userId);
            });

            it('should support expense comments', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'expense';
                const targetId = 'expense-456';
                const commentData: CreateCommentRequest = {
                    text: 'Expense comment',
                    targetType,
                    targetId,
                };

                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });
                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, true);

                const result = await unitCommentService.createComment(targetType, targetId, commentData, userId);

                expect(result.text).toBe('Expense comment');
                expect(mockStrategy.verifyAccess).toHaveBeenCalledWith(targetId, userId);
            });
        });

        describe('Integration scenarios', () => {
            it('should maintain consistency between create and list operations', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';
                const commentData: CreateCommentRequest = {
                    text: 'Consistency test comment',
                    targetType,
                    targetId,
                };

                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });
                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, true);

                // Create the comment
                const createdComment = await unitCommentService.createComment(targetType, targetId, commentData, userId);

                // List comments to verify consistency
                const listedComments = await unitCommentService.listComments(targetType, targetId, userId);

                expect(listedComments.comments).toHaveLength(1);
                expect(listedComments.comments[0]).toMatchObject({
                    authorId: createdComment.authorId,
                    authorName: createdComment.authorName,
                    text: createdComment.text,
                });
            });
        });
    });
});
