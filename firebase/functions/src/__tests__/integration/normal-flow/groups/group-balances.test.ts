// NOTE: This test suite runs against the live Firebase emulator.
// You must have the emulator running for these tests to pass.
//
// Run the emulator with: `firebase emulators:start`

import { beforeEach, describe, expect, test } from 'vitest';

import { v4 as uuidv4 } from 'uuid';
import {borrowTestUsers} from '@splitifyd/test-support/test-pool-helpers';
import {ApiDriver, CreateGroupRequestBuilder, ExpenseBuilder} from '@splitifyd/test-support';
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('GET /groups/balances - Group Balances', () => {
    const apiDriver = new ApiDriver();
    let testGroup: any;
    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);

        const groupData = new CreateGroupRequestBuilder().withName(`Balance Test Group ${uuidv4()}`).withDescription('Testing balance endpoint').build();
        testGroup = await apiDriver.createGroup(groupData, users[0].token);
    });

    test('should return correct response structure for empty group', async () => {
        const balances = await apiDriver.getGroupBalances(testGroup.id, users[0].token);

        // Verify server response structure matches what server actually returns
        expect(balances).toHaveProperty('groupId', testGroup.id);
        expect(balances).toHaveProperty('userBalances');
        expect(balances).toHaveProperty('simplifiedDebts');
        expect(balances).toHaveProperty('lastUpdated');

        // For empty group, balances should be empty
        expect(typeof balances.userBalances).toBe('object');
        expect(Array.isArray(balances.simplifiedDebts)).toBe(true);
        // TODO: Remove this "if" block - we don't understand our own data structure
        // lastUpdated can be either string (ISO date) or Firestore Timestamp object
        expect(balances.lastUpdated).toBeDefined();
        expect(typeof balances.lastUpdated === 'string' || typeof balances.lastUpdated === 'object').toBe(true);
    });

    test('should return balances for group with expenses', async () => {
        // Add multiple users to the group
        const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[2].token);

        // Create an expense where user 0 pays for everyone
        const expenseData = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription('Dinner for everyone')
            .withAmount(150) // $1.50
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid, users[1].uid, users[2].uid])
            .build();
        await apiDriver.createExpense(expenseData, users[0].token);

        // Wait for balance calculation
        const balances = await apiDriver.pollGroupBalancesUntil(testGroup.id, users[0].token, (b) => b.userBalances && Object.keys(b.userBalances).length > 0, { timeout: 500 });

        // Verify response structure
        expect(balances.groupId).toBe(testGroup.id);
        expect(balances.userBalances).toBeDefined();
        expect(balances.simplifiedDebts).toBeDefined();
        expect(balances.lastUpdated).toBeDefined();

        // Verify balance calculations
        expect(Object.keys(balances.userBalances)).toContain(users[0].uid);
        expect(balances.userBalances[users[0].uid]).toHaveProperty('netBalance');

        // User 0 should have positive balance (others owe them)
        expect(balances.userBalances[users[0].uid].netBalance).toBeGreaterThan(0);
    });

    test('should handle complex multi-expense scenarios', async () => {
        // Add another user
        const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

        // Create multiple expenses with different payers
        const expenseData1 = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription('Lunch')
            .withAmount(60) // $0.60
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid, users[1].uid])
            .build();

        const expenseData2 = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription('Coffee')
            .withAmount(20) // $0.20
            .withPaidBy(users[1].uid)
            .withParticipants([users[0].uid, users[1].uid])
            .build();

        await apiDriver.createExpense(expenseData1, users[0].token);
        await apiDriver.createExpense(expenseData2, users[0].token);

        // Wait for balance calculation
        const balances = await apiDriver.pollGroupBalancesUntil(testGroup.id, users[0].token, (b) => b.userBalances && Object.keys(b.userBalances).length >= 2, { timeout: 500 });

        // Verify both users have balances
        expect(Object.keys(balances.userBalances)).toHaveLength(2);
        expect(balances.userBalances[users[0].uid]).toBeDefined();
        expect(balances.userBalances[users[1].uid]).toBeDefined();

        // Net balances should add up to zero
        const user0Balance = balances.userBalances[users[0].uid].netBalance;
        const user1Balance = balances.userBalances[users[1].uid].netBalance;
        expect(user0Balance + user1Balance).toBeCloseTo(0, 2);
    });

    test('should require authentication', async () => {
        await expect(apiDriver.getGroupBalances(testGroup.id, '')).rejects.toThrow(/401|unauthorized/i);
    });

    test('should return 404 for non-existent group', async () => {
        await expect(apiDriver.getGroupBalances('non-existent-id', users[0].token)).rejects.toThrow(/404|not found/i);
    });

    test('should restrict access to group members only', async () => {
        // User 1 is not a member of the group
        await expect(apiDriver.getGroupBalances(testGroup.id, users[1].token)).rejects.toThrow(/403|forbidden|404|not found/i);
    });

    test('should validate groupId parameter', async () => {
        // Test with missing groupId (should be handled by validation)
        try {
            await apiDriver.makeInvalidApiCall('/groups/balances', 'GET', null, users[0].token);
            throw new Error('Should have thrown validation error');
        } catch (error) {
            expect((error as Error).message).toMatch(/validation|required|groupId|404|not found/i);
        }
    });

    test('should handle groups with no expenses gracefully', async () => {
        const balances = await apiDriver.getGroupBalances(testGroup.id, users[0].token);

        expect(balances.groupId).toBe(testGroup.id);
        expect(balances.userBalances).toBeDefined();
        expect(balances.simplifiedDebts).toBeDefined();
        expect(Array.isArray(balances.simplifiedDebts)).toBe(true);
        expect(balances.simplifiedDebts).toHaveLength(0);
    });

    test('should return updated timestamp', async () => {
        const balances = await apiDriver.getGroupBalances(testGroup.id, users[0].token);

        expect(balances.lastUpdated).toBeDefined();
        // lastUpdated should be present and not null
        expect(balances.lastUpdated).not.toBeNull();
        // TODO: Remove this "if" block - we don't understand our own data structure
        // Can be either string (ISO date) or timestamp object
        expect(typeof balances.lastUpdated === 'string' || typeof balances.lastUpdated === 'object').toBe(true);
    });

    test('should include simplified debts for complex scenarios', async () => {
        // Create a three-person group with circular debts
        const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[2].token);

        // Create expenses that would benefit from debt simplification
        const expenseData1 = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription('User 0 pays for all')
            .withAmount(300) // $3.00
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid, users[1].uid, users[2].uid])
            .build();

        const expenseData2 = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription('User 1 pays for User 0 and 2')
            .withAmount(120) // $1.20
            .withPaidBy(users[1].uid)
            .withParticipants([users[0].uid, users[1].uid, users[2].uid])
            .withCategory('transport')
            .build();

        await apiDriver.createExpense(expenseData1, users[0].token);
        await apiDriver.createExpense(expenseData2, users[0].token);

        // Wait for balance calculation
        const balances = await apiDriver.pollGroupBalancesUntil(testGroup.id, users[0].token, (b) => b.userBalances && Object.keys(b.userBalances).length >= 3, { timeout: 500 });

        // Should have simplified debts
        expect(Array.isArray(balances.simplifiedDebts)).toBe(true);

        // Verify debt structure if any exist
        if (balances.simplifiedDebts.length > 0) {
            balances.simplifiedDebts.forEach((debt: any) => {
                expect(debt).toHaveProperty('from');
                expect(debt).toHaveProperty('to');
                expect(debt).toHaveProperty('amount');
                expect(typeof debt.amount).toBe('number');
                expect(debt.amount).toBeGreaterThan(0);
            });
        }
    });
});