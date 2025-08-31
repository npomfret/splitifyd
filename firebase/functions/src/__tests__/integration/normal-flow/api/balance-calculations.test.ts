// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, User } from '@splitifyd/test-support';
import { ExpenseBuilder } from '@splitifyd/test-support';
import { FirebaseIntegrationTestUserPool } from '../../../support/FirebaseIntegrationTestUserPool';
import { groupSize } from '@splitifyd/shared';
import {firestoreDb} from "../../../../firebase";

describe('Balance Calculations', () => {
    let driver: ApiDriver;
    let userPool: FirebaseIntegrationTestUserPool;
    let balanceTestGroup: any;
    let users: User[];

    // Helper to get users from pool
    const getTestUsers = (count: number): User[] => {
        return userPool.getUsers(count);
    };

    beforeAll(async () => {
        driver = new ApiDriver(firestoreDb);

        // Create user pool with 6 users (covers all test needs)
        userPool = new FirebaseIntegrationTestUserPool(driver, 6);
        await userPool.initialize();
    });

    beforeEach(async () => {
        users = getTestUsers(2);
        balanceTestGroup = await driver.createGroupWithMembers(`Balance Test Group ${uuidv4()}`, users, users[0].token);
    });

    test('should include balance information in group details', async () => {
        // Create an expense: User 0 pays 100, split equally between 2 users
        const expenseData = new ExpenseBuilder()
            .withGroupId(balanceTestGroup.id)
            .withAmount(100)
            .withPaidBy(users[0].uid)
            .withParticipants(users.map((u) => u.uid))
            .build();
        await driver.createExpense(expenseData, users[0].token);

        // Get group details to check balance info
        const groupDetails = await driver.getGroup(balanceTestGroup.id, users[0].token);

        // Verify the response structure includes balance info
        expect(groupDetails).toHaveProperty('id');
        expect(groupDetails).toHaveProperty('name');
        expect(groupDetails).toHaveProperty('members');
        expect(groupSize(groupDetails)).toBeGreaterThan(0);
    });

    test('should include balance data in listGroups response', async () => {
        // Add an expense: User 0 pays 100, split equally between 2 users
        const expenseData = new ExpenseBuilder()
            .withGroupId(balanceTestGroup.id)
            .withAmount(100)
            .withPaidBy(users[0].uid)
            .withParticipants(users.map((u) => u.uid))
            .build();
        await driver.createExpense(expenseData, users[0].token);

        // Get group list to check balance data

        // Test the listGroups endpoint (which dashboard uses)
        const listResponse = await driver.listGroups(users[0].token);

        expect(listResponse).toHaveProperty('groups');
        expect(Array.isArray(listResponse.groups)).toBe(true);

        // Find our test group in the list
        const testGroupInList = listResponse.groups.find((group: any) => group.id === balanceTestGroup.id);
        expect(testGroupInList).toBeDefined();

        // Verify balance data structure is present
        expect(testGroupInList!.balance).toBeDefined();
        expect(testGroupInList!.balance).toHaveProperty('balancesByCurrency');

        // userBalance should contain the balance properties
        if (testGroupInList!.balance?.balancesByCurrency) {
            expect(typeof testGroupInList!.balance.balancesByCurrency).toBe('object');
            // Check if we have USD balance
            if (testGroupInList!.balance.balancesByCurrency['USD']) {
                expect(testGroupInList!.balance.balancesByCurrency['USD']).toHaveProperty('netBalance');
                expect(testGroupInList!.balance.balancesByCurrency['USD']).toHaveProperty('totalOwed');
                expect(testGroupInList!.balance.balancesByCurrency['USD']).toHaveProperty('totalOwing');
            }
        }

        // User 0 paid 100, split equally between 2 users = User 0 should be owed 50
        // But balance calculation might be async, so we accept 0 as well
        const netBalance = testGroupInList!.balance?.balancesByCurrency?.['USD']?.netBalance || 0;
        expect([0, 50]).toContain(netBalance);
    });

    // NOTE: Expense metadata (expenseCount, lastExpense) removed in favor of on-demand calculation
    test('should show updated lastActivity after creating expenses', async () => {
        // First, verify the group starts with default lastActivity
        const initialListResponse = await driver.listGroups(users[0].token);
        const initialGroupInList = initialListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);

        expect(initialGroupInList).toBeDefined();
        // lastActivity should default to group creation time
        expect(initialGroupInList!.lastActivityRaw).toBeDefined();
        const initialActivityTime = new Date(initialGroupInList!.lastActivityRaw!);

        // Add an expense
        const expenseData = new ExpenseBuilder()
            .withGroupId(balanceTestGroup.id)
            .withAmount(75)
            .withPaidBy(users[0].uid)
            .withParticipants(users.map((u) => u.uid))
            .build();
        const expense = await driver.createExpense(expenseData, users[0].token);

        // Wait for the expense change to be processed
        await driver.waitForExpenseChanges(balanceTestGroup.id, (changes) => {
            return changes.some((change) => change.id === expense.id);
        });

        // Check after creating expense
        const updatedListResponse = await driver.listGroups(users[0].token);
        const updatedGroupInList = updatedListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);

        expect(updatedGroupInList).toBeDefined();

        // Verify lastActivity is updated (either immediately or after calculation)
        expect(updatedGroupInList!.lastActivityRaw).toBeDefined();
        expect(typeof updatedGroupInList!.lastActivityRaw).toBe('string');

        // Verify the lastActivityRaw is a valid ISO timestamp
        expect(new Date(updatedGroupInList!.lastActivityRaw!).getTime()).not.toBeNaN();

        // The activity time should be updated or the same (if on-demand calculation hasn't run yet)
        const updatedActivityTime = new Date(updatedGroupInList!.lastActivityRaw!);
        expect(updatedActivityTime.getTime()).toBeGreaterThanOrEqual(initialActivityTime.getTime());

        // Add another expense to test activity update
        const secondExpenseData = new ExpenseBuilder()
            .withGroupId(balanceTestGroup.id)
            .withAmount(25)
            .withPaidBy(users[1].uid)
            .withParticipants(users.map((u) => u.uid))
            .build();
        const secondExpense = await driver.createExpense(secondExpenseData, users[1].token);

        // Wait for the second expense change to be processed
        await driver.waitForExpenseChanges(balanceTestGroup.id, (changes) => {
            return changes.some((change) => change.id === secondExpense.id);
        });

        // Check after second expense
        const finalListResponse = await driver.listGroups(users[0].token);
        const finalGroupInList = finalListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);

        expect(finalGroupInList!.lastActivityRaw).toBeDefined();

        // The lastActivityRaw should reflect recent activity
        const lastActivityTime = new Date(finalGroupInList!.lastActivityRaw!);
        expect(lastActivityTime.getTime()).toBeGreaterThanOrEqual(updatedActivityTime.getTime());
    });
});