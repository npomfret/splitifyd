import { CommentDTO } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, SplitifydFirestoreTestDatabase } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommentHandlers } from '../../../comments/CommentHandlers';
import { HTTP_STATUS } from '../../../constants';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CommentHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('createComment - Group Target', () => {
        it('should create a group comment successfully with valid data', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const result = await appDriver.createGroupComment(group.id, 'This is a test comment', userId);

            expect(result).toMatchObject({
                id: expect.any(String),
                text: 'This is a test comment',
                authorId: userId,
            });
        });

        it('should create a comment with whitespace trimmed', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const result = await appDriver.createGroupComment(group.id, '   test comment   ', userId);

            expect(result.text).toBe('test comment');
        });

        it('should sanitize XSS attempts in comment text', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const result = await appDriver.createGroupComment(group.id, '<script>alert("xss")</script>Safe text', userId);

            expect(result.text).not.toContain('<script>');
            expect(result.text).toContain('Safe text');
        });

        it('should reject comment with empty text', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            await expect(appDriver.createGroupComment(groupId, '', userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_COMMENT_TEXT',
                }),
            );
        });

        it('should reject comment with only whitespace', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            await expect(appDriver.createGroupComment(groupId, '   ', userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_COMMENT_TEXT',
                }),
            );
        });

        it('should reject comment with text exceeding 500 characters', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const longText = 'a'.repeat(501);

            await expect(appDriver.createGroupComment(groupId, longText, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_COMMENT_TEXT',
                }),
            );
        });

        it('should reject comment when user is not a group member', async () => {
            const userId = 'test-user';
            const creatorId = 'creator-user';

            appDriver.seedUser(userId, {});
            appDriver.seedUser(creatorId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);

            await expect(appDriver.createGroupComment(group.id, 'Test comment', userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject comment for non-existent group', async () => {
            const groupId = 'non-existent-group';
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            await expect(appDriver.createGroupComment(groupId, 'Test comment', userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('createComment - Expense Target', () => {
        it('should create an expense comment successfully with valid data', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build(), userId);

            const result = await appDriver.createExpenseComment(expense.id, 'This is an expense comment', userId);

            expect(result).toMatchObject({
                id: expect.any(String),
                text: 'This is an expense comment',
                authorId: userId,
            });
        });

        it('should reject expense comment when user is not a group member', async () => {
            const userId = 'test-user';
            const creatorId = 'creator-user';

            appDriver.seedUser(userId, {});
            appDriver.seedUser(creatorId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);

            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(creatorId)
                .withParticipants([creatorId])
                .build(), creatorId);

            await expect(appDriver.createExpenseComment(expense.id, 'Test comment', userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject expense comment for non-existent expense', async () => {
            const expenseId = 'non-existent-expense';
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            await expect(appDriver.createExpenseComment(expenseId, 'Test comment', userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('listGroupComments', () => {
        it('should list group comments successfully', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const result = await appDriver.listGroupComments(group.id, {}, userId);

            expect(result).toMatchObject({
                comments: expect.any(Array),
                hasMore: expect.any(Boolean),
            });
        });

        it('should return empty array when no comments exist', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const result = await appDriver.listGroupComments(group.id, {}, userId);

            expect(result.comments).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        it('should reject listing comments when user is not a group member', async () => {
            const userId = 'test-user';
            const creatorId = 'creator-user';

            appDriver.seedUser(userId, {});
            appDriver.seedUser(creatorId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);

            await expect(appDriver.listGroupComments(group.id, {}, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject listing comments for non-existent group', async () => {
            const groupId = 'non-existent-group';
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            await expect(appDriver.listGroupComments(groupId, {}, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should return newest comments first with full metadata', async () => {
            const userId = 'group-comment-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const first = await appDriver.createGroupComment(group.id, 'First comment', userId);
            await sleep(2);
            const second = await appDriver.createGroupComment(group.id, 'Second comment', userId);
            await sleep(2);
            const third = await appDriver.createGroupComment(group.id, 'Third comment', userId);

            const result = await appDriver.listGroupComments(group.id, {}, userId);

            expect(result.comments.map((c) => c.id)).toEqual([third.id, second.id, first.id]);
            expect(result.hasMore).toBe(false);
            expect(result.comments[0]).toMatchObject({
                id: third.id,
                authorId: userId,
                text: 'Third comment',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            });
        });

        it('should paginate group comments using cursor and limit', async () => {
            const userId = 'group-comment-pagination-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const created: CommentDTO[] = [];
            for (let i = 1; i <= 5; i++) {
                created.push(await appDriver.createGroupComment(group.id, `Comment ${i}`, userId));
                await sleep(2);
            }

            const firstPage = await appDriver.listGroupComments(group.id, {limit: 2}, userId);
            expect(firstPage.comments).toHaveLength(2);
            expect(firstPage.comments.map((c) => c.id)).toEqual([created[4].id, created[3].id]);
            expect(firstPage.hasMore).toBe(true);
            expect(firstPage.nextCursor).toBeDefined();

            const secondPage = await appDriver.listGroupComments(group.id, {
                limit: 2,
                cursor: firstPage.nextCursor!,
            }, userId);
            expect(secondPage.comments).toHaveLength(2);
            expect(secondPage.comments.map((c) => c.id)).toEqual([created[2].id, created[1].id]);
            expect(secondPage.hasMore).toBe(true);
            expect(secondPage.nextCursor).toBeDefined();

            const thirdPage = await appDriver.listGroupComments(group.id, {
                limit: 2,
                cursor: secondPage.nextCursor!,
            }, userId);
            expect(thirdPage.comments).toHaveLength(1);
            expect(thirdPage.comments[0].id).toBe(created[0].id);
            expect(thirdPage.hasMore).toBe(false);
            expect(thirdPage.nextCursor).toBeUndefined();
        });

        it('should ignore invalid pagination parameters gracefully', async () => {
            const userId = 'group-comment-invalid-pagination-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            await appDriver.createGroupComment(group.id, 'Validation comment', userId);

            const limitResult = await appDriver.listGroupComments(group.id, {limit: 0}, userId);
            expect(limitResult.comments.length).toBeGreaterThanOrEqual(1);

            const cursorResult = await appDriver.listGroupComments(group.id, {cursor: 'invalid-cursor'}, userId);
            expect(cursorResult.comments.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('listExpenseComments', () => {
        it('should list expense comments successfully', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build(), userId);

            const result = await appDriver.listExpenseComments(expense.id, {}, userId);

            expect(result).toMatchObject({
                comments: expect.any(Array),
                hasMore: expect.any(Boolean),
            });
        });

        it('should return empty array when no expense comments exist', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build(), userId);

            const result = await appDriver.listExpenseComments(expense.id, {}, userId);

            expect(result.comments).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        it('should reject listing comments when user is not a group member', async () => {
            const userId = 'test-user';
            const creatorId = 'creator-user';

            appDriver.seedUser(userId, {});
            appDriver.seedUser(creatorId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);

            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(creatorId)
                .withParticipants([creatorId])
                .build(), creatorId);

            await expect(appDriver.listExpenseComments(expense.id, {}, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject listing comments for non-existent expense', async () => {
            const expenseId = 'non-existent-expense';
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            await expect(appDriver.listExpenseComments(expenseId, {}, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should return newest expense comments first with expected metadata', async () => {
            const userId = 'expense-comment-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build(), userId);

            const first = await appDriver.createExpenseComment(expense.id, 'Expense comment 1', userId);
            await sleep(2);
            const second = await appDriver.createExpenseComment(expense.id, 'Expense comment 2', userId);

            const result = await appDriver.listExpenseComments(expense.id, {}, userId);

            expect(result.comments.map((c) => c.id)).toEqual([second.id, first.id]);
            expect(result.hasMore).toBe(false);
            expect(result.comments[0]).toMatchObject({
                id: second.id,
                authorId: userId,
                text: 'Expense comment 2',
                createdAt: expect.any(String),
                updatedAt: expect.any(String),
            });
        });

        it('should paginate expense comments via cursor and limit', async () => {
            const userId = 'expense-comment-pagination-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build(), userId);

            const created: CommentDTO[] = [];
            for (let i = 1; i <= 4; i++) {
                created.push(await appDriver.createExpenseComment(expense.id, `Expense comment ${i}`, userId));
                await sleep(2);
            }

            const firstPage = await appDriver.listExpenseComments(expense.id, {limit: 2}, userId);
            expect(firstPage.comments).toHaveLength(2);
            expect(firstPage.comments.map((c) => c.id)).toEqual([created[3].id, created[2].id]);
            expect(firstPage.hasMore).toBe(true);
            expect(firstPage.nextCursor).toBeDefined();

            const secondPage = await appDriver.listExpenseComments(expense.id, {
                limit: 2,
                cursor: firstPage.nextCursor!,
            }, userId);
            expect(secondPage.comments).toHaveLength(2);
            expect(secondPage.comments.map((c) => c.id)).toEqual([created[1].id, created[0].id]);
            expect(secondPage.hasMore).toBe(false);
            expect(secondPage.nextCursor).toBeUndefined();
        });

        it('should ignore invalid pagination inputs for expense comments', async () => {
            const userId = 'expense-comment-invalid-pagination-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build(), userId);

            await appDriver.createExpenseComment(expense.id, 'Expense validation comment', userId);

            const limitResult = await appDriver.listExpenseComments(expense.id, {limit: 0}, userId);
            expect(limitResult.comments.length).toBeGreaterThanOrEqual(1);

            const cursorResult = await appDriver.listExpenseComments(expense.id, {cursor: 'invalid-cursor'}, userId);
            expect(cursorResult.comments.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('Static Factory Method', () => {
        it('should create CommentHandlers instance with CommentService', () => {
            const db = new SplitifydFirestoreTestDatabase();
            const authService = new StubAuthService();
            const componentBuilder = new ComponentBuilder(authService, db);
            const handlers = new CommentHandlers(componentBuilder.buildCommentService());
            expect(handlers).toBeInstanceOf(CommentHandlers);
            expect(handlers.createComment).toBeDefined();
            expect(handlers.listGroupComments).toBeDefined();
            expect(handlers.listExpenseComments).toBeDefined();
        });
    });
});
