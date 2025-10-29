import { toGroupId } from '@splitifyd/shared';
import type { CreateExpenseCommentRequest, CreateGroupCommentRequest } from '@splitifyd/shared';
import { toCommentId, toExpenseId } from '@splitifyd/shared';
import { SplitifydFirestoreTestDatabase } from '@splitifyd/test-support';
import { ExpenseDTOBuilder, GroupDTOBuilder, GroupMemberDocumentBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { validateCommentId, validateCreateExpenseComment, validateCreateGroupComment, validateListCommentsQuery } from '../../../comments/validation';
import { HTTP_STATUS } from '../../../constants';
import { CommentService } from '../../../services/CommentService';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { ApiError } from '../../../utils/errors';
import { StubAuthService } from '../mocks/StubAuthService';

describe('CommentService - Consolidated Tests', () => {
    let commentService: CommentService;
    let db: SplitifydFirestoreTestDatabase;
    let stubAuth: StubAuthService;

    beforeEach(() => {
        db = new SplitifydFirestoreTestDatabase();
        stubAuth = new StubAuthService();

        const applicationBuilder = new ComponentBuilder(stubAuth, db);

        commentService = applicationBuilder.buildCommentService();

    });

    describe('listGroupComments', () => {
        it('should return empty list when no comments exist', async () => {
            const testGroup = new GroupDTOBuilder()
                .withId('test-group')
                .build();

            // Set up test data
            db.seedGroup(testGroup.id, testGroup);

            // Set up group membership for user
            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('user-id')
                .withGroupId(testGroup.id)
                .build();
            db.seedGroupMember(testGroup.id, 'user-id', membershipDoc);

            const result = await commentService.listGroupComments(testGroup.id, 'user-id', { limit: 10 });

            expect(result.comments).toHaveLength(0);
            expect(result.hasMore).toBe(false);
        });

        it('should throw error when user lacks access', async () => {
            // No group or membership data set up, so access should be denied
            await expect(commentService.listGroupComments(toGroupId('nonexistent-group'), 'user-id')).rejects.toThrow();
        });
    });

    describe('listExpenseComments', () => {
        it('should return paginated comments', async () => {
            const testGroup = new GroupDTOBuilder()
                .withId('test-group')
                .build();
            const testExpense = new ExpenseDTOBuilder()
                .withExpenseId('test-expense')
                .withGroupId(testGroup.id)
                .build();

            // Set up test data
            db.seedExpense('test-expense', testExpense);
            db.seedGroup(testGroup.id, testGroup);

            // Set up group membership for user
            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('user-id')
                .withGroupId(testGroup.id)
                .build();
            db.seedGroupMember(testGroup.id, 'user-id', membershipDoc);

            const result = await commentService.listExpenseComments(toExpenseId('test-expense'), 'user-id', { limit: 5, cursor: 'start-cursor' });

            expect(result.comments).toHaveLength(0);
            expect(result.hasMore).toBe(false);
        });

        it('should throw error when user lacks access', async () => {
            // No expense or membership data set up, so access should be denied
            await expect(commentService.listExpenseComments(toExpenseId('nonexistent-expense'), 'user-id')).rejects.toThrow();
        });
    });

    describe('createComment', () => {
        it('should create a GROUP comment successfully', async () => {
            const testGroup = new GroupDTOBuilder()
                .withId('test-group')
                .build();

            // Set up test data
            db.seedGroup(testGroup.id, testGroup);

            // Set up group membership for user
            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('user-id')
                .withGroupId(testGroup.id)
                .withGroupDisplayName('Captain Comment')
                .build();
            db.seedGroupMember(testGroup.id, 'user-id', membershipDoc);

            const result = await commentService.createGroupComment(testGroup.id, { text: 'New test comment', groupId: testGroup.id }, 'user-id');

            expect(result.id).toBeTruthy();
            expect(result.text).toBe('New test comment');
            expect(result.authorId).toBe('user-id');
            expect(result.authorName).toBe('Captain Comment');
        });

        it('should throw when group display name missing', async () => {
            const testGroup = new GroupDTOBuilder()
                .withId('test-group')
                .build();

            db.seedGroup(testGroup.id, testGroup);

            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('user-id')
                .withGroupId(testGroup.id)
                .withGroupDisplayName('')
                .build();
            db.seedGroupMember(testGroup.id, 'user-id', membershipDoc);

            await expect(
                commentService.createGroupComment(testGroup.id, { text: 'Fallback comment', groupId: testGroup.id }, 'user-id'),
            ).rejects.toThrow(ApiError);
        });

        it('should throw error when user lacks access', async () => {
            // Don't set up any group data

            await expect(
                commentService.createGroupComment(toGroupId('nonexistent-group'), { text: 'Test comment', groupId: toGroupId('nonexistent-group') }, 'user-id'),
            )
                .rejects
                .toThrow(ApiError);
        });
    });

    describe('dependency injection', () => {
        it('should use injected FirestoreReader for group reads', async () => {
            const testGroup = new GroupDTOBuilder()
                .withId('test-group')
                .build();

            // Set up test data
            db.seedGroup(testGroup.id, testGroup);

            // Set up group membership for user
            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('user-id')
                .withGroupId(testGroup.id)
                .build();
            db.seedGroupMember(testGroup.id, 'user-id', membershipDoc);

            const result = await commentService.listGroupComments(testGroup.id, 'user-id');
            expect(result.comments).toEqual([]);
        });

        it('should use injected FirestoreReader for expense reads', async () => {
            const testGroup = new GroupDTOBuilder()
                .withId('test-group')
                .build();
            const testExpense = new ExpenseDTOBuilder()
                .withExpenseId('test-expense')
                .withGroupId(testGroup.id)
                .build();

            // Set up test data
            db.seedExpense('test-expense', testExpense);
            db.seedGroup(testGroup.id, testGroup);

            // Set up group membership for user
            const membershipDoc = new GroupMemberDocumentBuilder()
                .withUserId('user-id')
                .withGroupId(testGroup.id)
                .build();
            db.seedGroupMember(testGroup.id, 'user-id', membershipDoc);

            // Test should now pass since all dependencies are set up
            const result = await commentService.listExpenseComments(toExpenseId('test-expense'), 'user-id');

            // Verify it worked
            expect(result.comments).toEqual([]);
        });
    });

    describe('Unit Test Scenarios - Error Handling and Edge Cases', () => {
        describe('createComment - Unit Scenarios', () => {
            it('should create a comment using the group display name', async () => {
                const userId = 'user-123';
                const targetId = toGroupId('group-456');
                const commentData: CreateGroupCommentRequest = {
                    text: 'Test comment',
                    groupId: targetId,
                };

                const testGroup = new GroupDTOBuilder()
                    .withId(targetId)
                    .build();
                db.seedGroup(targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder()
                    .withUserId(userId)
                    .withGroupId(targetId)
                    .withGroupDisplayName('Group Display Name')
                    .build();
                db.seedGroupMember(targetId, userId, membershipDoc);

                const result = await commentService.createGroupComment(targetId, commentData, userId);

                expect(result).toMatchObject({
                    id: expect.any(String),
                    authorId: userId,
                    authorName: 'Group Display Name',
                    text: 'Test comment',
                });
                expect(result.createdAt).toBeDefined();
                expect(result.updatedAt).toBeDefined();
            });

            it('should create a comment even when auth service has no record', async () => {
                const userId = 'user-456';
                const targetId = toGroupId('group-789');
                const commentData: CreateGroupCommentRequest = {
                    text: 'Comment without auth record',
                    groupId: targetId,
                };

                const testGroup = new GroupDTOBuilder()
                    .withId(targetId)
                    .build();
                db.seedGroup(targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder()
                    .withUserId(userId)
                    .withGroupId(targetId)
                    .withGroupDisplayName('Member Display')
                    .build();
                db.seedGroupMember(targetId, userId, membershipDoc);

                const result = await commentService.createGroupComment(targetId, commentData, userId);

                expect(result.authorName).toBe('Member Display');
            });

            it('should throw error when user is not a group member', async () => {
                const userId = 'non-member';
                const targetId = toGroupId('group-123');
                const commentData: CreateGroupCommentRequest = {
                    text: 'Test comment',
                    groupId: targetId,
                };

                await expect(commentService.createGroupComment(targetId, commentData, userId)).rejects.toThrow(ApiError);
            });

            it('should throw error when group data is missing', async () => {
                const userId = 'user-789';
                const targetId = toGroupId('group-456');
                const commentData: CreateGroupCommentRequest = {
                    text: 'Test comment',
                    groupId: targetId,
                };

                const membershipDoc = new GroupMemberDocumentBuilder()
                    .withUserId(userId)
                    .withGroupId(targetId)
                    .build();
                db.seedGroupMember(targetId, userId, membershipDoc);

                await expect(commentService.createGroupComment(targetId, commentData, userId)).rejects.toThrow(ApiError);
            });

            it('should throw error when group display name is empty', async () => {
                const userId = 'user-999';
                const targetId = toGroupId('group-999');
                const commentData: CreateGroupCommentRequest = {
                    text: 'Display name test',
                    groupId: targetId,
                };

                const testGroup = new GroupDTOBuilder()
                    .withId(targetId)
                    .build();
                db.seedGroup(targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder()
                    .withUserId(userId)
                    .withGroupId(targetId)
                    .withGroupDisplayName('')
                    .build();
                db.seedGroupMember(targetId, userId, membershipDoc);

                await expect(commentService.createGroupComment(targetId, commentData, userId)).rejects.toThrow(ApiError);
            });
        });

        describe('listGroupComments - Unit Scenarios', () => {
            it('should list comments successfully when group exists', async () => {
                const userId = 'user-123';
                const targetId = toGroupId('group-456');

                // Set up group and membership for real validation
                const testGroup = new GroupDTOBuilder()
                    .withId(targetId)
                    .build();
                db.seedGroup(targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder()
                    .withUserId(userId)
                    .withGroupId(targetId)
                    .build();
                db.seedGroupMember(targetId, userId, membershipDoc);

                const result = await commentService.listGroupComments(targetId, userId);

                expect(result).toMatchObject({
                    comments: expect.any(Array),
                    hasMore: false,
                });
            });

            it('should return empty list when no comments exist', async () => {
                const userId = 'user-123';
                const targetId = toGroupId('group-456');

                // Set up group and membership for real validation
                const testGroup = new GroupDTOBuilder()
                    .withId(targetId)
                    .build();
                db.seedGroup(targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder()
                    .withUserId(userId)
                    .withGroupId(targetId)
                    .build();
                db.seedGroupMember(targetId, userId, membershipDoc);

                const result = await commentService.listGroupComments(targetId, userId);

                expect(result.comments).toEqual([]);
                expect(result.hasMore).toBe(false);
            });

            it('should throw error when access verification fails', async () => {
                const userId = 'user-123';
                const targetId = toGroupId('group-456');

                // Access should be denied since no proper setup
                await expect(commentService.listGroupComments(targetId, userId)).rejects.toThrow(ApiError);
            });
        });

        describe('Target type support - Unit Scenarios', () => {
            it('should support group comments', async () => {
                const userId = 'user-123';
                const targetId = toGroupId('group-456');
                const commentData: CreateGroupCommentRequest = {
                    text: 'Group comment',
                    groupId: targetId,
                };

                // Set up group and membership for real validation
                const testGroup = new GroupDTOBuilder()
                    .withId(targetId)
                    .build();
                db.seedGroup(targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder()
                    .withUserId(userId)
                    .withGroupId(targetId)
                    .withGroupDisplayName('Group Commenter')
                    .build();
                db.seedGroupMember(targetId, userId, membershipDoc);

                const result = await commentService.createGroupComment(targetId, commentData, userId);

                expect(result.text).toBe('Group comment');
                expect(result.authorName).toBe('Group Commenter');
            });

            it('should support expense comments', async () => {
                const userId = 'user-123';
                const targetId = toExpenseId('expense-456');
                const groupId = toGroupId('group-789');
                const commentData: CreateExpenseCommentRequest = {
                    text: 'Expense comment',
                    expenseId: targetId,
                };

                // Set up expense, group and membership for real validation
                const testExpense = new ExpenseDTOBuilder()
                    .withExpenseId(targetId)
                    .withGroupId(groupId)
                    .build();
                const testGroup = new GroupDTOBuilder()
                    .withId(groupId)
                    .build();

                db.seedExpense(targetId, testExpense);
                db.seedGroup(groupId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder()
                    .withUserId(userId)
                    .withGroupId(groupId)
                    .withGroupDisplayName('Expense Commenter')
                    .build();
                db.seedGroupMember(groupId, userId, membershipDoc);

                const result = await commentService.createExpenseComment(targetId, commentData, userId);

                expect(result.text).toBe('Expense comment');
                expect(result.authorName).toBe('Expense Commenter');
            });
        });

        describe('Integration scenarios', () => {
            it('should maintain consistency between create and list operations', async () => {
                const userId = 'user-123';
                const targetId = toGroupId('group-456');
                const commentData: CreateGroupCommentRequest = {
                    text: 'Consistency test comment',
                    groupId: targetId,
                };

                // Set up group and membership for real validation
                const testGroup = new GroupDTOBuilder()
                    .withId(targetId)
                    .build();
                db.seedGroup(targetId, testGroup);

                const membershipDoc = new GroupMemberDocumentBuilder()
                    .withUserId(userId)
                    .withGroupId(targetId)
                    .withGroupDisplayName('Integration Member')
                    .build();
                db.seedGroupMember(targetId, userId, membershipDoc);

                // Create the comment
                const createdComment = await commentService.createGroupComment(targetId, commentData, userId);

                // List comments to verify consistency
                const listedComments = await commentService.listGroupComments(targetId, userId);

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
        const groupTargetId = 'group-123';
        const expenseTargetId = 'expense-456';

        describe('validateCreateGroupComment', () => {
            it('should accept a variety of valid texts', () => {
                const validTexts = [
                    'Simple comment',
                    'Comment with numbers 123',
                    'Comment with special chars!@#$%',
                    'A',
                    'A'.repeat(500),
                    'Multi\nline\ncomment',
                    'Comment with emojis 😀🎉',
                ];

                for (const text of validTexts) {
                    expect(() => validateCreateGroupComment(groupTargetId, { text })).not.toThrow();
                }
            });

            it('should reject invalid comment text', () => {
                const invalidTexts = ['', '   ', 'A'.repeat(501)];

                for (const text of invalidTexts) {
                    expect(() => validateCreateGroupComment(groupTargetId, { text })).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_COMMENT_TEXT',
                        }),
                    );
                }
            });

            it('should trim and sanitize inputs', () => {
                const result = validateCreateGroupComment('  group-123  ', { text: '  <b>Valid</b>  ' });

                expect(result.groupId).toBe('group-123');
                expect(result.text).toBe('Valid');
            });

            it('should require text field', () => {
                expect(() => validateCreateGroupComment(groupTargetId, {})).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_COMMENT_TEXT',
                    }),
                );
            });

            it('should reject invalid target ids', () => {
                const invalidIds = ['', '   ', null, undefined];

                for (const id of invalidIds) {
                    expect(() => validateCreateGroupComment(id as any, { text: 'Valid' })).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_INPUT',
                            message: 'group ID is required',
                        }),
                    );
                }
            });
        });

        describe('validateCreateExpenseComment', () => {
            it('should accept a variety of valid texts', () => {
                const validTexts = [
                    'Expense comment',
                    'Another line\nfor the comment',
                    'Symbols !@#$',
                    'B',
                    'B'.repeat(500),
                ];

                for (const text of validTexts) {
                    expect(() => validateCreateExpenseComment(expenseTargetId, { text })).not.toThrow();
                }
            });

            it('should reject invalid comment text', () => {
                const invalidTexts = ['', '   ', 'B'.repeat(501)];

                for (const text of invalidTexts) {
                    expect(() => validateCreateExpenseComment(expenseTargetId, { text })).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_COMMENT_TEXT',
                        }),
                    );
                }
            });

            it('should sanitize comment text and target id', () => {
                const result = validateCreateExpenseComment('  expense-456  ', { text: ' <script>alert(1)</script>ok ' });

                expect(result.expenseId).toBe('expense-456');
                expect(result.text).toBe('ok');
            });

            it('should require text field', () => {
                expect(() => validateCreateExpenseComment(expenseTargetId, {})).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_COMMENT_TEXT',
                    }),
                );
            });

            it('should reject invalid target ids', () => {
                const invalidIds = ['', '   ', null, undefined];

                for (const id of invalidIds) {
                    expect(() => validateCreateExpenseComment(id as any, { text: 'Valid' })).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_EXPENSE_ID',
                            message: 'Invalid expense ID',
                        }),
                    );
                }
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
                    expect(result).toEqual({ limit: 8 }); // default limit
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
                    expect(result.limit).toBe(8);
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

        describe('validateCommentId', () => {
            it('should accept valid comment IDs', () => {
                const validIds = ['comment-123', 'simple-id', 'id_with_underscores', 'ID-WITH-CAPS'];

                for (const id of validIds) {
                    expect(() => validateCommentId(id)).not.toThrow();
                    expect(validateCommentId(id)).toBe(toCommentId(id));
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
                expect(result).toBe(toCommentId('comment-123'));
            });
        });

        describe('Error Handling and Security', () => {
            it('should throw ApiError with proper structure', () => {
                try {
                    validateCreateGroupComment(groupTargetId, { text: '' });
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
                    expect(() => validateCreateGroupComment(groupTargetId, input as any)).toThrow();
                }
            });

            it('should provide specific error codes for different validation failures', () => {
                expect(() => validateCreateGroupComment(groupTargetId, { text: '' })).toThrow(expect.objectContaining({ code: 'INVALID_COMMENT_TEXT' }));
                expect(() => validateCreateGroupComment('', { text: 'Valid' })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
                expect(() => validateCreateExpenseComment('', { text: 'Valid' })).toThrow(expect.objectContaining({ code: 'INVALID_EXPENSE_ID' }));
            });
        });
    });
});
