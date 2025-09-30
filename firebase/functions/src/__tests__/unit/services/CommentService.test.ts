import { describe, it, beforeEach, expect, vi } from 'vitest';
import { CommentService } from '../../../services/CommentService';
import { ApplicationBuilder } from '../../../services/ApplicationBuilder';
import {
    StubFirestoreReader,
    StubFirestoreWriter,
    StubAuthService,
    clearSharedStorage
} from '../mocks/firestore-stubs';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import { FirestoreGroupBuilder, FirestoreExpenseBuilder, GroupMemberDocumentBuilder, CommentBuilder, CommentRequestBuilder } from '@splitifyd/test-support';
import { CommentTargetTypes } from '@splitifyd/shared';
import { Timestamp } from 'firebase-admin/firestore';
import type { CommentTargetType, CreateCommentRequest } from '@splitifyd/shared';
import { validateCreateComment, validateListCommentsQuery, validateTargetId, validateCommentId } from '../../../comments/validation';

describe('CommentService - Consolidated Tests', () => {
    let commentService: CommentService;
    let stubReader: StubFirestoreReader;
    let stubWriter: StubFirestoreWriter;
    let stubAuth: StubAuthService;

    beforeEach(() => {
        stubReader = new StubFirestoreReader();
        stubWriter = new StubFirestoreWriter();
        stubAuth = new StubAuthService();

        const applicationBuilder = new ApplicationBuilder(stubReader, stubWriter, stubAuth);

        commentService = applicationBuilder.buildCommentService();

        // Set up test user in auth stub
        stubAuth.setUser('user-id', {
            uid: 'user-id',
            email: 'test@example.com',
            displayName: 'Test User',
            photoURL: 'https://example.com/photo.jpg',
        });

        // Reset mocks
        stubAuth.clear();
        clearSharedStorage();
        vi.clearAllMocks();
    });

    describe('verifyCommentAccess for GROUP comments', () => {
        it('should allow access when group exists and user is member', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership
            const membershipDoc = new GroupMemberDocumentBuilder().withUserId('user-id').withGroupId('test-group')
                .build();
            stubReader.setDocument('group-members', 'test-group_user-id', membershipDoc);

            // Should not throw
            await expect((commentService as any).verifyCommentAccess(CommentTargetTypes.GROUP, 'test-group', 'user-id')).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when group does not exist', async () => {
            // No group data set up, so verification should fail
            await expect((commentService as any).verifyCommentAccess(CommentTargetTypes.GROUP, 'nonexistent-group', 'user-id')).rejects.toThrow();
        });

        it('should throw FORBIDDEN when user is not a group member', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();
            stubReader.setDocument('groups', 'test-group', testGroup);
            // Don't set up group membership - user will not be a member

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
            const membershipDoc = new GroupMemberDocumentBuilder().withUserId('user-id').withGroupId('test-group')
                .build();
            stubReader.setDocument('group-members', 'test-group_user-id', membershipDoc);

            await expect((commentService as any).verifyCommentAccess(CommentTargetTypes.EXPENSE, 'test-expense', 'user-id')).resolves.not.toThrow();
        });

        it('should throw NOT_FOUND when expense does not exist', async () => {
            // No expense data set up, so verification should fail
            await expect((commentService as any).verifyCommentAccess(CommentTargetTypes.EXPENSE, 'nonexistent-expense', 'user-id')).rejects.toThrow();
        });
    });

    describe('listComments', () => {
        it('should return paginated comments for GROUP target', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            const mockComments = [
                new CommentBuilder()
                    .withId('comment-1')
                    .withAuthor('user-1', 'User 1')
                    .withAvatar(null)
                    .withText('Test comment 1')
                    .withCreatedAtTimestamp(Timestamp.fromDate(new Date('2023-01-01')))
                    .withUpdatedAtTimestamp(Timestamp.fromDate(new Date('2023-01-01')))
                    .build(),
            ];

            // Set up test data in stubs
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership for user
            const membershipDoc = new GroupMemberDocumentBuilder().withUserId('user-id').withGroupId('test-group')
                .build();
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
            const membershipDoc = new GroupMemberDocumentBuilder().withUserId('user-id').withGroupId('test-group')
                .build();
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
            // No group or membership data set up, so access should be denied
            await expect(commentService.listComments(CommentTargetTypes.GROUP, 'nonexistent-group', 'user-id')).rejects.toThrow();
        });
    });

    describe('createComment', () => {
        it('should create a GROUP comment successfully', async () => {
            const testGroup = new FirestoreGroupBuilder().withId('test-group').build();

            const createdComment = new CommentBuilder()
                .withId('new-comment-id')
                .withAuthor('user-id', 'Test User')
                .withAvatar('https://example.com/photo.jpg')
                .withText('New test comment')
                .withCreatedAtTimestamp(Timestamp.now())
                .withUpdatedAtTimestamp(Timestamp.now())
                .build();

            // Set up test data in stubs
            stubReader.setDocument('groups', 'test-group', testGroup);

            // Set up group membership for user
            const membershipDoc = new GroupMemberDocumentBuilder().withUserId('user-id').withGroupId('test-group')
                .build();
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
            const membershipDoc = new GroupMemberDocumentBuilder().withUserId('user-id').withGroupId('test-group')
                .build();
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
            const membershipDoc = new GroupMemberDocumentBuilder().withUserId('user-id').withGroupId('test-group')
                .build();
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
            const membershipDoc = new GroupMemberDocumentBuilder().withUserId('user-id').withGroupId('test-group')
                .build();
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
        // Use the main commentService instance with real dependencies

        describe('createComment - Unit Scenarios', () => {
            it('should create a comment successfully with real implementation', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';
                const commentData: CreateCommentRequest = {
                    text: 'Test comment',
                    targetType,
                    targetId,
                };

                // Set up group and membership for real validation
                const testGroup = new FirestoreGroupBuilder().withId(targetId).build();
                stubReader.setDocument('groups', targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(targetId)
                    .build();
                stubReader.setDocument('group-members', `${targetId}_${userId}`, membershipDoc);

                // Set up auth user
                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });

                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, true);

                const result = await commentService.createComment(targetType, targetId, commentData, userId);

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

                // Set up group and membership for real validation
                const testGroup = new FirestoreGroupBuilder().withId(targetId).build();
                stubReader.setDocument('groups', targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(targetId)
                    .build();
                stubReader.setDocument('group-members', `${targetId}_${userId}`, membershipDoc);

                // Set up auth user without displayName
                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'user456@example.com',
                    // No displayName
                });

                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, true);

                const result = await commentService.createComment(targetType, targetId, commentData, userId);

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
                    commentService.createComment(targetType, targetId, commentData, userId)
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

                // Access should be denied since no proper setup
                await expect(
                    commentService.createComment(targetType, targetId, commentData, userId)
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

                // Set up group and membership for real validation
                const testGroup = new FirestoreGroupBuilder().withId(targetId).build();
                stubReader.setDocument('groups', targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(targetId)
                    .build();
                stubReader.setDocument('group-members', `${targetId}_${userId}`, membershipDoc);

                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });

                // Mock firestore write to fail
                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, false, 'Write failed');

                await expect(
                    commentService.createComment(targetType, targetId, commentData, userId)
                ).rejects.toThrow('Write failed');
            });
        });

        describe('listComments - Unit Scenarios', () => {
            it('should list comments successfully', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';

                // Set up group and membership for real validation
                const testGroup = new FirestoreGroupBuilder().withId(targetId).build();
                stubReader.setDocument('groups', targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(targetId)
                    .build();
                stubReader.setDocument('group-members', `${targetId}_${userId}`, membershipDoc);

                // Mock existing comments
                const mockComments = [
                    new CommentBuilder()
                        .withId('comment-1')
                        .withAuthor('user-123', 'Test User')
                        .withText('First comment')
                        .withCreatedAtTimestamp(Timestamp.now())
                        .withUpdatedAtTimestamp(Timestamp.now())
                        .build(),
                    new CommentBuilder()
                        .withId('comment-2')
                        .withAuthor('user-456', 'Another User')
                        .withText('Second comment')
                        .withCreatedAtTimestamp(Timestamp.now())
                        .withUpdatedAtTimestamp(Timestamp.now())
                        .build(),
                ];

                stubReader.setCommentsForTarget(targetType, targetId, mockComments);

                const result = await commentService.listComments(targetType, targetId, userId);

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

                // Set up group and membership for real validation
                const testGroup = new FirestoreGroupBuilder().withId(targetId).build();
                stubReader.setDocument('groups', targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(targetId)
                    .build();
                stubReader.setDocument('group-members', `${targetId}_${userId}`, membershipDoc);

                stubReader.setCommentsForTarget(targetType, targetId, []);

                const result = await commentService.listComments(targetType, targetId, userId);

                expect(result.comments).toEqual([]);
                expect(result.hasMore).toBe(false);
            });

            it('should throw error when access verification fails', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'group';
                const targetId = 'group-456';

                // Access should be denied since no proper setup
                await expect(
                    commentService.listComments(targetType, targetId, userId)
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

                // Set up group and membership for real validation
                const testGroup = new FirestoreGroupBuilder().withId(targetId).build();
                stubReader.setDocument('groups', targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(targetId)
                    .build();
                stubReader.setDocument('group-members', `${targetId}_${userId}`, membershipDoc);

                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });
                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, true);

                const result = await commentService.createComment(targetType, targetId, commentData, userId);

                expect(result.text).toBe('Group comment');
            });

            it('should support expense comments', async () => {
                const userId = 'user-123';
                const targetType: CommentTargetType = 'expense';
                const targetId = 'expense-456';
                const groupId = 'group-789';
                const commentData: CreateCommentRequest = {
                    text: 'Expense comment',
                    targetType,
                    targetId,
                };

                // Set up expense, group and membership for real validation
                const testExpense = new FirestoreExpenseBuilder().withId(targetId).withGroupId(groupId).build();
                const testGroup = new FirestoreGroupBuilder().withId(groupId).build();

                stubReader.setDocument('expenses', targetId, testExpense);
                stubReader.setDocument('groups', groupId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(groupId)
                    .build();
                stubReader.setDocument('group-members', `${groupId}_${userId}`, membershipDoc);

                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });
                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, true);

                const result = await commentService.createComment(targetType, targetId, commentData, userId);

                expect(result.text).toBe('Expense comment');
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

                // Set up group and membership for real validation
                const testGroup = new FirestoreGroupBuilder().withId(targetId).build();
                stubReader.setDocument('groups', targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder().withUserId(userId).withGroupId(targetId)
                    .build();
                stubReader.setDocument('group-members', `${targetId}_${userId}`, membershipDoc);

                stubAuth.setUser(userId, {
                    uid: userId,
                    email: 'test@example.com',
                    displayName: 'Test User',
                });
                stubWriter.setWriteResult(`${targetType}-comments/${targetId}`, true);

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

    // ================================
    // Validation Tests (from comment-validation.unit.test.ts)
    // ================================

    describe('Comment Validation Tests', () => {
        describe('validateCreateComment', () => {
            const validCommentData: CreateCommentRequest = {
                text: 'This is a valid comment',
                targetType: CommentTargetTypes.GROUP,
                targetId: 'group-123',
                groupId: 'group-123',
            };

            describe('Comment Text Validation', () => {
                it('should accept valid comment text', () => {
                    const validTexts = [
                        'Simple comment',
                        'Comment with numbers 123',
                        'Comment with special chars!@#$%',
                        'A', // minimum length
                        'A'.repeat(500), // maximum length
                        'Multi\nline\ncomment',
                        'Comment with emojis 😀🎉',
                    ];

                    for (const text of validTexts) {
                        const data = { ...validCommentData, text };
                        expect(() => validateCreateComment(data)).not.toThrow();
                    }
                });

                it('should reject invalid comment text', () => {
                    const invalidTexts = [
                        '', // empty
                        '   ', // whitespace only
                        'A'.repeat(501), // too long
                    ];

                    for (const text of invalidTexts) {
                        const data = { ...validCommentData, text };
                        expect(() => validateCreateComment(data)).toThrow(
                            expect.objectContaining({
                                statusCode: HTTP_STATUS.BAD_REQUEST,
                                code: 'INVALID_COMMENT_TEXT',
                            }),
                        );
                    }
                });

                it('should trim whitespace from comment text', () => {
                    const data = { ...validCommentData, text: '  Valid comment  ' };
                    const result = validateCreateComment(data);
                    expect(result.text).toBe('Valid comment');
                });

                it('should require comment text', () => {
                    const dataWithoutText = { ...validCommentData };
                    delete (dataWithoutText as any).text;

                    expect(() => validateCreateComment(dataWithoutText)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_COMMENT_TEXT',
                            message: expect.stringMatching(/required/i),
                        }),
                    );
                });

                it('should enforce maximum length constraint', () => {
                    const longText = 'A'.repeat(501);
                    const data = new CommentRequestBuilder()
                        .from(validCommentData)
                        .withText(longText)
                        .build();

                    expect(() => validateCreateComment(data)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_COMMENT_TEXT',
                            message: 'Comment cannot exceed 500 characters',
                        }),
                    );
                });
            });

            describe('Target Type Validation', () => {
                it('should accept valid target types', () => {
                    const validTargetTypes = [CommentTargetTypes.GROUP, CommentTargetTypes.EXPENSE];

                    for (const targetType of validTargetTypes) {
                        const data = new CommentRequestBuilder()
                            .from(validCommentData)
                            .withTargetType(targetType)
                            .build();
                        expect(() => validateCreateComment(data)).not.toThrow();
                    }
                });

                it('should reject invalid target types', () => {
                    const invalidTargetTypes = ['invalid', 'user', 'settlement', '', null, undefined, 123];

                    for (const targetType of invalidTargetTypes) {
                        const data = new CommentRequestBuilder()
                            .from(validCommentData)
                            .withTargetType(targetType)
                            .build();
                        expect(() => validateCreateComment(data as any)).toThrow(
                            expect.objectContaining({
                                statusCode: HTTP_STATUS.BAD_REQUEST,
                                code: 'INVALID_TARGET_TYPE',
                            }),
                        );
                    }
                });

                it('should require target type', () => {
                    const dataWithoutTargetType = { ...validCommentData };
                    delete (dataWithoutTargetType as any).targetType;

                    expect(() => validateCreateComment(dataWithoutTargetType)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_TARGET_TYPE',
                            message: 'Target type is required',
                        }),
                    );
                });

                it('should provide specific error message for invalid target types', () => {
                    const data = new CommentRequestBuilder()
                        .from(validCommentData)
                        .withTargetType('invalid')
                        .build();

                    expect(() => validateCreateComment(data as any)).toThrow(
                        expect.objectContaining({
                            code: 'INVALID_TARGET_TYPE',
                            message: 'Target type must be either "group" or "expense"',
                        }),
                    );
                });
            });

            describe('Target ID Validation', () => {
                it('should accept valid target IDs', () => {
                    const validTargetIds = ['group-123', 'expense-456', 'simple-id', 'id_with_underscores', 'ID-WITH-CAPS'];

                    for (const targetId of validTargetIds) {
                        const data = new CommentRequestBuilder()
                            .from(validCommentData)
                            .withTargetId(targetId)
                            .build();
                        expect(() => validateCreateComment(data)).not.toThrow();
                    }
                });

                it('should reject invalid target IDs', () => {
                    const invalidTargetIds = [
                        '',
                        '   ', // whitespace only
                        null,
                        undefined,
                    ];

                    for (const targetId of invalidTargetIds) {
                        const data = new CommentRequestBuilder()
                            .from(validCommentData)
                            .withTargetId(targetId)
                            .build();
                        expect(() => validateCreateComment(data as any)).toThrow(
                            expect.objectContaining({
                                statusCode: HTTP_STATUS.BAD_REQUEST,
                                code: 'INVALID_TARGET_ID',
                            }),
                        );
                    }
                });

                it('should trim whitespace from target IDs', () => {
                    const data = new CommentRequestBuilder()
                        .from(validCommentData)
                        .withTargetId('  group-123  ')
                        .build();
                    const result = validateCreateComment(data);
                    expect(result.targetId).toBe('group-123');
                });

                it('should require target ID', () => {
                    const dataWithoutTargetId = { ...validCommentData };
                    delete (dataWithoutTargetId as any).targetId;

                    expect(() => validateCreateComment(dataWithoutTargetId)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_TARGET_ID',
                            message: 'Target ID is required',
                        }),
                    );
                });
            });

            describe('Group ID Validation', () => {
                it('should accept valid group IDs', () => {
                    const validGroupIds = [
                        'group-123',
                        'simple-id',
                        undefined, // optional field
                    ];

                    for (const groupId of validGroupIds) {
                        const data = new CommentRequestBuilder()
                            .from(validCommentData)
                            .withGroupId(groupId)
                            .build();
                        expect(() => validateCreateComment(data)).not.toThrow();
                    }
                });

                it('should trim whitespace from group IDs', () => {
                    const data = new CommentRequestBuilder()
                        .from(validCommentData)
                        .withGroupId('  group-123  ')
                        .build();
                    const result = validateCreateComment(data);
                    expect(result.groupId).toBe('group-123');
                });

                it('should allow missing group ID (optional field)', () => {
                    const dataWithoutGroupId = { ...validCommentData };
                    delete (dataWithoutGroupId as any).groupId;

                    expect(() => validateCreateComment(dataWithoutGroupId)).not.toThrow();
                });
            });

            describe('Complete Validation Scenarios', () => {
                it('should accept valid complete comment data', () => {
                    const result = validateCreateComment(validCommentData);

                    expect(result).toEqual({
                        text: 'This is a valid comment',
                        targetType: CommentTargetTypes.GROUP,
                        targetId: 'group-123',
                        groupId: 'group-123',
                    });
                });

                it('should sanitize input data', () => {
                    // Note: The actual sanitization depends on the sanitizeString implementation
                    const dataWithSpaces = {
                        text: '  Comment with spaces  ',
                        targetType: CommentTargetTypes.GROUP,
                        targetId: '  group-123  ',
                        groupId: '  group-123  ',
                    };

                    const result = validateCreateComment(dataWithSpaces);
                    expect(result.text).toBe('Comment with spaces');
                    expect(result.targetId).toBe('group-123');
                    expect(result.groupId).toBe('group-123');
                });

                it('should handle data without optional fields', () => {
                    const minimalData = {
                        text: 'Minimal comment',
                        targetType: CommentTargetTypes.EXPENSE,
                        targetId: 'expense-456',
                    };

                    const result = validateCreateComment(minimalData);
                    expect(result).toEqual({
                        text: 'Minimal comment',
                        targetType: CommentTargetTypes.EXPENSE,
                        targetId: 'expense-456',
                        groupId: undefined,
                    });
                });
            });
        });

        describe('validateListCommentsQuery', () => {
            describe('Cursor Parameter Validation', () => {
                it('should accept valid cursor values', () => {
                    const validQueries = [
                        { cursor: 'cursor-123' },
                        { cursor: 'simple-cursor' },
                        {}, // no cursor (optional)
                        { cursor: undefined }, // undefined cursor
                    ];

                    for (const query of validQueries) {
                        expect(() => validateListCommentsQuery(query)).not.toThrow();
                    }
                });

                it('should allow missing cursor parameter', () => {
                    const result = validateListCommentsQuery({});
                    expect(result).toEqual({ limit: 20 }); // default limit
                });
            });

            describe('Limit Parameter Validation', () => {
                it('should accept valid limit values', () => {
                    const validLimits = [1, 10, 50, 100];

                    for (const limit of validLimits) {
                        const query = { limit };
                        expect(() => validateListCommentsQuery(query)).not.toThrow();
                    }
                });

                it('should reject invalid limit values', () => {
                    const invalidLimits = [
                        0, // too small
                        -1, // negative
                        101, // too large
                        1.5, // not integer
                        'not-a-number',
                        null,
                    ];

                    for (const limit of invalidLimits) {
                        const query = { limit };
                        expect(() => validateListCommentsQuery(query)).toThrow(
                            expect.objectContaining({
                                statusCode: HTTP_STATUS.BAD_REQUEST,
                                code: 'INVALID_QUERY_PARAMS',
                            }),
                        );
                    }
                });

                it('should use default limit when not provided', () => {
                    const result = validateListCommentsQuery({});
                    expect(result.limit).toBe(20);
                });

                it('should preserve provided valid limit', () => {
                    const result = validateListCommentsQuery({ limit: 50 });
                    expect(result.limit).toBe(50);
                });
            });

            describe('Complete Query Validation', () => {
                it('should validate complete query with both parameters', () => {
                    const query = { cursor: 'cursor-123', limit: 25 };
                    const result = validateListCommentsQuery(query);

                    expect(result).toEqual({
                        cursor: 'cursor-123',
                        limit: 25,
                    });
                });

                it('should ignore unknown query parameters', () => {
                    const query = {
                        cursor: 'cursor-123',
                        limit: 25,
                        unknownParam: 'should be ignored',
                    };

                    const result = validateListCommentsQuery(query);
                    expect(result).not.toHaveProperty('unknownParam');
                    expect(result).toEqual({
                        cursor: 'cursor-123',
                        limit: 25,
                    });
                });
            });
        });

        describe('validateTargetId', () => {
            it('should accept valid target IDs for different target types', () => {
                const validIds = ['group-123', 'expense-456', 'simple-id'];
                const targetTypes: CommentTargetType[] = [CommentTargetTypes.GROUP, CommentTargetTypes.EXPENSE];

                for (const id of validIds) {
                    for (const targetType of targetTypes) {
                        expect(() => validateTargetId(id, targetType)).not.toThrow();
                        expect(validateTargetId(id, targetType)).toBe(id);
                    }
                }
            });

            it('should reject invalid target IDs', () => {
                const invalidIds = [null, undefined, '', '   ', 123, {}, []];
                const targetType = CommentTargetTypes.GROUP;

                for (const id of invalidIds) {
                    expect(() => validateTargetId(id, targetType)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_TARGET_ID',
                            message: 'Invalid group ID',
                        }),
                    );
                }
            });

            it('should trim whitespace from target IDs', () => {
                const id = '  group-123  ';
                const result = validateTargetId(id, CommentTargetTypes.GROUP);
                expect(result).toBe('group-123');
            });

            it('should include target type in error message', () => {
                expect(() => validateTargetId('', CommentTargetTypes.GROUP)).toThrow(
                    expect.objectContaining({
                        message: 'Invalid group ID',
                    }),
                );

                expect(() => validateTargetId('', CommentTargetTypes.EXPENSE)).toThrow(
                    expect.objectContaining({
                        message: 'Invalid expense ID',
                    }),
                );
            });
        });

        describe('validateCommentId', () => {
            it('should accept valid comment IDs', () => {
                const validIds = ['comment-123', 'simple-id', 'id_with_underscores', 'ID-WITH-CAPS'];

                for (const id of validIds) {
                    expect(() => validateCommentId(id)).not.toThrow();
                    expect(validateCommentId(id)).toBe(id);
                }
            });

            it('should reject invalid comment IDs', () => {
                const invalidIds = [
                    null,
                    undefined,
                    '',
                    '   ', // whitespace only
                    123, // not a string
                    {},
                    [],
                ];

                for (const id of invalidIds) {
                    expect(() => validateCommentId(id)).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_COMMENT_ID',
                            message: 'Invalid comment ID',
                        }),
                    );
                }
            });

            it('should trim whitespace from comment IDs', () => {
                const id = '  comment-123  ';
                const result = validateCommentId(id);
                expect(result).toBe('comment-123');
            });
        });

        describe('Error Handling and Security', () => {
            it('should throw ApiError with proper structure', () => {
                try {
                    validateCreateComment({ text: '' });
                    throw new Error('Expected validation to throw an error');
                } catch (error) {
                    expect(error).toBeInstanceOf(ApiError);
                    expect(error).toHaveProperty('statusCode', HTTP_STATUS.BAD_REQUEST);
                    expect(error).toHaveProperty('code');
                    expect(error).toHaveProperty('message');
                }
            });

            it('should handle malformed input gracefully', () => {
                const malformedInputs = ['not an object', 123, [], true, null, undefined];

                for (const input of malformedInputs) {
                    expect(() => validateCreateComment(input)).toThrow();
                }
            });

            it('should provide specific error codes for different validation failures', () => {
                // Text validation error
                expect(() => validateCreateComment({ text: '', targetType: CommentTargetTypes.GROUP, targetId: 'group-1' })).toThrow(expect.objectContaining({ code: 'INVALID_COMMENT_TEXT' }));

                // Target type validation error
                expect(() => validateCreateComment({ text: 'Valid', targetType: 'invalid', targetId: 'group-1' })).toThrow(expect.objectContaining({ code: 'INVALID_TARGET_TYPE' }));

                // Target ID validation error
                expect(() => validateCreateComment({ text: 'Valid', targetType: CommentTargetTypes.GROUP, targetId: '' })).toThrow(expect.objectContaining({ code: 'INVALID_TARGET_ID' }));
            });
        });
    });
});