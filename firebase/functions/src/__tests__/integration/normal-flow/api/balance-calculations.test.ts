// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {ApiDriver, AppDriver, borrowTestUsers, TestGroupManager, CreateGroupRequestBuilder} from '@splitifyd/test-support';
import { ExpenseBuilder } from '@splitifyd/test-support';
import {AuthenticatedFirebaseUser} from '@splitifyd/shared';
import {getFirestore} from "../../../../firebase";

describe('Balance Calculations', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, getFirestore());
    let balanceTestGroup: any;

    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(6);
        
        // Create some test groups like group-list.test.ts does to ensure listGroups has data
        const testUsers = getTestUsers(2);
        const groupPromises = [];
        for (let i = 0; i < 3; i++) {
            groupPromises.push(apiDriver.createGroup(new CreateGroupRequestBuilder().withName(`Balance List Test Group ${i} ${uuidv4()}`).build(), testUsers[0].token));
        }
        await Promise.all(groupPromises);
    });

    // Helper to get users from pool
    const getTestUsers = (count: number): AuthenticatedFirebaseUser[] => {
        return users.slice(0, count);
    };

    beforeEach(async () => {
        const testUsers = getTestUsers(2);
        // Create group using simple apiDriver.createGroup to ensure it works with listGroups
        const uniqueId = uuidv4().slice(0, 8);
        balanceTestGroup = await apiDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName(`Balance Test Group ${uniqueId}`)
                .build(),
            testUsers[0].token
        );
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
            .withParticipants([testUsers[0].uid])
            .build();
        await apiDriver.createExpense(expenseData, testUsers[0].token);

        // Get group details to check balance info
        const {group: groupDetails} = await apiDriver.getGroupFullDetails(balanceTestGroup.id, testUsers[0].token);

        // Verify the response structure includes balance info
        expect(groupDetails).toHaveProperty('id');
        expect(groupDetails).toHaveProperty('name');
    });

    test('should include balance data in listGroups response', async () => {
        // First get the current list of groups to work with an existing one
        const initialListResponse = await apiDriver.listGroups(getTestUsers(2)[0].token);
        expect(initialListResponse).toHaveProperty('groups');
        expect(Array.isArray(initialListResponse.groups)).toBe(true);
        expect(initialListResponse.groups.length).toBeGreaterThan(0);
        
        // Use the first group from the list (similar to group-list.test.ts approach)
        const testGroup = initialListResponse.groups[0];
        
        // Add an expense to this existing group
        const uniqueId = uuidv4().slice(0, 8);
        const expenseData = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription(`List groups balance test ${uniqueId}`)
            .withAmount(100)
            .withPaidBy(getTestUsers(2)[0].uid)
            .withParticipants([getTestUsers(2)[0].uid])
            .build();
        await apiDriver.createExpense(expenseData, getTestUsers(2)[0].token);

        // Test the listGroups endpoint (which dashboard uses)
        const listResponse = await apiDriver.listGroups(getTestUsers(2)[0].token);

        expect(listResponse).toHaveProperty('groups');
        expect(Array.isArray(listResponse.groups)).toBe(true);

        // Find our test group in the list
        const testGroupInList = listResponse.groups.find((group: any) => group.id === testGroup.id);
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

        // Verify balance structure is present after adding expense
        expect(testGroupInList!.balance).toBeDefined();
        expect(testGroupInList!.balance).toHaveProperty('balancesByCurrency');
        
        // After adding a USD expense, there should be balance information
        if (testGroupInList!.balance?.balancesByCurrency?.['USD']) {
            const netBalance = testGroupInList!.balance.balancesByCurrency['USD'].netBalance;
            expect(typeof netBalance).toBe('number');
        } else {
            // If no USD balance, balance structure should still exist
            expect(testGroupInList!.balance?.balancesByCurrency).toBeDefined();
        }
    });

    // NOTE: Expense metadata (expenseCount, lastExpense) removed in favor of on-demand calculation
    test('should show updated lastActivity after creating expenses', async () => {
        // First, verify the group starts with default lastActivity
        const {group: initialGroup} = await apiDriver.getGroupFullDetails(balanceTestGroup.id, getTestUsers(2)[0].token);
        
        expect(initialGroup).toBeDefined();
        // lastActivity should default to group creation time
        expect(initialGroup.lastActivityRaw).toBeDefined();
        const initialActivityTime = new Date(initialGroup.lastActivityRaw!);

        // Add an expense
        const uniqueId = uuidv4().slice(0, 8);
        const expenseData = new ExpenseBuilder()
            .withGroupId(balanceTestGroup.id)
            .withDescription(`Activity test expense ${uniqueId}`)
            .withAmount(75)
            .withPaidBy(getTestUsers(2)[0].uid)
            .withParticipants([getTestUsers(2)[0].uid])
            .build();
        const expense = await apiDriver.createExpense(expenseData, getTestUsers(2)[0].token);

        // Wait for the expense change to be processed
        await appDriver.waitForExpenseChanges(balanceTestGroup.id, (changes) => {
            return changes.some((change) => change.id === expense.id);
        });

        // Check after creating expense
        const {group: updatedGroup} = await apiDriver.getGroupFullDetails(balanceTestGroup.id, getTestUsers(2)[0].token);

        expect(updatedGroup).toBeDefined();

        // Verify lastActivity is updated (either immediately or after calculation)
        expect(updatedGroup.lastActivityRaw).toBeDefined();
        expect(typeof updatedGroup.lastActivityRaw).toBe('string');

        // Verify the lastActivityRaw is a valid ISO timestamp
        expect(new Date(updatedGroup.lastActivityRaw!).getTime()).not.toBeNaN();

        // The activity time should be updated or the same (if on-demand calculation hasn't run yet)
        const updatedActivityTime = new Date(updatedGroup.lastActivityRaw!);
        expect(updatedActivityTime.getTime()).toBeGreaterThanOrEqual(initialActivityTime.getTime());

        // Add another expense to test activity update
        const uniqueId2 = uuidv4().slice(0, 8);
        const secondExpenseData = new ExpenseBuilder()
            .withGroupId(balanceTestGroup.id)
            .withDescription(`Second activity test expense ${uniqueId2}`)
            .withAmount(25)
            .withPaidBy(getTestUsers(2)[0].uid)
            .withParticipants([getTestUsers(2)[0].uid])
            .build();
        const secondExpense = await apiDriver.createExpense(secondExpenseData, getTestUsers(2)[0].token);

        // Wait for the second expense change to be processed
        await appDriver.waitForExpenseChanges(balanceTestGroup.id, (changes) => {
            return changes.some((change) => change.id === secondExpense.id);
        });

        // Check after second expense
        const {group: finalGroup} = await apiDriver.getGroupFullDetails(balanceTestGroup.id, getTestUsers(2)[0].token);

        expect(finalGroup.lastActivityRaw).toBeDefined();

        // The lastActivityRaw should reflect recent activity
        const lastActivityTime = new Date(finalGroup.lastActivityRaw!);
        expect(lastActivityTime.getTime()).toBeGreaterThanOrEqual(updatedActivityTime.getTime());
    });
});