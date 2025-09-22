import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { CommentService } from '../../../services/CommentService';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import type { CommentTargetType, CreateCommentRequest } from '@splitifyd/shared';

// Simple in-memory stubs for testing
class TestFirestoreReader {
    private comments = new Map<string, any[]>();

    setCommentsForTarget(targetType: CommentTargetType, targetId: string, comments: any[]) {
        this.comments.set(`${targetType}:${targetId}`, comments);
    }

    async getCommentsForTarget(targetType: CommentTargetType, targetId: string, options: any) {
        const comments = this.comments.get(`${targetType}:${targetId}`) || [];
        return { comments, hasMore: false, nextCursor: null };
    }

    async getComment(targetType: CommentTargetType, targetId: string, commentId: string) {
        const comments = this.comments.get(`${targetType}:${targetId}`) || [];
        return comments.find(c => c.id === commentId) || null;
    }
}

class TestFirestoreWriter {
    private nextResult: { id: string; success: boolean; error?: string } = { id: 'comment-123', success: true };

    setNextWriteResult(id: string, success: boolean, error?: string) {
        this.nextResult = { id, success, error };
    }

    async addComment(targetType: CommentTargetType, targetId: string, commentData: any) {
        if (!this.nextResult.success) {
            throw new Error(this.nextResult.error || 'Write failed');
        }
        return { id: this.nextResult.id, success: true, timestamp: Timestamp.now() };
    }
}

class TestAuthService {
    private users = new Map<string, any>();

    setUser(userId: string, user: any) {
        this.users.set(userId, user);
    }

    async getUser(userId: string) {
        return this.users.get(userId) || null;
    }
}

// Mock the strategy factory
const mockStrategy = { verifyAccess: vi.fn() };
vi.mock('../../../services/comments/CommentStrategyFactory', () => ({
    CommentStrategyFactory: class {
        getStrategy() { return mockStrategy; }
    }
}));

describe('CommentService - Unit Tests', () => {
    let commentService: CommentService;
    let testReader: TestFirestoreReader;
    let testWriter: TestFirestoreWriter;
    let testAuthService: TestAuthService;

    beforeEach(() => {
        testReader = new TestFirestoreReader();
        testWriter = new TestFirestoreWriter();
        testAuthService = new TestAuthService();

        commentService = new CommentService(
            testReader as any,
            testWriter as any,
            {} as any, // GroupMemberService not used in these tests
            testAuthService as any,
        );

        mockStrategy.verifyAccess.mockResolvedValue(undefined);
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
            testAuthService.setUser(userId, {
                uid: userId,
                displayName: 'Test User',
                email: 'test@example.com',
                photoURL: 'https://example.com/avatar.jpg',
            });
            testReader.setCommentsForTarget(targetType, targetId, [
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
                id: 'comment-123',
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

            testAuthService.setUser(userId, {
                uid: userId,
                email: 'john.doe@example.com',
                // No displayName
            });
            testReader.setCommentsForTarget(targetType, targetId, [
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

            testAuthService.setUser(userId, { uid: userId, displayName: 'Test User' });
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

            testAuthService.setUser(userId, { uid: userId, displayName: 'Test User' });
            testWriter.setNextWriteResult('comment-123', false, 'Database error');

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

            testReader.setCommentsForTarget(targetType, targetId, mockComments);

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

            testReader.setCommentsForTarget(targetType, targetId, []);

            await commentService.listComments(targetType, targetId, userId);

            expect(mockStrategy.verifyAccess).toHaveBeenCalledWith(targetId, userId);
        });

        it('should support expense comments', async () => {
            const userId = 'user-123';
            const targetType: CommentTargetType = 'expense';
            const targetId = 'expense-789';

            testReader.setCommentsForTarget(targetType, targetId, []);

            await commentService.listComments(targetType, targetId, userId);

            expect(mockStrategy.verifyAccess).toHaveBeenCalledWith(targetId, userId);
        });
    });
});