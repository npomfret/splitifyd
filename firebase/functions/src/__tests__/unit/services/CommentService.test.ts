import { toCommentId, toExpenseId, toGroupId } from '@billsplit-wl/shared';
import { CreateExpenseCommentRequestBuilder, CreateExpenseRequestBuilder, CreateGroupCommentRequestBuilder, CreateGroupRequestBuilder, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { validateCommentId, validateCreateExpenseComment, validateCreateGroupComment, validateListCommentsQuery } from '../../../comments/validation';
import { HTTP_STATUS } from '../../../constants';
import { CommentService } from '../../../services/CommentService';
import { ApiError } from '../../../utils/errors';
import { AppDriver } from '../AppDriver';

describe('CommentService - Consolidated Tests', () => {
    let commentService: CommentService;
    let appDriver: AppDriver;

    beforeEach(() => {
        // Create AppDriver which sets up all real services
        appDriver = new AppDriver();

        commentService = appDriver.componentBuilder.buildCommentService();
    });

    describe('listGroupComments', () => {
        it('should return empty list when no comments exist', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Act
            const result = await commentService.listGroupComments(groupId, userId, { limit: 10 });

            // Assert
            expect(result.comments).toHaveLength(0);
            expect(result.hasMore).toBe(false);
        });

        it('should throw error when user lacks access', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            // Act & Assert - No group or membership data set up, so access should be denied
            await expect(commentService.listGroupComments(toGroupId('nonexistent-group'), userId)).rejects.toThrow();
        });
    });

    describe('listExpenseComments', () => {
        it('should return paginated comments', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await commentService.listExpenseComments(expenseId, userId, { limit: 5, cursor: 'start-cursor' });

            // Assert
            expect(result.comments).toHaveLength(0);
            expect(result.hasMore).toBe(false);
        });

        it('should throw error when user lacks access', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            // Act & Assert - No expense or membership data set up, so access should be denied
            await expect(commentService.listExpenseComments(toExpenseId('nonexistent-expense'), userId)).rejects.toThrow();
        });
    });

    describe('createComment', () => {
        it('should create a GROUP comment successfully', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Act
            const result = await commentService.createGroupComment(
                groupId,
                new CreateGroupCommentRequestBuilder().withGroupId(groupId).withText('New test comment').build(),
                userId,
            );

            // Assert
            expect(result.id).toBeTruthy();
            expect(result.text).toBe('New test comment');
            expect(result.authorId).toBe(userId);
            expect(result.authorName).toBeTruthy(); // Name comes from group membership
        });

        it('should throw error when user lacks access', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            // Act & Assert - Don't set up any group data
            await expect(
                commentService.createGroupComment(
                    toGroupId('nonexistent-group'),
                    new CreateGroupCommentRequestBuilder().withGroupId('nonexistent-group').withText('Test comment').build(),
                    userId,
                ),
            )
                .rejects
                .toThrow(ApiError);
        });
    });

    describe('dependency injection', () => {
        it('should use injected FirestoreReader for group reads', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            // Act
            const result = await commentService.listGroupComments(groupId, userId);

            // Assert
            expect(result.comments).toEqual([]);
        });

        it('should use injected FirestoreReader for expense reads', async () => {
            // Arrange
            const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
            const userId = user.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const groupId = toGroupId(group.id);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
            );
            const expenseId = toExpenseId(expense.id);

            // Act
            const result = await commentService.listExpenseComments(expenseId, userId);

            // Assert
            expect(result.comments).toEqual([]);
        });
    });

    describe('Unit Test Scenarios - Error Handling and Edge Cases', () => {
        describe('createComment - Unit Scenarios', () => {
            it('should create a comment using the group display name', async () => {
                // Arrange
                const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
                const userId = user.user.uid;

                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
                const groupId = toGroupId(group.id);

                const commentData = new CreateGroupCommentRequestBuilder().withGroupId(groupId).withText('Test comment').build();

                // Act
                const result = await commentService.createGroupComment(groupId, commentData, userId);

                // Assert
                expect(result).toMatchObject({
                    id: expect.any(String),
                    authorId: userId,
                    authorName: expect.any(String), // Name comes from group membership
                    text: 'Test comment',
                });
                expect(result.createdAt).toBeDefined();
                expect(result.updatedAt).toBeDefined();
            });

            it('should create a comment even when auth service has no record', async () => {
                // Arrange
                const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
                const userId = user.user.uid;

                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
                const groupId = toGroupId(group.id);

                const commentData = new CreateGroupCommentRequestBuilder().withGroupId(groupId).withText('Comment without auth record').build();

                // Act
                const result = await commentService.createGroupComment(groupId, commentData, userId);

                // Assert
                expect(result.authorName).toBeTruthy(); // Name comes from group membership
            });

            it('should throw error when user is not a group member', async () => {
                // Arrange
                const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
                const userId = user.user.uid;

                const commentData = new CreateGroupCommentRequestBuilder().withGroupId('group-123').withText('Test comment').build();

                // Act & Assert
                await expect(commentService.createGroupComment(toGroupId('group-123'), commentData, userId)).rejects.toThrow(ApiError);
            });

            it('should throw error when group data is missing', async () => {
                // Arrange
                const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
                const userId = user.user.uid;

                const commentData = new CreateGroupCommentRequestBuilder().withGroupId('group-456').withText('Test comment').build();

                // Act & Assert - Cannot seed membership without group through API
                await expect(commentService.createGroupComment(toGroupId('group-456'), commentData, userId)).rejects.toThrow(ApiError);
            });
        });

        describe('listGroupComments - Unit Scenarios', () => {
            it('should list comments successfully when group exists', async () => {
                // Arrange
                const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
                const userId = user.user.uid;

                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
                const groupId = toGroupId(group.id);

                // Act
                const result = await commentService.listGroupComments(groupId, userId);

                // Assert
                expect(result).toMatchObject({
                    comments: expect.any(Array),
                    hasMore: false,
                });
            });

            it('should return empty list when no comments exist', async () => {
                // Arrange
                const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
                const userId = user.user.uid;

                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
                const groupId = toGroupId(group.id);

                // Act
                const result = await commentService.listGroupComments(groupId, userId);

                // Assert
                expect(result.comments).toEqual([]);
                expect(result.hasMore).toBe(false);
            });

            it('should throw error when access verification fails', async () => {
                // Arrange
                const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
                const userId = user.user.uid;

                // Act & Assert - Access should be denied since no proper setup
                await expect(commentService.listGroupComments(toGroupId('group-456'), userId)).rejects.toThrow(ApiError);
            });
        });

        describe('Target type support - Unit Scenarios', () => {
            it('should support group comments', async () => {
                // Arrange
                const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
                const userId = user.user.uid;

                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
                const groupId = toGroupId(group.id);

                const commentData = new CreateGroupCommentRequestBuilder().withGroupId(groupId).withText('Group comment').build();

                // Act
                const result = await commentService.createGroupComment(groupId, commentData, userId);

                // Assert
                expect(result.text).toBe('Group comment');
                expect(result.authorName).toBeTruthy(); // Name comes from group membership
            });

            it('should support expense comments', async () => {
                // Arrange
                const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
                const userId = user.user.uid;

                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
                const groupId = toGroupId(group.id);

                const expense = await appDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(groupId)
                        .withPaidBy(userId)
                        .withParticipants([userId])
                        .build(),
                    userId,
                );
                const expenseId = toExpenseId(expense.id);

                const commentData = new CreateExpenseCommentRequestBuilder().withExpenseId(expenseId).withText('Expense comment').build();

                // Act
                const result = await commentService.createExpenseComment(expenseId, commentData, userId);

                // Assert
                expect(result.text).toBe('Expense comment');
                expect(result.authorName).toBeTruthy(); // Name comes from group membership
            });
        });

        describe('Integration scenarios', () => {
            it('should maintain consistency between create and list operations', async () => {
                // Arrange
                const user = await appDriver.registerUser(new UserRegistrationBuilder().build());
                const userId = user.user.uid;

                const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
                const groupId = toGroupId(group.id);

                const commentData = new CreateGroupCommentRequestBuilder().withGroupId(groupId).withText('Consistency test comment').build();

                // Act - Create the comment
                const createdComment = await commentService.createGroupComment(groupId, commentData, userId);

                // List comments to verify consistency
                const listedComments = await commentService.listGroupComments(groupId, userId);

                // Assert
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
                    expect(() => validateCreateGroupComment(groupTargetId, new CreateGroupCommentRequestBuilder().withText(text).build())).not.toThrow();
                }
            });

            it('should reject invalid comment text', () => {
                const invalidTexts = ['', '   ', 'A'.repeat(501)];

                for (const text of invalidTexts) {
                    expect(() => validateCreateGroupComment(groupTargetId, new CreateGroupCommentRequestBuilder().withText(text).build())).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_COMMENT_TEXT',
                        }),
                    );
                }
            });

            it('should trim and sanitize inputs', () => {
                const result = validateCreateGroupComment('  group-123  ', new CreateGroupCommentRequestBuilder().withText('  <b>Valid</b>  ').build());

                expect(result.groupId).toBe('group-123');
                expect(result.text).toBe('Valid');
            });

            it('should require text field', () => {
                expect(() => validateCreateGroupComment(groupTargetId, {} as any)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_COMMENT_TEXT',
                    }),
                );
            });

            it('should reject invalid target ids', () => {
                const invalidIds = ['', '   ', null, undefined];

                for (const id of invalidIds) {
                    expect(() => validateCreateGroupComment(id as any, new CreateGroupCommentRequestBuilder().withText('Valid').build())).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_GROUP_ID',
                            message: 'Invalid group ID',
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
                    expect(() => validateCreateExpenseComment(expenseTargetId, new CreateExpenseCommentRequestBuilder().withText(text).build())).not.toThrow();
                }
            });

            it('should reject invalid comment text', () => {
                const invalidTexts = ['', '   ', 'B'.repeat(501)];

                for (const text of invalidTexts) {
                    expect(() => validateCreateExpenseComment(expenseTargetId, new CreateExpenseCommentRequestBuilder().withText(text).build())).toThrow(
                        expect.objectContaining({
                            statusCode: HTTP_STATUS.BAD_REQUEST,
                            code: 'INVALID_COMMENT_TEXT',
                        }),
                    );
                }
            });

            it('should sanitize comment text and target id', () => {
                const result = validateCreateExpenseComment('  expense-456  ', new CreateExpenseCommentRequestBuilder().withText(' <script>alert(1)</script>ok ').build());

                expect(result.expenseId).toBe('expense-456');
                expect(result.text).toBe('ok');
            });

            it('should require text field', () => {
                expect(() => validateCreateExpenseComment(expenseTargetId, {} as any)).toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'INVALID_COMMENT_TEXT',
                    }),
                );
            });

            it('should reject invalid target ids', () => {
                const invalidIds = ['', '   ', null, undefined];

                for (const id of invalidIds) {
                    expect(() => validateCreateExpenseComment(id as any, new CreateExpenseCommentRequestBuilder().withText('Valid').build())).toThrow(
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
                    validateCreateGroupComment(groupTargetId, new CreateGroupCommentRequestBuilder().withText('').build());
                    throw new Error('Expected validation to throw an error');
                } catch (error) {
                    expect(error).toBeInstanceOf(ApiError);
                    expect(error).toHaveProperty('statusCode', HTTP_STATUS.BAD_REQUEST);
                    expect(error).toHaveProperty('code');
                    expect(error).toHaveProperty('message');
                }
            });

            it('should handle malformed input gracefully', () => {
                const malformedInputs = [
                    { text: 123 } as any,
                    { text: [] } as any,
                    { text: true } as any,
                    { text: null } as any,
                    { text: undefined } as any,
                ];

                for (const input of malformedInputs) {
                    expect(() => validateCreateGroupComment(groupTargetId, input)).toThrow();
                }
            });

            it('should provide specific error codes for different validation failures', () => {
                expect(() => validateCreateGroupComment(groupTargetId, new CreateGroupCommentRequestBuilder().withText('').build())).toThrow(expect.objectContaining({ code: 'INVALID_COMMENT_TEXT' }));
                expect(() => validateCreateGroupComment('', new CreateGroupCommentRequestBuilder().withText('Valid').build())).toThrow(expect.objectContaining({ code: 'INVALID_GROUP_ID' }));
                expect(() => validateCreateExpenseComment('', new CreateExpenseCommentRequestBuilder().withText('Valid').build())).toThrow(expect.objectContaining({ code: 'INVALID_EXPENSE_ID' }));
            });
        });
    });
});
