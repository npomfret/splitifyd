import { beforeEach, describe, expect, it } from 'vitest';

import {ApiDriver, ExpenseBuilder, borrowTestUsers} from '@splitifyd/test-support';
import { ExpenseService } from '../../../services/ExpenseService';
import { SplitTypes } from '@splitifyd/shared';
import { ApiError } from '../../../utils/errors';
import { HTTP_STATUS } from '../../../constants';
import {UserToken} from "@splitifyd/shared";
import {ApplicationBuilder} from "../../../services/ApplicationBuilder";
import {getFirestore} from "../../../firebase";

describe('ExpenseService - Integration Tests', () => {
    const apiDriver = new ApiDriver();
    const applicationBuilder = new ApplicationBuilder(getFirestore());
    const expenseService = applicationBuilder.buildExpenseService();

    let alice: UserToken;
    let bob: UserToken;
    let charlie: UserToken;
    let outsider: UserToken;

    let groupId: string;

    beforeEach(async () => {
        ([alice, bob, charlie, outsider] = await borrowTestUsers(4));

        // Create a fresh group for each test with managed permissions
        const group = await apiDriver.createGroupWithMembers('ExpenseService Test Group', [alice, bob, charlie], alice.token);
        groupId = group.id;
        
        // Set to managed group preset to enforce stricter permissions
        await apiDriver.apiRequest(
            `/groups/${groupId}/security/preset`,
            'POST',
            { preset: 'managed' },
            alice.token
        );
    });

    describe('getExpense', () => {
        let expenseId: string;

        beforeEach(async () => {
            // Create a test expense for getExpense tests
            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(alice.uid)
                    .withParticipants([alice.uid, bob.uid])
                    .withAmount(100)
                    .withDescription('Test expense')
                    .withSplitType('equal')
                    .build(),
                alice.token
            );
            expenseId = expense.id;
        });

        it('should successfully get expense for participant', async () => {
            const result = await expenseService.getExpense(expenseId, alice.uid);

            expect(result).toBeDefined();
            expect(result.id).toBe(expenseId);
            expect(result.groupId).toBe(groupId);
            expect(result.paidBy).toBe(alice.uid);
            expect(result.amount).toBe(100);
            expect(result.description).toBe('Test expense');
            expect(result.participants).toEqual(expect.arrayContaining([alice.uid, bob.uid]));
            expect(result.splits).toHaveLength(2);
            expect(result.createdAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });

        it('should successfully get expense for other participant', async () => {
            const result = await expenseService.getExpense(expenseId, bob.uid);

            expect(result.id).toBe(expenseId);
            expect(result.paidBy).toBe(alice.uid);
            expect(result.participants).toContain(bob.uid);
        });

        it('should deny access to group member who is not participant', async () => {
            await expect(expenseService.getExpense(expenseId, charlie.uid)).rejects.toEqual(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense')
            );
        });

        it('should deny access to non-group member', async () => {
            await expect(expenseService.getExpense(expenseId, outsider.uid)).rejects.toEqual(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_EXPENSE_PARTICIPANT', 'You are not a participant in this expense')
            );
        });

        it('should throw NOT_FOUND for non-existent expense', async () => {
            await expect(expenseService.getExpense('nonexistent', alice.uid)).rejects.toThrow('not found');
        });
    });

    describe('listGroupExpenses', () => {
        beforeEach(async () => {
            // Create multiple test expenses
            await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(alice.uid)
                    .withParticipants([alice.uid, bob.uid])
                    .withAmount(50)
                    .withDescription('First expense')
                    .withSplitType('equal')
                    .build(),
                alice.token
            );

            await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(bob.uid)
                    .withParticipants([alice.uid, bob.uid])
                    .withAmount(75)
                    .withDescription('Second expense')
                    .withSplitType('equal')
                    .build(),
                bob.token
            );

            await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(alice.uid)
                    .withParticipants([alice.uid, charlie.uid])
                    .withAmount(100)
                    .withDescription('Third expense')
                    .withSplitType('equal')
                    .build(),
                alice.token
            );
        });

        it('should list all expenses for group member', async () => {
            const result = await expenseService.listGroupExpenses(groupId, alice.uid);

            expect(result).toBeDefined();
            expect(result.expenses).toHaveLength(3);
            expect(result.count).toBe(3);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeUndefined();

            // Verify expense details
            const descriptions = result.expenses.map(e => e.description);
            expect(descriptions).toEqual(expect.arrayContaining(['First expense', 'Second expense', 'Third expense']));
        });

        it('should paginate results correctly', async () => {
            const result = await expenseService.listGroupExpenses(groupId, alice.uid, { limit: 2 });

            expect(result.expenses).toHaveLength(2);
            expect(result.count).toBe(2);
            expect(result.hasMore).toBe(true);
            expect(result.nextCursor).toBeDefined();
        });

        it('should filter out deleted expenses by default', async () => {
            // Delete one expense via API
            const expensesToDelete = await apiDriver.getGroupExpenses(groupId, alice.token);
            const expenseToDelete = expensesToDelete.expenses[0];
            await apiDriver.deleteExpense(expenseToDelete.id, alice.token);

            const result = await expenseService.listGroupExpenses(groupId, alice.uid);

            expect(result.expenses).toHaveLength(2);
        });

        it('should include deleted expenses when requested', async () => {
            // Delete one expense via API
            const expensesToDelete = await apiDriver.getGroupExpenses(groupId, alice.token);
            const expenseToDelete = expensesToDelete.expenses[0];
            await apiDriver.deleteExpense(expenseToDelete.id, alice.token);

            const result = await expenseService.listGroupExpenses(groupId, alice.uid, { includeDeleted: true });

            expect(result.expenses).toHaveLength(3);
            // One expense should have deletedAt field
            const deletedExpense = result.expenses.find(e => e.deletedAt !== null);
            expect(deletedExpense).toBeDefined();
        });

        it('should deny access to non-group member', async () => {
            await expect(expenseService.listGroupExpenses(groupId, outsider.uid)).rejects.toThrow();
        });
    });

    describe('createExpense', () => {
        it('should create expense with equal splits', async () => {
            const expenseData = {
                groupId,
                paidBy: alice.uid,
                amount: 120,
                currency: 'USD',
                description: 'Service test expense',
                category: 'Food',
                date: '2024-01-01T00:00:00.000Z',
                splitType: SplitTypes.EQUAL,
                participants: [alice.uid, bob.uid, charlie.uid],
                splits: [] // Will be calculated automatically
            };

            const result = await expenseService.createExpense(alice.uid, expenseData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.groupId).toBe(groupId);
            expect(result.paidBy).toBe(alice.uid);
            expect(result.amount).toBe(120);
            expect(result.description).toBe('Service test expense');
            expect(result.splitType).toBe(SplitTypes.EQUAL);
            expect(result.participants).toEqual([alice.uid, bob.uid, charlie.uid]);
            expect(result.splits).toHaveLength(3);
            
            // Each person should owe 40
            result.splits.forEach((split: any) => {
                expect(split.amount).toBe(40);
            });
        });

        it('should create expense with exact splits', async () => {
            const expenseData = {
                groupId,
                paidBy: alice.uid,
                amount: 100,
                currency: 'USD',
                description: 'Exact split test',
                category: 'Food',
                date: '2024-01-01T00:00:00.000Z',
                splitType: SplitTypes.EXACT,
                participants: [alice.uid, bob.uid],
                splits: [
                    { userId: alice.uid, amount: 60 },
                    { userId: bob.uid, amount: 40 }
                ]
            };

            const result = await expenseService.createExpense(alice.uid, expenseData);

            expect(result.splitType).toBe(SplitTypes.EXACT);
            expect(result.splits).toEqual([
                { userId: alice.uid, amount: 60 },
                { userId: bob.uid, amount: 40 }
            ]);
        });

        it('should create expense with percentage splits', async () => {
            const expenseData = {
                groupId,
                paidBy: alice.uid,
                amount: 100,
                currency: 'USD',
                description: 'Percentage split test',
                category: 'Food',
                date: '2024-01-01T00:00:00.000Z',
                splitType: SplitTypes.PERCENTAGE,
                participants: [alice.uid, bob.uid],
                splits: [
                    { userId: alice.uid, amount: 0, percentage: 70 },
                    { userId: bob.uid, amount: 0, percentage: 30 }
                ]
            };

            const result = await expenseService.createExpense(alice.uid, expenseData);

            expect(result.splitType).toBe(SplitTypes.PERCENTAGE);
            expect(result.splits).toEqual([
                { userId: alice.uid, amount: 70, percentage: 70 },
                { userId: bob.uid, amount: 30, percentage: 30 }
            ]);
        });

        it('should deny access to non-group member', async () => {
            const expenseData = {
                groupId,
                paidBy: outsider.uid,
                amount: 50,
                currency: 'USD',
                description: 'Unauthorized expense',
                category: 'Food',
                date: '2024-01-01T00:00:00.000Z',
                splitType: SplitTypes.EQUAL,
                participants: [outsider.uid],
                splits: []
            };

            await expect(expenseService.createExpense(outsider.uid, expenseData)).rejects.toThrow();
        });

        it('should reject expense with non-group member as payer', async () => {
            const expenseData = {
                groupId,
                paidBy: outsider.uid, // Non-member as payer
                amount: 50,
                currency: 'USD',
                description: 'Invalid payer expense',
                category: 'Food',
                date: '2024-01-01T00:00:00.000Z',
                splitType: SplitTypes.EQUAL,
                participants: [alice.uid],
                splits: []
            };

            await expect(expenseService.createExpense(alice.uid, expenseData)).rejects.toEqual(
                new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group')
            );
        });

        it('should reject expense with non-group member as participant', async () => {
            const expenseData = {
                groupId,
                paidBy: alice.uid,
                amount: 50,
                currency: 'USD',
                description: 'Invalid participant expense',
                category: 'Food',
                date: '2024-01-01T00:00:00.000Z',
                splitType: SplitTypes.EQUAL,
                participants: [alice.uid, outsider.uid], // Non-member as participant
                splits: []
            };

            await expect(expenseService.createExpense(alice.uid, expenseData)).rejects.toEqual(
                new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PARTICIPANT', `Participant ${outsider.uid} is not a member of the group`)
            );
        });
    });

    describe('updateExpense', () => {
        let expenseId: string;

        beforeEach(async () => {
            // Create expense to update
            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(alice.uid)
                    .withParticipants([alice.uid, bob.uid])
                    .withAmount(100)
                    .withDescription('Original expense')
                    .withSplitType('equal')
                    .build(),
                alice.token
            );
            expenseId = expense.id;
        });

        it('should update expense amount and recalculate splits', async () => {
            const result = await expenseService.updateExpense(expenseId, alice.uid, {
                amount: 200
            });

            expect(result.amount).toBe(200);
            expect(result.splits).toHaveLength(2);
            result.splits.forEach((split: any) => {
                expect(split.amount).toBe(100); // 200 / 2
            });
        });

        it('should update expense description', async () => {
            const result = await expenseService.updateExpense(expenseId, alice.uid, {
                description: 'Updated description'
            });

            expect(result.description).toBe('Updated description');
        });

        it('should update participants and recalculate splits', async () => {
            const result = await expenseService.updateExpense(expenseId, alice.uid, {
                participants: [alice.uid, bob.uid, charlie.uid]
            });

            expect(result.participants).toEqual([alice.uid, bob.uid, charlie.uid]);
            expect(result.splits).toHaveLength(3);
            result.splits.forEach((split: any) => {
                expect(split.amount).toBeCloseTo(33.33, 2); // 100 / 3
            });
        });

        it('should deny update to non-participant', async () => {
            await expect(expenseService.updateExpense(expenseId, charlie.uid, {
                description: 'Unauthorized update'
            })).rejects.toEqual(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to edit this expense')
            );
        });

        it('should reject invalid payer update', async () => {
            await expect(expenseService.updateExpense(expenseId, alice.uid, {
                paidBy: outsider.uid
            })).rejects.toEqual(
                new ApiError(HTTP_STATUS.BAD_REQUEST, 'INVALID_PAYER', 'Payer must be a member of the group')
            );
        });
    });

    describe('deleteExpense', () => {
        let expenseId: string;

        beforeEach(async () => {
            // Create expense to delete
            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(groupId)
                    .withPaidBy(alice.uid)
                    .withParticipants([alice.uid, bob.uid])
                    .withAmount(100)
                    .withDescription('Expense to delete')
                    .withSplitType('equal')
                    .build(),
                alice.token
            );
            expenseId = expense.id;
        });

        it('should soft delete expense successfully', async () => {
            await expenseService.deleteExpense(expenseId, alice.uid);

            // Expense should not be found (soft deleted)
            await expect(expenseService.getExpense(expenseId, alice.uid)).rejects.toThrow('not found');
        });

        it('should deny deletion by non-participant', async () => {
            await expect(expenseService.deleteExpense(expenseId, charlie.uid)).rejects.toEqual(
                new ApiError(HTTP_STATUS.FORBIDDEN, 'NOT_AUTHORIZED', 'You do not have permission to delete this expense')
            );
        });

        it('should deny deletion of non-existent expense', async () => {
            await expect(expenseService.deleteExpense('nonexistent', alice.uid)).rejects.toThrow('not found');
        });

        it('should deny deletion of already deleted expense', async () => {
            // Delete first time
            await expenseService.deleteExpense(expenseId, alice.uid);

            // Try to delete again
            await expect(expenseService.deleteExpense(expenseId, alice.uid)).rejects.toThrow('not found');
        });
    });

    describe('permissions and security', () => {
        it('should enforce expense creation permissions based on group settings', async () => {
            // This would test different permission configurations
            // For now, we assume default permissions allow expense creation
            const expenseData = {
                groupId,
                paidBy: bob.uid,
                amount: 50,
                currency: 'USD',
                description: 'Permission test',
                category: 'Food',
                date: '2024-01-01T00:00:00.000Z',
                splitType: SplitTypes.EQUAL,
                participants: [bob.uid],
                splits: []
            };

            const result = await expenseService.createExpense(bob.uid, expenseData);
            expect(result).toBeDefined();
        });
    });
});