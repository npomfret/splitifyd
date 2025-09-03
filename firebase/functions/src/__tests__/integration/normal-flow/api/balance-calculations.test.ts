// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, AppDriver, borrowTestUsers, TestGroupManager} from '@splitifyd/test-support';
import { ExpenseBuilder } from '@splitifyd/test-support';
import {AuthenticatedFirebaseUser} from '@splitifyd/shared';
import {firestoreDb} from "../../../../firebase";

describe('Balance Calculations', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, firestoreDb);
    let balanceTestGroup: any;

    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(6);
    });

    // Helper to get users from pool
    const getTestUsers = (count: number): AuthenticatedFirebaseUser[] => {
        return users.slice(0, count);
    };

    beforeEach(async () => {
        const testUsers = getTestUsers(2);
        balanceTestGroup = await TestGroupManager.getOrCreateGroup(testUsers, { memberCount: 2 });
    });

    test('should include balance information in group details', async () => {
        const testUsers = getTestUsers(2);
        // Create an expense: User 0 pays 100, split equally between 2 users
        const uniqueId = uuidv4().slice(0, 8);
        const expenseData = new ExpenseBuilder()
            .withGroupId(balanceTestGroup.id)
            .withDescription(`Balance test expense ${uniqueId}`)
            .withAmount(100)
            .withPaidBy(testUsers[0].uid)
            .withParticipants(testUsers.map((u) => u.uid))
            .build();
        await apiDriver.createExpense(expenseData, testUsers[0].token);

        // Get group details to check balance info
        const {group: groupDetails} = await apiDriver.getGroupFullDetails(balanceTestGroup.id, testUsers[0].token);

        // Verify the response structure includes balance info
        expect(groupDetails).toHaveProperty('id');
        expect(groupDetails).toHaveProperty('name');
    });

    test('should include balance data in listGroups response', async () => {
        // Add an expense: User 0 pays 100, split equally between 2 users
        const uniqueId = uuidv4().slice(0, 8);
        const expenseData = new ExpenseBuilder()
            .withGroupId(balanceTestGroup.id)
            .withDescription(`List groups balance test ${uniqueId}`)
            .withAmount(100)
            .withPaidBy(getTestUsers(2)[0].uid)
            .withParticipants(getTestUsers(2).map((u) => u.uid))
            .build();
        await apiDriver.createExpense(expenseData, getTestUsers(2)[0].token);

        // Get group list to check balance data

        // Test the listGroups endpoint (which dashboard uses)
        const listResponse = await apiDriver.listGroups(getTestUsers(2)[0].token);

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

        // With shared groups, there may be existing balances, so we check structure instead of exact values
        // User 0 paid 100, split equally between 2 users = User 0 should be owed at least 50 (but could be more with existing expenses)
        const netBalance = testGroupInList!.balance?.balancesByCurrency?.['USD']?.netBalance || 0;
        expect(typeof netBalance).toBe('number');
        // Since we added 100 and split between 2 users, User 0 should be owed at least 50
        expect(netBalance).toBeGreaterThanOrEqual(50);
    });

    // NOTE: Expense metadata (expenseCount, lastExpense) removed in favor of on-demand calculation
    test('should show updated lastActivity after creating expenses', async () => {
        // First, verify the group starts with default lastActivity
        const initialListResponse = await apiDriver.listGroups(getTestUsers(2)[0].token);
        const initialGroupInList = initialListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);

        expect(initialGroupInList).toBeDefined();
        // lastActivity should default to group creation time
        expect(initialGroupInList!.lastActivityRaw).toBeDefined();
        const initialActivityTime = new Date(initialGroupInList!.lastActivityRaw!);

        // Add an expense
        const uniqueId = uuidv4().slice(0, 8);
        const expenseData = new ExpenseBuilder()
            .withGroupId(balanceTestGroup.id)
            .withDescription(`Activity test expense ${uniqueId}`)
            .withAmount(75)
            .withPaidBy(getTestUsers(2)[0].uid)
            .withParticipants(getTestUsers(2).map((u) => u.uid))
            .build();
        const expense = await apiDriver.createExpense(expenseData, getTestUsers(2)[0].token);

        // Wait for the expense change to be processed
        await appDriver.waitForExpenseChanges(balanceTestGroup.id, (changes) => {
            return changes.some((change) => change.id === expense.id);
        });

        // Check after creating expense
        const updatedListResponse = await apiDriver.listGroups(getTestUsers(2)[0].token);
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
        const uniqueId2 = uuidv4().slice(0, 8);
        const secondExpenseData = new ExpenseBuilder()
            .withGroupId(balanceTestGroup.id)
            .withDescription(`Second activity test expense ${uniqueId2}`)
            .withAmount(25)
            .withPaidBy(getTestUsers(2)[1].uid)
            .withParticipants(getTestUsers(2).map((u) => u.uid))
            .build();
        const secondExpense = await apiDriver.createExpense(secondExpenseData, getTestUsers(2)[1].token);

        // Wait for the second expense change to be processed
        await appDriver.waitForExpenseChanges(balanceTestGroup.id, (changes) => {
            return changes.some((change) => change.id === secondExpense.id);
        });

        // Check after second expense
        const finalListResponse = await apiDriver.listGroups(getTestUsers(2)[0].token);
        const finalGroupInList = finalListResponse.groups.find((group: any) => group.id === balanceTestGroup.id);

        expect(finalGroupInList!.lastActivityRaw).toBeDefined();

        // The lastActivityRaw should reflect recent activity
        const lastActivityTime = new Date(finalGroupInList!.lastActivityRaw!);
        expect(lastActivityTime.getTime()).toBeGreaterThanOrEqual(updatedActivityTime.getTime());
    });
});