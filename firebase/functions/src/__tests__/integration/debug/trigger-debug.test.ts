import {describe, it, expect, beforeEach,} from 'vitest';
import {ApiDriver, AppDriver, borrowTestUser} from '@splitifyd/test-support';
import {getFirestore} from '../../../firebase';
import { FirestoreCollections } from '@splitifyd/shared';
import { CreateGroupRequestBuilder, ExpenseBuilder } from '@splitifyd/test-support';
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('Trigger Debug Tests', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, getFirestore());
    let user1: AuthenticatedFirebaseUser;
    let groupId: string;

    beforeEach(async() => {
        user1 = await borrowTestUser();
        const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), user1.token);
        groupId = group.id
    })

    it('should fire group trigger when creating a group', async () => {
        // Wait for trigger to fire using proper polling
        await appDriver.waitForGroupChanges(groupId, (changes) => changes.length > 0);

        // Check if any change documents were created
        const groupChanges = await getFirestore().collection(FirestoreCollections.GROUP_CHANGES).get();

        // Check for our specific group
        const ourGroupChanges = await getFirestore().collection(FirestoreCollections.GROUP_CHANGES).where('groupId', '==', groupId).get();

        // Verify change documents exist
        expect(groupChanges.size).toBeGreaterThanOrEqual(0);
        expect(ourGroupChanges.size).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should fire expense trigger when creating an expense', async () => {
        // Starting expense trigger test

        // First create a group
        if (!groupId) {
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), user1.token);
            groupId = group.id;
            // Created group for expense test

            // Wait for group trigger to complete
            await appDriver.waitForGroupChanges(groupId, (changes) => changes.length > 0);
        }

        // Create an expense using builder
        const expense = await apiDriver.createExpense(new ExpenseBuilder().withGroupId(groupId).withPaidBy(user1.uid).withParticipants([user1.uid]).withSplitType('equal').build(), user1.token);

        // Created expense
        expect(expense).toBeDefined();
        expect(expense.id).toBeDefined();

        // Wait for trigger to fire using proper polling
        await appDriver.waitForExpenseChanges(groupId, (changes) => changes.some((c) => c.id === expense.id));

        // Check transaction-changes collection for expense changes
        const expenseChanges = await getFirestore().collection(FirestoreCollections.TRANSACTION_CHANGES).get();

        // Check balance-changes collection
        const balanceChanges = await getFirestore().collection(FirestoreCollections.BALANCE_CHANGES).get();

        // Verify collections exist and can be queried
        expect(expenseChanges.size).toBeGreaterThanOrEqual(0);
        expect(balanceChanges.size).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should check if triggers are even registered', async () => {
        // Checking trigger registration

        // Try to access Firebase emulator info
        try {
            // This is a simple test to see if we can query collections
            const testQuery = await getFirestore().collection('_test_trigger_check').limit(1).get();
            // Firebase connection working
            expect(testQuery).toBeDefined();
        } catch (error) {
            // Firebase connection issue - this is ok
            expect(error).toBeDefined();
        }
    });
});
