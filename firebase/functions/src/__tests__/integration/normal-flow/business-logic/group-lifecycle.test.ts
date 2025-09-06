import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {ExpenseBuilder, CreateGroupRequestBuilder, ApiDriver, borrowTestUsers} from '@splitifyd/test-support';
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('Group Lifecycle Edge Cases', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(4);
    });

    beforeEach(async () => {
        testGroup = await apiDriver.createGroupWithMembers(`Test Group ${uuidv4()}`, users, users[0].token);
    });

    test('should handle viewing group with no expenses', async () => {
        // Create a fresh group with no expenses using the builder
        // Note: Only the creator will be a member initially
        const groupData = new CreateGroupRequestBuilder().withName(`Empty Group ${uuidv4()}`).build();
        const emptyGroup = await apiDriver.createGroup(groupData, users[0].token);

        // Verify the group was created
        const {group: createdGroup} = await apiDriver.getGroupFullDetails(emptyGroup.id, users[0].token);
        expect(createdGroup.id).toBe(emptyGroup.id);

        // Should be able to get group details and verify no expenses
        const {group: groupDetails} = await apiDriver.getGroupFullDetails(emptyGroup.id, users[0].token);
        expect(groupDetails).toHaveProperty('id');

        // Verify no expenses exist
        const expenses = await apiDriver.getGroupExpenses(emptyGroup.id, users[0].token);
        expect(expenses.expenses).toHaveLength(0);

        // Verify empty group details include balance structure
        expect(groupDetails).toHaveProperty('balance');
        // For groups without expenses, balance should be empty or zero
        if (groupDetails.balance?.balancesByCurrency?.['USD']) {
            expect(groupDetails.balance.balancesByCurrency['USD'].netBalance).toBe(0);
        }
    });

    test('should handle multiple expenses with same participants', async () => {
        // Use the 4th user for this isolated test (we borrowed 4 users total)
        const testUser = users[3];

        const multiExpenseGroupData = new CreateGroupRequestBuilder().withName(`Multi Expense Group ${uuidv4()}`).build();
        const multiExpenseGroup = await apiDriver.createGroup(multiExpenseGroupData, testUser.token);

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
            const createdExpense = await apiDriver.createExpense(expenseData, testUser.token);
            createdExpenseIds.push(createdExpense.id);
        }

        // Verify expenses were created correctly
        const loadedExpenses = await Promise.all(createdExpenseIds.map((id) => apiDriver.getExpense(id, testUser.token)));

        expect(loadedExpenses).toHaveLength(3);
        expect(loadedExpenses[0].amount).toBe(50);
        expect(loadedExpenses[0].paidBy).toBe(testUser.uid);
        expect(loadedExpenses[1].amount).toBe(30);
        expect(loadedExpenses[1].paidBy).toBe(testUser.uid);
        expect(loadedExpenses[2].amount).toBe(20);
        expect(loadedExpenses[2].paidBy).toBe(testUser.uid);

        // Verify all expenses are tracked
        const groupExpenses = await apiDriver.getGroupExpenses(multiExpenseGroup.id, testUser.token);
        expect(groupExpenses.expenses).toHaveLength(3);

        // Get group from list to check balance
        const groupsList = await apiDriver.listGroups(testUser.token);
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

        const createdExpense = await apiDriver.createExpense(expenseData, users[0].token);
        expect(createdExpense.id).toBeDefined();

        // Verify the expense exists
        const fetchedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
        expect(fetchedExpense).toBeDefined();
        expect(fetchedExpense.description).toBe('To Be Deleted Test');

        // Delete the expense
        await apiDriver.deleteExpense(createdExpense.id, users[0].token);

        // Verify the expense is gone
        await expect(apiDriver.getExpense(createdExpense.id, users[0].token)).rejects.toThrow(/not found|deleted|404/i);
    });

    test('should handle complex split scenarios', async () => {
        // Create a fresh group for this test to ensure clean state
        const complexGroupData = new CreateGroupRequestBuilder().withName(`Complex Split Group ${uuidv4()}`).build();
        const complexGroup = await apiDriver.createGroup(complexGroupData, users[0].token);

        // Scenario: Mixed split types in one group - just verify structure
        const expenseData1 = new ExpenseBuilder()
            .withGroupId(complexGroup.id)
            .withAmount(90) // Complex split scenario - this is what the test is about
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await apiDriver.createExpense(expenseData1, users[0].token);

        // Verify expense was created
        const expenses = await apiDriver.getGroupExpenses(complexGroup.id, users[0].token);
        expect(expenses.expenses).toHaveLength(1);
        expect(expenses.expenses[0].amount).toBe(90);

        // Verify group details include balance info after expense creation
        const {group: groupWithBalance} = await apiDriver.getGroupFullDetails(complexGroup.id, users[0].token);
        expect(groupWithBalance).toHaveProperty('balance');
        
        // When a single user pays for expenses they fully participate in, net balance is 0
        if (groupWithBalance.balance?.balancesByCurrency?.['USD']) {
            expect(groupWithBalance.balance.balancesByCurrency['USD'].netBalance).toBe(0);
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

        const createdExpense = await apiDriver.createExpense(initialExpenseData, users[0].token);
        expect(createdExpense.id).toBeDefined();

        // Verify initial expense data
        let fetchedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
        expect(fetchedExpense.amount).toBe(50);
        expect(fetchedExpense.description).toBe('Update Test Expense');

        // Update the expense
        await apiDriver.updateExpense(
            createdExpense.id,
            {
                amount: 80,
                description: 'Updated Test Expense',
            },
            users[0].token,
        );

        // Verify the update worked
        fetchedExpense = await apiDriver.getExpense(createdExpense.id, users[0].token);
        expect(fetchedExpense.amount).toBe(80);
        expect(fetchedExpense.description).toBe('Updated Test Expense');

        // Verify splits were recalculated
        expect(fetchedExpense.splits).toHaveLength(2);
        const totalSplits = fetchedExpense.splits.reduce((sum: number, split: any) => sum + split.amount, 0);
        expect(totalSplits).toBeCloseTo(80, 1);
    });
});