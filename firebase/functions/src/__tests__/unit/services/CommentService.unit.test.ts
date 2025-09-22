import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { CommentService } from '../../../services/CommentService';
import { StubFirestoreReader, StubFirestoreWriter, StubAuthService, clearSharedStorage } from '../mocks/firestore-stubs';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import type { CommentTargetType, CreateCommentRequest } from '@splitifyd/shared';

// Mock the strategy factory
const mockStrategy = { verifyAccess: vi.fn() };
vi.mock('../../../services/comments/CommentStrategyFactory', () => ({
    CommentStrategyFactory: class {
        getStrategy() { return mockStrategy; }
    }
}));

describe('CommentService - Unit Tests', () => {
    let commentService: CommentService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        stubAuth = new StubAuthService();

        commentService = new CommentService(
            stubReader,
            stubWriter,
            {} as any, // GroupMemberService not used in these tests
            stubAuth,
        );

        mockStrategy.verifyAccess.mockResolvedValue(undefined);
        stubAuth.clear();
        clearSharedStorage();
    });

    describe('createComment', () => {
        it('should create a comment successfully', async () => {
            const userId = 'user-123';
            const targetType: CommentTargetType = 'group';
            const targetId = 'group-456';
            const commentData: CreateCommentRequest = {
                text: 'Test comment',
                targetType,
                targetId,
            };

            // Setup
            stubAuth.setUser(userId, {
                uid: userId,
                displayName: 'Test User',
                email: 'test@example.com',
                photoURL: 'https://example.com/avatar.jpg',
            });
            stubReader.setCommentsForTarget(targetType, targetId, [
                {
                    id: 'comment-123',
                    authorId: userId,
                    authorName: 'Test User',
                    authorAvatar: 'https://example.com/avatar.jpg',
                    text: 'Test comment',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                }
            ]);

            const result = await commentService.createComment(targetType, targetId, commentData, userId);

            expect(result).toMatchObject({
                id: expect.any(String),
                authorId: userId,
                authorName: 'Test User',
                text: 'Test comment',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            });
            expect(mockStrategy.verifyAccess).toHaveBeenCalledWith(targetId, userId);
        });

        it('should handle user with email fallback for display name', async () => {
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
                email: 'john.doe@example.com',
                // No displayName
            });
            stubReader.setCommentsForTarget(targetType, targetId, [
                {
                    id: 'comment-123',
                    authorId: userId,
                    authorName: 'john.doe',
                    authorAvatar: null,
                    text: 'Test comment',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                }
            ]);

            const result = await commentService.createComment(targetType, targetId, commentData, userId);

            expect(result.authorName).toBe('john.doe');
            expect(result.authorAvatar).toBeUndefined();
        });

        it('should throw error when user not found', async () => {
            const userId = 'nonexistent-user';
            const targetType: CommentTargetType = 'group';
            const targetId = 'group-456';
            const commentData: CreateCommentRequest = {
                text: 'Test comment',
                targetType,
                targetId,
            };

            await expect(commentService.createComment(targetType, targetId, commentData, userId))
                .rejects.toThrow(expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                    code: 'USER_NOT_FOUND'
                }));
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

            stubAuth.setUser(userId, { uid: userId, displayName: 'Test User' });
            mockStrategy.verifyAccess.mockRejectedValue(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'Access denied')
            );

            await expect(commentService.createComment(targetType, targetId, commentData, userId))
                .rejects.toThrow(expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                    code: 'ACCESS_DENIED'
                }));
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

            stubAuth.setUser(userId, { uid: userId, displayName: 'Test User' });
            stubWriter.setWriteResult('comment-123', false, 'Database error');

            await expect(commentService.createComment(targetType, targetId, commentData, userId))
                .rejects.toThrow('Database error');
        });
    });

    describe('listComments', () => {
        it('should list comments successfully', async () => {
            const userId = 'user-123';
            const targetType: CommentTargetType = 'group';
            const targetId = 'group-456';

            const mockComments = [
                {
                    id: 'comment-1',
                    authorId: 'user-1',
                    authorName: 'User One',
                    authorAvatar: null,
                    text: 'First comment',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                },
                {
                    id: 'comment-2',
                    authorId: 'user-2',
                    authorName: 'User Two',
                    authorAvatar: 'https://example.com/avatar.jpg',
                    text: 'Second comment',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                }
            ];

            stubReader.setCommentsForTarget(targetType, targetId, mockComments);

            const result = await commentService.listComments(targetType, targetId, userId);

            expect(result.comments).toHaveLength(2);
            expect(result.comments[0]).toMatchObject({
                id: 'comment-1',
                authorId: 'user-1',
                authorName: 'User One',
                text: 'First comment',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            });
            expect(result.comments[0].authorAvatar).toBeUndefined(); // null -> undefined
            expect(result.comments[1].authorAvatar).toBe('https://example.com/avatar.jpg');
            expect(result.hasMore).toBe(false);
            expect(mockStrategy.verifyAccess).toHaveBeenCalledWith(targetId, userId);
        });

        it('should return empty list when no comments exist', async () => {
            const userId = 'user-123';
            const targetType: CommentTargetType = 'group';
            const targetId = 'group-456';

            const result = await commentService.listComments(targetType, targetId, userId);

            expect(result.comments).toHaveLength(0);
            expect(result.hasMore).toBe(false);
        });

        it('should throw error when access verification fails', async () => {
            const userId = 'user-123';
            const targetType: CommentTargetType = 'group';
            const targetId = 'group-456';

            mockStrategy.verifyAccess.mockRejectedValue(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'ACCESS_DENIED', 'Access denied')
            );

            await expect(commentService.listComments(targetType, targetId, userId))
                .rejects.toThrow(expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                    code: 'ACCESS_DENIED'
                }));
        });
    });

    describe('Target type support', () => {
        it('should support group comments', async () => {
            const userId = 'user-123';
            const targetType: CommentTargetType = 'group';
            const targetId = 'group-456';

            stubReader.setCommentsForTarget(targetType, targetId, []);

            await commentService.listComments(targetType, targetId, userId);

            expect(mockStrategy.verifyAccess).toHaveBeenCalledWith(targetId, userId);
        });

        it('should support expense comments', async () => {
            const userId = 'user-123';
            const targetType: CommentTargetType = 'expense';
            const targetId = 'expense-789';

            stubReader.setCommentsForTarget(targetType, targetId, []);

            await commentService.listComments(targetType, targetId, userId);

            expect(mockStrategy.verifyAccess).toHaveBeenCalledWith(targetId, userId);
        });
    });

    describe('Comment validation and business logic', () => {
        it('should handle anonymous author names for users without display name or email', async () => {
            const userId = 'user-anonymous';
            const targetType: CommentTargetType = 'group';
            const targetId = 'group-456';
            const commentData: CreateCommentRequest = {
                text: 'Anonymous comment',
                targetType,
                targetId,
            };

            // User without displayName or email
            stubAuth.setUser(userId, {
                uid: userId,
                // No displayName, no email
            });

            stubReader.setCommentsForTarget(targetType, targetId, [
                {
                    id: 'comment-anonymous',
                    authorId: userId,
                    authorName: 'Anonymous',
                    authorAvatar: null,
                    text: 'Anonymous comment',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                }
            ]);

            const result = await commentService.createComment(targetType, targetId, commentData, userId);

            expect(result.authorName).toBe('Anonymous');
        });

        it('should handle long comment text within limits', async () => {
            const userId = 'user-123';
            const targetType: CommentTargetType = 'group';
            const targetId = 'group-456';
            const longText = 'This is a very long comment '.repeat(20); // Realistic length
            const commentData: CreateCommentRequest = {
                text: longText,
                targetType,
                targetId,
            };

            stubAuth.setUser(userId, {
                uid: userId,
                displayName: 'Test User',
                email: 'test@example.com',
            });

            stubReader.setCommentsForTarget(targetType, targetId, [
                {
                    id: 'comment-long',
                    authorId: userId,
                    authorName: 'Test User',
                    authorAvatar: null,
                    text: longText,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                }
            ]);

            const result = await commentService.createComment(targetType, targetId, commentData, userId);

            expect(result.text).toBe(longText);
            expect(result.text.length).toBeGreaterThan(100);
        });

        it('should handle comment creation with all optional fields', async () => {
            const userId = 'user-complete';
            const targetType: CommentTargetType = 'expense';
            const targetId = 'expense-789';
            const commentData: CreateCommentRequest = {
                text: 'Complete comment with all data',
                targetType,
                targetId,
            };

            stubAuth.setUser(userId, {
                uid: userId,
                displayName: 'Complete User',
                email: 'complete@example.com',
                photoURL: 'https://example.com/complete-avatar.jpg',
                emailVerified: true,
            });

            stubReader.setCommentsForTarget(targetType, targetId, [
                {
                    id: 'comment-complete',
                    authorId: userId,
                    authorName: 'Complete User',
                    authorAvatar: 'https://example.com/complete-avatar.jpg',
                    text: 'Complete comment with all data',
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                }
            ]);

            const result = await commentService.createComment(targetType, targetId, commentData, userId);

            expect(result).toMatchObject({
                id: expect.any(String),
                authorId: userId,
                authorName: 'Complete User',
                authorAvatar: 'https://example.com/complete-avatar.jpg',
                text: 'Complete comment with all data',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            });
        });

        it('should maintain consistency between creation and listing', async () => {
            const userId = 'user-consistency';
            const targetType: CommentTargetType = 'group';
            const targetId = 'group-consistency';
            const commentText = 'Consistency test comment';

            stubAuth.setUser(userId, {
                uid: userId,
                displayName: 'Consistency User',
                email: 'consistency@example.com',
            });

            const commentData: CreateCommentRequest = {
                text: commentText,
                targetType,
                targetId,
            };

            // Don't pre-populate comments - let the creation add it

            // Create the comment
            const createdComment = await commentService.createComment(targetType, targetId, commentData, userId);

            // List comments to verify consistency
            const listedComments = await commentService.listComments(targetType, targetId, userId);

            expect(listedComments.comments).toHaveLength(1);
            expect(listedComments.comments[0]).toMatchObject({
                authorId: createdComment.authorId,
                authorName: createdComment.authorName,
                text: createdComment.text,
            });
        });
    });
});