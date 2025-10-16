import type { UpdateExpenseRequest } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ExpenseHandlers } from '../../../expenses/ExpenseHandlers';
import { AppDriver } from '../AppDriver';

describe('ExpenseHandlers - Unit Tests', () => {
    let appDriver: AppDriver;

    beforeEach(() => {
        appDriver = new AppDriver();
    });

    describe('createExpense', () => {
        it('should create an expense successfully with valid data', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';

            appDriver.seedUser(userId, {});
            appDriver.seedUser(payerId, {});

            const group = await appDriver.createGroup(userId);
            const { linkId } = await appDriver.generateShareableLink(userId, group.id);
            await appDriver.joinGroupByLink(payerId, linkId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(payerId)
                .withParticipants([userId, payerId])
                .build();

            const result = await appDriver.createExpense(userId, expenseRequest);

            expect(result).toMatchObject({
                id: expect.any(String),
                groupId: group.id,
                paidBy: payerId,
            });
        });

        it('should create expense with receipt URL', async () => {
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .withReceiptUrl('https://example.com/receipt.jpg')
                .build();

            const result = await appDriver.createExpense(userId, expenseRequest);

            expect(result.receiptUrl).toBe('https://example.com/receipt.jpg');
        });

        it('should reject expense with missing group ID', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).groupId = '';

            await expect(appDriver.createExpense(userId, expenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_GROUP_ID',
                }),
            );
        });

        it('should reject expense with missing payer', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).paidBy = '';

            await expect(appDriver.createExpense(userId, expenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'MISSING_PAYER',
                }),
            );
        });

        it('should reject expense with zero amount', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).amount = 0;

            await expect(appDriver.createExpense(userId, expenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT',
                }),
            );
        });

        it('should reject expense with negative amount', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).amount = -50;

            await expect(appDriver.createExpense(userId, expenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT',
                }),
            );
        });

        it('should reject expense with empty description', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).description = '';

            await expect(appDriver.createExpense(userId, expenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_DESCRIPTION',
                }),
            );
        });

        it('should reject expense with invalid category', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).category = 'a'.repeat(51);

            await expect(appDriver.createExpense(userId, expenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_CATEGORY',
                }),
            );
        });

        it('should reject expense with invalid split type', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).splitType = 'invalid';

            await expect(appDriver.createExpense(userId, expenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_SPLIT_TYPE',
                }),
            );
        });

        it('should reject expense with no participants', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).participants = [];

            await expect(appDriver.createExpense(userId, expenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_PARTICIPANTS',
                }),
            );
        });

        it('should reject expense when payer is not a participant', async () => {
            const userId = 'test-user';
            const payerId = 'payer-user';
            const otherUser = 'other-user';

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withPaidBy(payerId)
                .withParticipants([otherUser])
                .build();

            await expect(appDriver.createExpense(userId, expenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'PAYER_NOT_PARTICIPANT',
                }),
            );
        });

        it('should reject expense with excessive precision for JPY', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder()
                .withAmount(100.50)
                .withCurrency('JPY')
                .build();

            await expect(appDriver.createExpense(userId, expenseRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT_PRECISION',
                }),
            );
        });
    });

    describe('updateExpense', () => {
        it('should update expense description successfully', async () => {
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();

            const expense = await appDriver.createExpense(userId, expenseRequest);

            const updateRequest: UpdateExpenseRequest = {
                description: 'Updated description',
            };

            const result = await appDriver.updateExpense(userId, expense.id, updateRequest);

            expect(result.description).toBe('Updated description');
        });

        it('should update expense category successfully', async () => {
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();

            const expense = await appDriver.createExpense(userId, expenseRequest);

            const updateRequest: UpdateExpenseRequest = {
                category: 'Transport',
            };

            const result = await appDriver.updateExpense(userId, expense.id, updateRequest);

            expect(result.category).toBe('Transport');
        });

        it('should reject update with invalid expense ID', async () => {
            const updateRequest: UpdateExpenseRequest = { amount: '150' };

            await expect(appDriver.updateExpense('test-user', '', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_EXPENSE_ID',
                }),
            );
        });

        it('should reject update with no fields provided', async () => {
            const updateRequest = {};

            await expect(appDriver.updateExpense('test-user', 'test-expense', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'NO_UPDATE_FIELDS',
                }),
            );
        });

        it('should reject update with invalid amount precision when currency provided', async () => {
            const updateRequest: UpdateExpenseRequest = {
                amount: '100.50',
                currency: 'JPY',
            };

            await expect(appDriver.updateExpense('test-user', 'test-expense', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_AMOUNT_PRECISION',
                }),
            );
        });

        it('should reject update with empty description', async () => {
            const updateRequest: UpdateExpenseRequest = {
                description: '',
            };

            await expect(appDriver.updateExpense('test-user', 'test-expense', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_DESCRIPTION',
                }),
            );
        });

        it('should reject update with invalid category length', async () => {
            const updateRequest: UpdateExpenseRequest = {
                category: 'a'.repeat(51),
            };

            await expect(appDriver.updateExpense('test-user', 'test-expense', updateRequest)).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_CATEGORY',
                }),
            );
        });
    });

    describe('deleteExpense', () => {
        it('should soft delete expense successfully', async () => {
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();

            const expense = await appDriver.createExpense(userId, expenseRequest);

            const result = await appDriver.deleteExpense(userId, expense.id);

            expect(result).toMatchObject({
                message: 'Expense deleted successfully',
            });
        });

        it('should reject delete with invalid expense ID', async () => {
            await expect(appDriver.deleteExpense('test-user', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_EXPENSE_ID',
                }),
            );
        });

        it('should reject delete of non-existent expense', async () => {
            await expect(appDriver.deleteExpense('test-user', 'non-existent-expense')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });

        it('should allow group admin to delete expense created by another user', async () => {
            const adminId = 'admin-user';
            const creatorId = 'creator-user';

            appDriver.seedUser(adminId, {});
            appDriver.seedUser(creatorId, {});

            const group = await appDriver.createGroup(adminId);
            const { linkId } = await appDriver.generateShareableLink(adminId, group.id);
            await appDriver.joinGroupByLink(creatorId, linkId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(creatorId)
                .withParticipants([creatorId])
                .build();

            const expense = await appDriver.createExpense(creatorId, expenseRequest);

            const result = await appDriver.deleteExpense(adminId, expense.id);

            expect(result).toMatchObject({
                message: 'Expense deleted successfully',
            });
        });
    });

    describe('getExpenseFullDetails', () => {
        it('should get full expense details successfully', async () => {
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(userId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();

            const expense = await appDriver.createExpense(userId, expenseRequest);

            const result = await appDriver.getExpenseFullDetails(userId, expense.id);

            expect(result).toMatchObject({
                expense: expect.objectContaining({
                    id: expense.id,
                    groupId: group.id,
                }),
                group: expect.objectContaining({
                    id: group.id,
                }),
                members: expect.objectContaining({
                    members: expect.any(Array),
                }),
            });
        });

        it('should reject request with invalid expense ID', async () => {
            await expect(appDriver.getExpenseFullDetails('test-user', '')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_EXPENSE_ID',
                }),
            );
        });

        it('should reject request for non-existent expense', async () => {
            await expect(appDriver.getExpenseFullDetails('test-user', 'non-existent-expense')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create ExpenseHandlers instance with default ApplicationBuilder', () => {
            const handlers = ExpenseHandlers.createExpenseHandlers();
            expect(handlers).toBeInstanceOf(ExpenseHandlers);
            expect(handlers.createExpense).toBeDefined();
            expect(handlers.updateExpense).toBeDefined();
            expect(handlers.deleteExpense).toBeDefined();
            expect(handlers.getExpenseFullDetails).toBeDefined();
        });
    });
});
