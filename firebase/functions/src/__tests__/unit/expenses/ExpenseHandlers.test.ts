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
                .withAmount(100.50, 'JPY')
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

    describe('Expense Creation and Basic Operations', () => {
        it('should create expense with equal splits and retrieve it', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            const user3 = 'user-3';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});
            appDriver.seedUser(user3, {});

            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(90.0, 'USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2, user3])
                .withSplitType('equal')
                .build();

            const created = await appDriver.createExpense(user1, expenseData);
            expect(created.id).toBeDefined();
            expect(created.splits).toHaveLength(3);
            expect(created.splits[0].amount).toBe('30.00');
            expect(created.splits[1].amount).toBe('30.00');
            expect(created.splits[2].amount).toBe('30.00');

            const retrieved = await appDriver.getExpense(user1, created.id);
            expect(retrieved.description).toBe(expenseData.description);
            expect(retrieved.amount).toBe('90');
            expect(retrieved.paidBy).toBe(user1);
        });

        it('should list and paginate group expenses', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            const user3 = 'user-3';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});
            appDriver.seedUser(user3, {});

            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const expense1 = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1)
                    .withParticipants([user1, user2, user3])
                    .withDescription('First Test Expense')
                    .build(),
            );

            const expense2 = await appDriver.createExpense(
                user2,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user2)
                    .withParticipants([user1, user2, user3])
                    .withDescription('Second Test Expense')
                    .build(),
            );

            const expenses = await appDriver.getGroupExpenses(user1, group.id);
            expect(expenses.expenses.length).toBeGreaterThanOrEqual(2);
            const descriptions = expenses.expenses.map((e) => e.description);
            expect(descriptions).toContain('First Test Expense');
            expect(descriptions).toContain('Second Test Expense');
        });
    });

    describe('Expense Updates and Edit History', () => {
        it('should update expenses and track edit history', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});

            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(100, 'USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplitType('equal')
                .build();

            const created = await appDriver.createExpense(user1, expenseData);

            const updateData = {
                description: 'Updated Test Expense',
                amount: '150.50',
                currency: 'USD',
                category: 'food',
                participants: [user1, user2],
                splitType: 'equal' as const,
                splits: [
                    { uid: user1, amount: '75.25' },
                    { uid: user2, amount: '75.25' },
                ],
            };

            // Add small delay to ensure updatedAt > createdAt (prevent identical timestamps)
            await new Promise((resolve) => setTimeout(resolve, 10));

            await appDriver.updateExpense(user1, created.id, updateData);

            const updated = await appDriver.getExpense(user1, created.id);
            expect(updated.description).toBe('Updated Test Expense');
            expect(updated.amount).toBe('150.50');
            expect(updated.category).toBe('food');
            expect(updated.updatedAt).toBeDefined();
            expect(new Date(updated.updatedAt!).getTime()).toBeGreaterThan(new Date(updated.createdAt).getTime());
        });

        it('should flip balance direction when payer changes', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});

            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);

            const createData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(60, 'EUR')
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplitType('equal')
                .build();

            const created = await appDriver.createExpense(user1, createData);

            const updatePayload = {
                amount: '60.00',
                currency: 'EUR',
                paidBy: user2,
                participants: [user1, user2],
                splitType: 'equal' as const,
                splits: [
                    { uid: user1, amount: '30.00' },
                    { uid: user2, amount: '30.00' },
                ],
            };

            await appDriver.updateExpense(user1, created.id, updatePayload);

            const balances = await appDriver.getGroupBalances(user1, group.id);
            const currencyBalances = balances.balancesByCurrency?.EUR;
            expect(currencyBalances).toBeDefined();

            const user1Balance = currencyBalances![user1];
            const user2Balance = currencyBalances![user2];

            expect(user1Balance.owes[user2]).toBe('30.00');
            expect(user1Balance.owedBy[user2]).toBeUndefined();
            expect(user2Balance.owedBy[user1]).toBe('30.00');
            expect(user2Balance.owes[user1]).toBeUndefined();
        });

        it('should enforce update permissions for group members', async () => {
            const admin = 'admin-user';
            const member1 = 'member-1';
            const member2 = 'member-2';

            appDriver.seedUser(admin, {});
            appDriver.seedUser(member1, {});
            appDriver.seedUser(member2, {});

            const group = await appDriver.createGroup(admin);
            const { linkId } = await appDriver.generateShareableLink(admin, group.id);
            await appDriver.joinGroupByLink(member1, linkId);
            await appDriver.joinGroupByLink(member2, linkId);

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Permission Test Expense')
                .withAmount(100, 'USD')
                .withPaidBy(admin)
                .withParticipants([admin, member1])
                .withSplitType('equal')
                .build();

            const created = await appDriver.createExpense(admin, expenseData);

            // Creator should be able to update
            await appDriver.updateExpense(admin, created.id, {
                amount: '150.00',
                currency: 'USD',
                participants: [admin, member1],
                splitType: 'equal' as const,
                splits: [
                    { uid: admin, amount: '75.00' },
                    { uid: member1, amount: '75.00' },
                ],
            });

            // Non-creator group member should also be able to update
            const updated = await appDriver.updateExpense(member2, created.id, {
                description: 'Updated by non-creator',
                amount: '120.00',
                currency: 'USD',
                participants: [admin, member1],
                splitType: 'equal' as const,
                splits: [
                    { uid: admin, amount: '60.00' },
                    { uid: member1, amount: '60.00' },
                ],
            });

            expect(updated.description).toBe('Updated by non-creator');
        });
    });

    describe('Expense Deletion and Soft Delete Behavior', () => {
        it('should handle expense deletion with proper access control', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            const user3 = 'user-3';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});
            appDriver.seedUser(user3, {});

            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withAmount(100, 'USD')
                .withDescription('Expense to delete')
                .withSplitType('equal')
                .build();

            const expense = await appDriver.createExpense(user1, expenseData);

            // Should soft delete successfully
            await appDriver.deleteExpense(user1, expense.id);
            await expect(appDriver.getExpense(user1, expense.id)).rejects.toThrow();

            // Should prevent deletion by non-group member
            const anotherExpense = await appDriver.createExpense(user1, expenseData);
            await expect(appDriver.deleteExpense(user3, anotherExpense.id)).rejects.toThrow();
        });

        it('should filter deleted expenses from listings', async () => {
            const user1 = 'user-1';

            appDriver.seedUser(user1, {});

            const group = await appDriver.createGroup(user1);

            const expense1 = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1)
                    .withParticipants([user1])
                    .withAmount(100, 'USD')
                    .build(),
            );

            const expense2 = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1)
                    .withParticipants([user1])
                    .withAmount(100, 'USD')
                    .build(),
            );

            // Verify both expenses are visible before deletion
            const beforeDeletion = await appDriver.getGroupExpenses(user1, group.id);
            expect(beforeDeletion.expenses.find((e) => e.id === expense1.id)).toBeDefined();
            expect(beforeDeletion.expenses.find((e) => e.id === expense2.id)).toBeDefined();
            expect(beforeDeletion.expenses.length).toBeGreaterThanOrEqual(2);

            // Delete one expense
            await appDriver.deleteExpense(user1, expense1.id);

            // Should filter out deleted by default
            const afterDeletion = await appDriver.getGroupExpenses(user1, group.id);
            expect(afterDeletion.expenses.find((e) => e.id === expense1.id)).toBeUndefined();
            expect(afterDeletion.expenses.find((e) => e.id === expense2.id)).toBeDefined();
            expect(afterDeletion.expenses.length).toBe(beforeDeletion.expenses.length - 1);
        });
    });

    describe('Full Details API and Complex Data Handling', () => {
        it('should return consolidated expense data with group and members', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            const user3 = 'user-3';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});
            appDriver.seedUser(user3, {});

            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1)
                    .withParticipants([user1, user2, user3])
                    .build(),
            );

            const fullDetails = await appDriver.getExpenseFullDetails(user1, expense.id);

            // Verify expense data
            expect(fullDetails.expense.id).toBe(expense.id);
            expect(fullDetails.expense.participants).toEqual([user1, user2, user3]);
            expect(fullDetails.expense.splits).toHaveLength(3);

            // Verify group data
            expect(fullDetails.group.id).toBe(group.id);
            expect(fullDetails.group.name).toBeDefined();

            // Verify members data
            expect(fullDetails.members.members).toHaveLength(3);
            const memberUids = fullDetails.members.members.map((m) => m.uid);
            expect(memberUids).toEqual(expect.arrayContaining([user1, user2, user3]));
        });

        it('should handle complex split scenarios in full details', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            const user3 = 'user-3';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});
            appDriver.seedUser(user3, {});

            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            const complexExpense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(user2)
                    .withParticipants([user1, user2, user3])
                    .withSplitType('exact')
                    .withSplits([
                        { uid: user1, amount: '30' },
                        { uid: user2, amount: '40' },
                        { uid: user3, amount: '30' },
                    ])
                    .build(),
            );

            const fullDetails = await appDriver.getExpenseFullDetails(user2, complexExpense.id);

            expect(fullDetails.expense.splitType).toBe('exact');
            expect(fullDetails.expense.splits.find((s) => s.uid === user1)?.amount).toBe('30');
            expect(fullDetails.expense.splits.find((s) => s.uid === user2)?.amount).toBe('40');
            expect(fullDetails.expense.splits.find((s) => s.uid === user3)?.amount).toBe('30');
        });

        it('should deny non-participants from viewing full details', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});

            const group = await appDriver.createGroup(user1);

            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1)
                    .withParticipants([user1])
                    .build(),
            );

            // Non-participant (user2) should be denied access - matches Firestore security rules
            await expect(appDriver.getExpenseFullDetails(user2, expense.id))
                .rejects
                .toMatchObject({ code: 'FORBIDDEN' });

            // Invalid expense should return 404
            await expect(appDriver.getExpenseFullDetails(user1, 'invalid-expense-id')).rejects.toThrow();
        });

        it('should view expense details after a participant leaves the group', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            const user3 = 'user-3';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});
            appDriver.seedUser(user3, {});

            const group = await appDriver.createGroup(user1);
            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);
            await appDriver.joinGroupByLink(user3, linkId);

            // Create expense with all 3 participants (user1 pays, user2 and user3 owe money)
            const expense = await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(90, 'USD')
                    .withPaidBy(user1)
                    .withParticipants([user1, user2, user3])
                    .withSplitType('equal')
                    .build(),
            );

            // User2 settles their debt with user1 so they can leave
            await appDriver.createSettlement(user2, {
                groupId: group.id,
                payerId: user2,
                payeeId: user1,
                amount: '30.00',
                currency: 'USD',
                note: 'Settling up before leaving',
            });

            // User2 leaves the group
            await appDriver.leaveGroup(user2, group.id);

            // User1 views expense details - should still see User2's info
            const fullDetails = await appDriver.getExpenseFullDetails(user1, expense.id);

            // Assertions
            expect(fullDetails.expense.participants).toHaveLength(3);
            expect(fullDetails.members.members).toHaveLength(3); // All 3 participants included

            // Find departed member in members array
            const departedMember = fullDetails.members.members.find((m) => m.uid === user2);
            expect(departedMember).toBeDefined();

            // Verify departed member still has real user data
            if (departedMember) {
                expect(departedMember.displayName).toBeDefined();
                expect(departedMember.uid).toBe(user2);
                expect(departedMember.memberStatus).toBe('active');
            }

            // Verify other participants are still current members
            const currentMember1 = fullDetails.members.members.find((m) => m.uid === user1);
            expect(currentMember1?.memberStatus).toBe('active');
            const currentMember3 = fullDetails.members.members.find((m) => m.uid === user3);
            expect(currentMember3?.memberStatus).toBe('active');
        });
    });
});
