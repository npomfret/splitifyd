import type { UpdateExpenseRequest } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, SplitifydFirestoreTestDatabase } from '@splitifyd/test-support';
import { beforeEach, describe, expect, it } from 'vitest';
import { HTTP_STATUS } from '../../../constants';
import { ExpenseHandlers } from '../../../expenses/ExpenseHandlers';
import { ComponentBuilder } from '../../../services/ComponentBuilder';
import { AppDriver } from '../AppDriver';
import { StubAuthService } from '../mocks/StubAuthService';

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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, userId);
            await appDriver.joinGroupByLink(shareToken, undefined, payerId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(payerId)
                .withParticipants([userId, payerId])
                .build();

            const result = await appDriver.createExpense(expenseRequest, userId);

            expect(result).toMatchObject({
                id: expect.any(String),
                groupId: group.id,
                paidBy: payerId,
            });
        });

        it('should create expense with receipt URL', async () => {
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .withReceiptUrl('https://example.com/receipt.jpg')
                .build();

            const result = await appDriver.createExpense(expenseRequest, userId);

            expect(result.receiptUrl).toBe('https://example.com/receipt.jpg');
        });

        it('should reject expense with missing group ID', async () => {
            const userId = 'test-user';
            const expenseRequest = new CreateExpenseRequestBuilder().build();
            (expenseRequest as any).groupId = '';

            await expect(appDriver.createExpense(expenseRequest, userId)).rejects.toThrow(
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

            await expect(appDriver.createExpense(expenseRequest, userId)).rejects.toThrow(
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

            await expect(appDriver.createExpense(expenseRequest, userId)).rejects.toThrow(
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

            await expect(appDriver.createExpense(expenseRequest, userId)).rejects.toThrow(
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

            await expect(appDriver.createExpense(expenseRequest, userId)).rejects.toThrow(
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

            await expect(appDriver.createExpense(expenseRequest, userId)).rejects.toThrow(
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

            await expect(appDriver.createExpense(expenseRequest, userId)).rejects.toThrow(
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

            await expect(appDriver.createExpense(expenseRequest, userId)).rejects.toThrow(
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

            await expect(appDriver.createExpense(expenseRequest, userId)).rejects.toThrow(
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

            await expect(appDriver.createExpense(expenseRequest, userId)).rejects.toThrow(
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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();

            const expense = await appDriver.createExpense(expenseRequest, userId);

            const updateRequest: UpdateExpenseRequest = {
                description: 'Updated description',
            };

            const result = await appDriver.updateExpense(expense.id, updateRequest, userId);

            expect(result.description).toBe('Updated description');
        });

        it('should update expense category successfully', async () => {
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();

            const expense = await appDriver.createExpense(expenseRequest, userId);

            const updateRequest: UpdateExpenseRequest = {
                category: 'Transport',
            };

            const result = await appDriver.updateExpense(expense.id, updateRequest, userId);

            expect(result.category).toBe('Transport');
        });

        it('should reject update with invalid expense ID', async () => {
            const updateRequest: UpdateExpenseRequest = { amount: '150' };

            await expect(appDriver.updateExpense('', updateRequest, 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_EXPENSE_ID',
                }),
            );
        });

        it('should reject update with no fields provided', async () => {
            const updateRequest = {};

            await expect(appDriver.updateExpense('test-expense', updateRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.updateExpense('test-expense', updateRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.updateExpense('test-expense', updateRequest, 'test-user')).rejects.toThrow(
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

            await expect(appDriver.updateExpense('test-expense', updateRequest, 'test-user')).rejects.toThrow(
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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();

            const expense = await appDriver.createExpense(expenseRequest, userId);

            const result = await appDriver.deleteExpense(expense.id, userId);

            expect(result).toMatchObject({
                message: 'Expense deleted successfully',
            });
        });

        it('should reject delete with invalid expense ID', async () => {
            await expect(appDriver.deleteExpense('', 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_EXPENSE_ID',
                }),
            );
        });

        it('should reject delete of non-existent expense', async () => {
            await expect(appDriver.deleteExpense('non-existent-expense', 'test-user')).rejects.toThrow(
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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), adminId);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, adminId);
            await appDriver.joinGroupByLink(shareToken, undefined, creatorId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(creatorId)
                .withParticipants([creatorId])
                .build();

            const expense = await appDriver.createExpense(expenseRequest, creatorId);

            const result = await appDriver.deleteExpense(expense.id, adminId);

            expect(result).toMatchObject({
                message: 'Expense deleted successfully',
            });
        });
    });

    describe('getExpenseFullDetails', () => {
        it('should get full expense details successfully', async () => {
            const userId = 'test-user';

            appDriver.seedUser(userId, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), userId);

            const expenseRequest = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(userId)
                .withParticipants([userId])
                .build();

            const expense = await appDriver.createExpense(expenseRequest, userId);

            const result = await appDriver.getExpenseFullDetails(expense.id, userId);

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
            await expect(appDriver.getExpenseFullDetails('', 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.BAD_REQUEST,
                    code: 'INVALID_EXPENSE_ID',
                }),
            );
        });

        it('should reject request for non-existent expense', async () => {
            await expect(appDriver.getExpenseFullDetails('non-existent-expense', 'test-user')).rejects.toThrow(
                expect.objectContaining({
                    statusCode: HTTP_STATUS.NOT_FOUND,
                }),
            );
        });
    });

    describe('Static Factory Method', () => {
        it('should create ExpenseHandlers instance with ExpenseService', () => {
            const db = new SplitifydFirestoreTestDatabase();
            const authService = new StubAuthService();
            const componentBuilder = new ComponentBuilder(authService, db);
            const handlers = new ExpenseHandlers(componentBuilder.buildExpenseService());
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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(90.0, 'USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2, user3])
                .withSplitType('equal')
                .build();

            const created = await appDriver.createExpense(expenseData, user1);
            expect(created.id).toBeDefined();
            expect(created.splits).toHaveLength(3);
            expect(created.splits[0].amount).toBe('30.00');
            expect(created.splits[1].amount).toBe('30.00');
            expect(created.splits[2].amount).toBe('30.00');

            const retrieved = await appDriver.getExpense(created.id, user1);
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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(user1)
                .withParticipants([user1, user2, user3])
                .withDescription('First Test Expense')
                .build(), user1);

            await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(user2)
                .withParticipants([user1, user2, user3])
                .withDescription('Second Test Expense')
                .build(), user2);

            const expenses = await appDriver.getGroupExpenses(group.id, {}, user1);
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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(100, 'USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplitType('equal')
                .build();

            const created = await appDriver.createExpense(expenseData, user1);

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

            await appDriver.updateExpense(created.id, updateData, user1);

            const updated = await appDriver.getExpense(created.id, user1);
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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const createData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(60, 'EUR')
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withSplitType('equal')
                .build();

            const created = await appDriver.createExpense(createData, user1);

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

            await appDriver.updateExpense(created.id, updatePayload, user1);

            const balances = await appDriver.getGroupBalances(group.id, user1);
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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), admin);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, admin);
            await appDriver.joinGroupByLink(shareToken, undefined, member1);
            await appDriver.joinGroupByLink(shareToken, undefined, member2);

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Permission Test Expense')
                .withAmount(100, 'USD')
                .withPaidBy(admin)
                .withParticipants([admin, member1])
                .withSplitType('equal')
                .build();

            const created = await appDriver.createExpense(expenseData, admin);

            // Creator should be able to update
            await appDriver.updateExpense(created.id, {
                amount: '150.00',
                currency: 'USD',
                participants: [admin, member1],
                splitType: 'equal' as const,
                splits: [
                    {uid: admin, amount: '75.00'},
                    {uid: member1, amount: '75.00'},
                ],
            }, admin);

            // Non-creator group member should also be able to update
            const updated = await appDriver.updateExpense(created.id, {
                description: 'Updated by non-creator',
                amount: '120.00',
                currency: 'USD',
                participants: [admin, member1],
                splitType: 'equal' as const,
                splits: [
                    {uid: admin, amount: '60.00'},
                    {uid: member1, amount: '60.00'},
                ],
            }, member2);

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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(user1)
                .withParticipants([user1, user2])
                .withAmount(100, 'USD')
                .withDescription('Expense to delete')
                .withSplitType('equal')
                .build();

            const expense = await appDriver.createExpense(expenseData, user1);

            // Should soft delete successfully
            await appDriver.deleteExpense(expense.id, user1);
            await expect(appDriver.getExpense(expense.id, user1)).rejects.toThrow();

            // Should prevent deletion by non-group member
            const anotherExpense = await appDriver.createExpense(expenseData, user1);
            await expect(appDriver.deleteExpense(anotherExpense.id, user3)).rejects.toThrow();
        });

        it('should filter deleted expenses from listings', async () => {
            const user1 = 'user-1';

            appDriver.seedUser(user1, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            const expense1 = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(user1)
                .withParticipants([user1])
                .withAmount(100, 'USD')
                .build(), user1);

            const expense2 = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(user1)
                .withParticipants([user1])
                .withAmount(100, 'USD')
                .build(), user1);

            // Verify both expenses are visible before deletion
            const beforeDeletion = await appDriver.getGroupExpenses(group.id, {}, user1);
            expect(beforeDeletion.expenses.find((e) => e.id === expense1.id)).toBeDefined();
            expect(beforeDeletion.expenses.find((e) => e.id === expense2.id)).toBeDefined();
            expect(beforeDeletion.expenses.length).toBeGreaterThanOrEqual(2);

            // Delete one expense
            await appDriver.deleteExpense(expense1.id, user1);

            // Should filter out deleted by default
            const afterDeletion = await appDriver.getGroupExpenses(group.id, {}, user1);
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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(user1)
                .withParticipants([user1, user2, user3])
                .build(), user1);

            const fullDetails = await appDriver.getExpenseFullDetails(expense.id, user1);

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

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            const complexExpense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(100, 'USD')
                .withPaidBy(user2)
                .withParticipants([user1, user2, user3])
                .withSplitType('exact')
                .withSplits([
                    {uid: user1, amount: '30'},
                    {uid: user2, amount: '40'},
                    {uid: user3, amount: '30'},
                ])
                .build(), user1);

            const fullDetails = await appDriver.getExpenseFullDetails(complexExpense.id, user2);

            expect(fullDetails.expense.splitType).toBe('exact');
            expect(fullDetails.expense.splits.find((s) => s.uid === user1)?.amount).toBe('30');
            expect(fullDetails.expense.splits.find((s) => s.uid === user2)?.amount).toBe('40');
            expect(fullDetails.expense.splits.find((s) => s.uid === user3)?.amount).toBe('30');
        });

        it('should allow non-participants to view full details', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);

            // Add user2 to the group (non-participant in expense, but still a group member)
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);

            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withPaidBy(user1)
                .withParticipants([user1])
                .build(), user1);

            const fullDetailsForNonParticipant = await appDriver.getExpenseFullDetails(expense.id, user2);
            expect(fullDetailsForNonParticipant.expense.id).toBe(expense.id);
            expect(fullDetailsForNonParticipant.expense.participants).toEqual([user1]);

            // Invalid expense should return 404
            await expect(appDriver.getExpenseFullDetails('invalid-expense-id', user1)).rejects.toThrow();
        });

        it('should view expense details after a participant leaves the group', async () => {
            const user1 = 'user-1';
            const user2 = 'user-2';
            const user3 = 'user-3';

            appDriver.seedUser(user1, {});
            appDriver.seedUser(user2, {});
            appDriver.seedUser(user3, {});

            const group = await appDriver.createGroup(new CreateGroupRequestBuilder().build(), user1);
            const { shareToken } = await appDriver.generateShareableLink(group.id, undefined, user1);
            await appDriver.joinGroupByLink(shareToken, undefined, user2);
            await appDriver.joinGroupByLink(shareToken, undefined, user3);

            // Create expense with all 3 participants (user1 pays, user2 and user3 owe money)
            const expense = await appDriver.createExpense(new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withAmount(90, 'USD')
                .withPaidBy(user1)
                .withParticipants([user1, user2, user3])
                .withSplitType('equal')
                .build(), user1);

            // User2 settles their debt with user1 so they can leave
            await appDriver.createSettlement({
                groupId: group.id,
                payerId: user2,
                payeeId: user1,
                amount: '30.00',
                currency: 'USD',
                note: 'Settling up before leaving',
            }, user2);

            // User2 leaves the group
            await appDriver.leaveGroup(group.id, user2);

            // User1 views expense details - should still see User2's info
            const fullDetails = await appDriver.getExpenseFullDetails(expense.id, user1);

            // Assertions
            expect(fullDetails.expense.participants).toHaveLength(3);
            expect(fullDetails.members.members).toHaveLength(3); // All 3 participants included

            // Find departed member in members array
            const departedMember = fullDetails.members.members.find((m) => m.uid === user2);
            expect(departedMember).toBeDefined();

            // Verify departed member still has real user data
            if (departedMember) {
                expect(departedMember.groupDisplayName).toBeDefined();
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
