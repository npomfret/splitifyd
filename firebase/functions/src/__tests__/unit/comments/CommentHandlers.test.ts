import type { CommentDTO } from '@billsplit-wl/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, StubFirestoreDatabase, UserRegistrationBuilder } from '@billsplit-wl/test-support';
import { StubCloudTasksClient, StubStorage } from 'ts-firebase-simulator';
import { beforeEach, describe, expect, it } from 'vitest';
import { CommentHandlers } from '../../../comments/CommentHandlers';
import { HTTP_STATUS } from '../../../constants';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { createUnitTestServiceConfig } from '../../test-config';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CommentHandlers - Integration Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('createComment - Group Target', () => {
        it('should create a group comment successfully with valid data', async () => {
            // Register user via API instead of seeding
            const registrationResult = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withEmail('test-user@test.com')
                    .withDisplayName('Test User')
                    .build(),
            );
            const userId = registrationResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const result = await appDriver.createGroupComment(group.id, 'This is a test comment', undefined, userId);

            expect(result).toMatchObject({
                id: expect.any(String),
                text: 'This is a test comment',
                authorId: userId,
            });
        });

        it('should create a comment with whitespace trimmed', async () => {
            // Register user via API instead of seeding
            const registrationResult = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withEmail('test-user-2@test.com')
                    .withDisplayName('Test User 2')
                    .build(),
            );
            const userId = registrationResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const result = await appDriver.createGroupComment(group.id, '   test comment   ', undefined, userId);

            expect(result.text).toBe('test comment');
        });

        it('should sanitize XSS attempts in comment text', async () => {
            // Register user via API instead of seeding
            const registrationResult = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withEmail('test-user-3@test.com')
                    .withDisplayName('Test User 3')
                    .build(),
            );
            const userId = registrationResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const result = await appDriver.createGroupComment(group.id, '<script>alert("xss")</script>Safe text', undefined, userId);

            expect(result.text).not.toContain('<script>');
            expect(result.text).toContain('Safe text');
        });

        it('should reject comment with empty text', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            await expect(appDriver.createGroupComment(groupId, '', undefined, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_COMMENT_TEXT' }),
                }),
            );
        });

        it('should reject comment with only whitespace', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';

            await expect(appDriver.createGroupComment(groupId, '   ', undefined, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_COMMENT_TEXT' }),
                }),
            );
        });

        it('should reject comment with text exceeding 500 characters', async () => {
            const groupId = 'test-group';
            const userId = 'test-user';
            const longText = 'a'.repeat(501);

            await expect(appDriver.createGroupComment(groupId, longText, undefined, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'VALIDATION_ERROR',
                    data: expect.objectContaining({ detail: 'INVALID_COMMENT_TEXT' }),
                }),
            );
        });

        it('should reject comment when user is not a group member', async () => {
            // Register both users via API
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withEmail('non-member@test.com')
                    .withDisplayName('Non Member')
                    .build(),
            );
            const userId = userResult.user.uid;

            const creatorResult = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withEmail('creator@test.com')
                    .withDisplayName('Group Creator')
                    .build(),
            );
            const creatorId = creatorResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);

            await expect(appDriver.createGroupComment(group.id, 'Test comment', undefined, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject comment for non-existent group', async () => {
            const groupId = 'non-existent-group';

            // Register user via API
            const registrationResult = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withEmail('test-user-nonexist@test.com')
                    .withDisplayName('Test User')
                    .build(),
            );
            const userId = registrationResult.user.uid;

            await expect(appDriver.createGroupComment(groupId, 'Test comment', undefined, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('createComment - Expense Target', () => {
        it('should create an expense comment successfully with valid data', async () => {
            // Register user via API
            const registrationResult = await appDriver.registerUser(
                new UserRegistrationBuilder()
                    .withEmail('expense-comment-user@test.com')
                    .withDisplayName('Expense User')
                    .build(),
            );
            const userId = registrationResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
            );

            const result = await appDriver.createExpenseComment(expense.id, 'This is an expense comment', undefined, userId);

            expect(result).toMatchObject({
                id: expect.any(String),
                text: 'This is an expense comment',
                authorId: userId,
            });
        });

        it('should reject expense comment when user is not a group member', async () => {
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const creatorResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const creatorId = creatorResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(creatorId)
                    .withParticipants([creatorId])
                    .build(),
                creatorId,
            );

            await expect(appDriver.createExpenseComment(expense.id, 'Test comment', undefined, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject expense comment for non-existent expense', async () => {
            const expenseId = 'non-existent-expense';

            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            await expect(appDriver.createExpenseComment(expenseId, 'Test comment', undefined, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('listGroupComments', () => {
        it('should list group comments successfully', async () => {
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const result = await appDriver.listGroupComments(group.id, {}, userId);

            expect(result).toMatchObject({
                comments: expect.any(Array),
                hasMore: expect.any(Boolean),
            });
        });

        it('should return empty array when no comments exist', async () => {
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const result = await appDriver.listGroupComments(group.id, {}, userId);

            expect(result.comments).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        it('should reject listing comments when user is not a group member', async () => {
            // Register users via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const creatorResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const creatorId = creatorResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);

            await expect(appDriver.listGroupComments(group.id, {}, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject listing comments for non-existent group', async () => {
            const groupId = 'non-existent-group';

            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            await expect(appDriver.listGroupComments(groupId, {}, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should return newest comments first with full metadata', async () => {
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const first = await appDriver.createGroupComment(group.id, 'First comment', undefined, userId);
            await sleep(2);
            const second = await appDriver.createGroupComment(group.id, 'Second comment', undefined, userId);
            await sleep(2);
            const third = await appDriver.createGroupComment(group.id, 'Third comment', undefined, userId);

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
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const created: CommentDTO[] = [];
            for (let i = 1; i <= 5; i++) {
                created.push(await appDriver.createGroupComment(group.id, `Comment ${i}`, undefined, userId));
                await sleep(2);
            }

            const firstPage = await appDriver.listGroupComments(group.id, { limit: 2 }, userId);
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

        it('should reject invalid pagination limit', async () => {
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            await appDriver.createGroupComment(group.id, 'Validation comment', undefined, userId);

            // limit: 0 should fail validation (min is 1)
            await expect(appDriver.listGroupComments(group.id, { limit: 0 }, userId))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'VALIDATION_ERROR',
                        data: expect.objectContaining({ detail: 'INVALID_QUERY_PARAMS' }),
                    }),
                );
        });
    });

    describe('listExpenseComments', () => {
        it('should list expense comments successfully', async () => {
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
            );

            const result = await appDriver.listExpenseComments(expense.id, {}, userId);

            expect(result).toMatchObject({
                comments: expect.any(Array),
                hasMore: expect.any(Boolean),
            });
        });

        it('should return empty array when no expense comments exist', async () => {
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
            );

            const result = await appDriver.listExpenseComments(expense.id, {}, userId);

            expect(result.comments).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        it('should reject listing comments when user is not a group member', async () => {
            // Register users via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const creatorResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const creatorId = creatorResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), creatorId);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(creatorId)
                    .withParticipants([creatorId])
                    .build(),
                creatorId,
            );

            await expect(appDriver.listExpenseComments(expense.id, {}, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.FORBIDDEN,
                }),
            );
        });

        it('should reject listing comments for non-existent expense', async () => {
            const expenseId = 'non-existent-expense';

            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            await expect(appDriver.listExpenseComments(expenseId, {}, userId)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should return newest expense comments first with expected metadata', async () => {
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
            );

            const first = await appDriver.createExpenseComment(expense.id, 'Expense comment 1', undefined, userId);
            await sleep(2);
            const second = await appDriver.createExpenseComment(expense.id, 'Expense comment 2', undefined, userId);

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
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
            );

            const created: CommentDTO[] = [];
            for (let i = 1; i <= 4; i++) {
                created.push(await appDriver.createExpenseComment(expense.id, `Expense comment ${i}`, undefined, userId));
                await sleep(2);
            }

            const firstPage = await appDriver.listExpenseComments(expense.id, { limit: 2 }, userId);
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

        it('should reject invalid pagination limit for expense comments', async () => {
            // Register user via API instead of seeding
            const userResult = await appDriver.registerUser(
                new UserRegistrationBuilder().build(),
            );
            const userId = userResult.user.uid;

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expense = await appDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(userId)
                    .withParticipants([userId])
                    .build(),
                userId,
            );

            await appDriver.createExpenseComment(expense.id, 'Expense validation comment', undefined, userId);

            // limit: 0 should fail validation (min is 1)
            await expect(appDriver.listExpenseComments(expense.id, { limit: 0 }, userId))
                .rejects
                .toThrow(
                    expect.objectContaining({
                        statusCode: HTTP_STATUS.BAD_REQUEST,
                        code: 'VALIDATION_ERROR',
                        data: expect.objectContaining({ detail: 'INVALID_QUERY_PARAMS' }),
                    }),
                );
        });
    });

    describe('Static Factory Method', () => {
        it('should create CommentHandlers instance with CommentService', () => {
            const db = new StubFirestoreDatabase();
            const authService = new StubAuthService();
            const componentBuilder = new ComponentBuilder(
                authService,
                db,
                new StubStorage({ defaultBucketName: 'test-bucket' }),
                new StubCloudTasksClient(),
                createUnitTestServiceConfig(),
            );
            const handlers = new CommentHandlers(componentBuilder.buildCommentService());
            expect(handlers).toBeInstanceOf(CommentHandlers);
            expect(handlers.createComment).toBeDefined();
            expect(handlers.listGroupComments).toBeDefined();
            expect(handlers.listExpenseComments).toBeDefined();
        });
    });
});
