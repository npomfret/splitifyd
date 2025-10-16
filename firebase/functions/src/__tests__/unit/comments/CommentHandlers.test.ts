import { CreateExpenseRequestBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommentHandlers } from '../../../comments/CommentHandlers';
import { HTTP_STATUS } from '../../../constants';
import { AppDriver } from '../AppDriver';

describe('CommentHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('createComment - Group Target', () => {
        it('should create a group comment successfully with valid data', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const result = await appDriver.createGroupComment(userId, group.id, 'This is a test comment');

            expect(result).toMatchObject({
                id: expect.any(String),
                text: 'This is a test comment',
                authorId: userId,
            });
        });

        it('should create a comment with whitespace trimmed', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const result = await appDriver.createGroupComment(userId, group.id, '   test comment   ');

            expect(result.text).toBe('test comment');
        });

        it('should sanitize XSS attempts in comment text', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const result = await appDriver.createGroupComment(userId, group.id, '<script>alert("xss")</script>Safe text');

            expect(result.text).not.toContain('<script>');
            expect(result.text).toContain('Safe text');
        });

        it('should reject comment with empty text', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            await expect(appDriver.createGroupComment(userId, groupId, '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_COMMENT_TEXT',
                }),
            );
        });

        it('should reject comment with only whitespace', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            await expect(appDriver.createGroupComment(userId, groupId, '   ')).rejects.toThrow(
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

            await expect(appDriver.createGroupComment(userId, groupId, longText)).rejects.toThrow(
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

            const group = await appDriver.createGroup(creatorId);

            await expect(appDriver.createGroupComment(userId, group.id, 'Test comment')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject comment for non-existent group', async () => {
            const groupId = 'non-existent-group';
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            await expect(appDriver.createGroupComment(userId, groupId, 'Test comment')).rejects.toThrow(
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

            const group = await appDriver.createGroup(userId);

            const expense = await appDriver.createExpense(
                userId,
                new CreateExpenseRequestBuilder().withGroupId(group.id).withPaidBy(userId).withParticipants([userId]).build(),
            );

            const result = await appDriver.createExpenseComment(userId, expense.id, 'This is an expense comment');

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

            const group = await appDriver.createGroup(creatorId);

            const expense = await appDriver.createExpense(
                creatorId,
                new CreateExpenseRequestBuilder().withGroupId(group.id).withPaidBy(creatorId).withParticipants([creatorId]).build(),
            );

            await expect(appDriver.createExpenseComment(userId, expense.id, 'Test comment')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject expense comment for non-existent expense', async () => {
            const expenseId = 'non-existent-expense';
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            await expect(appDriver.createExpenseComment(userId, expenseId, 'Test comment')).rejects.toThrow(
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

            const group = await appDriver.createGroup(userId);

            const result = await appDriver.listGroupComments(userId, group.id);

            expect(result).toMatchObject({
                comments: expect.any(Array),
                hasMore: expect.any(Boolean),
            });
        });

        it('should return empty array when no comments exist', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const result = await appDriver.listGroupComments(userId, group.id);

            expect(result.comments).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        it('should reject listing comments when user is not a group member', async () => {
            const userId = 'test-user';
            const creatorId = 'creator-user';

            appDriver.seedUser(userId, {});
            appDriver.seedUser(creatorId, {});

            const group = await appDriver.createGroup(creatorId);

            await expect(appDriver.listGroupComments(userId, group.id)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject listing comments for non-existent group', async () => {
            const groupId = 'non-existent-group';
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            await expect(appDriver.listGroupComments(userId, groupId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('listExpenseComments', () => {
        it('should list expense comments successfully', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const expense = await appDriver.createExpense(
                userId,
                new CreateExpenseRequestBuilder().withGroupId(group.id).withPaidBy(userId).withParticipants([userId]).build(),
            );

            const result = await appDriver.listExpenseComments(userId, expense.id);

            expect(result).toMatchObject({
                comments: expect.any(Array),
                hasMore: expect.any(Boolean),
            });
        });

        it('should return empty array when no expense comments exist', async () => {
            const userId = 'test-user';
            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const expense = await appDriver.createExpense(
                userId,
                new CreateExpenseRequestBuilder().withGroupId(group.id).withPaidBy(userId).withParticipants([userId]).build(),
            );

            const result = await appDriver.listExpenseComments(userId, expense.id);

            expect(result.comments).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        it('should reject listing comments when user is not a group member', async () => {
            const userId = 'test-user';
            const creatorId = 'creator-user';

            appDriver.seedUser(userId, {});
            appDriver.seedUser(creatorId, {});

            const group = await appDriver.createGroup(creatorId);

            const expense = await appDriver.createExpense(
                creatorId,
                new CreateExpenseRequestBuilder().withGroupId(group.id).withPaidBy(creatorId).withParticipants([creatorId]).build(),
            );

            await expect(appDriver.listExpenseComments(userId, expense.id)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject listing comments for non-existent expense', async () => {
            const expenseId = 'non-existent-expense';
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            await expect(appDriver.listExpenseComments(userId, expenseId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create CommentHandlers instance with default ApplicationBuilder', () => {
            const handlers = CommentHandlers.createCommentHandlers();
            expect(handlers).toBeInstanceOf(CommentHandlers);
            expect(handlers.createComment).toBeDefined();
            expect(handlers.listGroupComments).toBeDefined();
            expect(handlers.listExpenseComments).toBeDefined();
        });
    });
});
