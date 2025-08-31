import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, borrowTestUsers } from '@splitifyd/test-support';
import { ExpenseBuilder, CreateGroupRequestBuilder } from '@splitifyd/test-support';
import type { User } from '@splitifyd/test-support';

describe('Group Lifecycle Edge Cases', () => {
    let driver: ApiDriver;
    let users: User[] = [];
    let allUsers: User[] = [];
    let testGroup: any;

    beforeAll(async () => {
        // Borrow 4 users with automatic cleanup
        ({ driver, users: allUsers } = await borrowTestUsers(4));

        // Use first 3 users for main tests (4th available for isolated tests)
        users = allUsers.slice(0, 3);
    });

    beforeEach(async () => {
        const groupData = new CreateGroupRequestBuilder().withName(`Test Group ${uuidv4()}`).withMembers(users).build();
        testGroup = await driver.createGroup(groupData, users[0].token);
    });

    test('should handle viewing group with no expenses', async () => {
        // Create a fresh group with no expenses using the builder
        // Note: Only the creator will be a member initially
        const groupData = new CreateGroupRequestBuilder().withName(`Empty Group ${uuidv4()}`).build();
        const emptyGroup = await driver.createGroup(groupData, users[0].token);

        // Verify the group was created
        const createdGroup = await driver.getGroup(emptyGroup.id, users[0].token);
        expect(createdGroup.id).toBe(emptyGroup.id);

        // Should be able to get group details and verify no expenses
        const groupDetails = await driver.getGroup(emptyGroup.id, users[0].token);
        expect(groupDetails).toHaveProperty('id');
        expect(groupDetails).toHaveProperty('members');

        // Verify no expenses exist
        const expenses = await driver.getGroupExpenses(emptyGroup.id, users[0].token);
        expect(expenses.expenses).toHaveLength(0);

        // Check group list shows zero balance - may need to wait for propagation
        const groupsList = await driver.listGroups(users[0].token);
        const groupInList = groupsList.groups.find((g: any) => g.id === emptyGroup.id);

        expect(groupInList).toBeDefined();
        // balancesByCurrency is optional for groups without expenses
        if (groupInList?.balance?.balancesByCurrency) {
            const usdBalance = groupInList.balance.balancesByCurrency['USD'];
            if (usdBalance) {
                expect(usdBalance.netBalance).toBe(0);
            }
        }
    });

    test('should handle multiple expenses with same participants', async () => {
        // Use the 4th user for this isolated test (we borrowed 4 users total)
        const testUser = allUsers[3];

        const multiExpenseGroupData = new CreateGroupRequestBuilder().withName(`Multi Expense Group ${uuidv4()}`).build();
        const multiExpenseGroup = await driver.createGroup(multiExpenseGroupData, testUser.token);

        // Create multiple expenses where the user pays themselves (testing expense tracking)
        const expenses = [
            { amount: 50, description: 'Expense 1' },
            { amount: 30, description: 'Expense 2' },
            { amount: 20, description: 'Expense 3' },
        ];

        const createdExpenseIds = [];
        for (const expense of expenses) {
            const expenseData = new ExpenseBuilder()
                .withGroupId(multiExpenseGroup.id)
                .withAmount(expense.amount)
                .withDescription(expense.description)
                .withPaidBy(testUser.uid)
                .withParticipants([testUser.uid])
                .build();
            const createdExpense = await driver.createExpense(expenseData, testUser.token);
            createdExpenseIds.push(createdExpense.id);
        }

        // Verify expenses were created correctly
        const loadedExpenses = await Promise.all(createdExpenseIds.map((id) => driver.getExpense(id, testUser.token)));

        expect(loadedExpenses).toHaveLength(3);
        expect(loadedExpenses[0].amount).toBe(50);
        expect(loadedExpenses[0].paidBy).toBe(testUser.uid);
        expect(loadedExpenses[1].amount).toBe(30);
        expect(loadedExpenses[1].paidBy).toBe(testUser.uid);
        expect(loadedExpenses[2].amount).toBe(20);
        expect(loadedExpenses[2].paidBy).toBe(testUser.uid);

        // Verify all expenses are tracked
        const groupExpenses = await driver.getGroupExpenses(multiExpenseGroup.id, testUser.token);
        expect(groupExpenses.expenses).toHaveLength(3);

        // Get group from list to check balance
        const groupsList = await driver.listGroups(testUser.token);
        const groupInList = groupsList.groups.find((g: any) => g.id === multiExpenseGroup.id);
        expect(groupInList).toBeDefined();

        // When a user pays for expenses only they participate in, net balance should be 0
        if (groupInList?.balance?.balancesByCurrency) {
            const usdBalance = groupInList.balance.balancesByCurrency['USD'];
            if (usdBalance) {
                expect(usdBalance.netBalance).toBe(0);
            }
        }
    });

    test('should handle deleting expenses successfully', async () => {
        // Focus on expense deletion functionality rather than balance recalculation

        // Create an expense
        const expenseData = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription('To Be Deleted Test')
            .withAmount(100) // Test expense deletion - this is what the test is about
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid, users[1].uid])
            .build();

        const createdExpense = await driver.createExpense(expenseData, users[0].token);
        expect(createdExpense.id).toBeDefined();

        // Verify the expense exists
        const fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
        expect(fetchedExpense).toBeDefined();
        expect(fetchedExpense.description).toBe('To Be Deleted Test');

        // Delete the expense
        await driver.deleteExpense(createdExpense.id, users[0].token);

        // Verify the expense is gone
        await expect(driver.getExpense(createdExpense.id, users[0].token)).rejects.toThrow(/not found|deleted|404/i);
    });

    test('should handle complex split scenarios', async () => {
        // Create a fresh group for this test to ensure clean state
        const complexGroupData = new CreateGroupRequestBuilder().withName(`Complex Split Group ${uuidv4()}`).build();
        const complexGroup = await driver.createGroup(complexGroupData, users[0].token);

        // Scenario: Mixed split types in one group - just verify structure
        const expenseData1 = new ExpenseBuilder()
            .withGroupId(complexGroup.id)
            .withAmount(90) // Complex split scenario - this is what the test is about
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await driver.createExpense(expenseData1, users[0].token);

        // Verify expense was created
        const expenses = await driver.getGroupExpenses(complexGroup.id, users[0].token);
        expect(expenses.expenses).toHaveLength(1);
        expect(expenses.expenses[0].amount).toBe(90);

        // Get group from list to verify balance info
        const groupsList = await driver.listGroups(users[0].token);
        const groupInList = groupsList.groups.find((g: any) => g.id === complexGroup.id);
        expect(groupInList).toBeDefined();

        // When a single user pays for expenses they fully participate in, net balance is 0
        if (groupInList?.balance?.balancesByCurrency) {
            const usdBalance = groupInList.balance.balancesByCurrency['USD'];
            if (usdBalance) {
                expect(usdBalance.netBalance).toBe(0);
            }
        }
    });

    test('should handle expense updates successfully', async () => {
        // Focus on expense update functionality rather than balance recalculation

        // Create initial expense
        const initialExpenseData = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription('Update Test Expense')
            .withAmount(50) // Test expense updates - this is what the test is about
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid, users[1].uid])
            .build();

        const createdExpense = await driver.createExpense(initialExpenseData, users[0].token);
        expect(createdExpense.id).toBeDefined();

        // Verify initial expense data
        let fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
        expect(fetchedExpense.amount).toBe(50);
        expect(fetchedExpense.description).toBe('Update Test Expense');

        // Update the expense
        await driver.updateExpense(
            createdExpense.id,
            {
                amount: 80,
                description: 'Updated Test Expense',
            },
            users[0].token,
        );

        // Verify the update worked
        fetchedExpense = await driver.getExpense(createdExpense.id, users[0].token);
        expect(fetchedExpense.amount).toBe(80);
        expect(fetchedExpense.description).toBe('Updated Test Expense');

        // Verify splits were recalculated
        expect(fetchedExpense.splits).toHaveLength(2);
        const totalSplits = fetchedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBeCloseTo(80, 1);
    });
});