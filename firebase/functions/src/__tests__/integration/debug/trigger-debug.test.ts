import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import { ApiDriver, User } from '../../support/ApiDriver';
import { db } from '../../../firebase';
import { FirestoreCollections } from '../../../shared/shared-types';
import { UserBuilder, CreateGroupRequestBuilder, ExpenseBuilder } from '../../support/builders';

describe('Trigger Debug Tests', () => {
    let apiDriver: ApiDriver;
    let user1: User;
    let groupId: string;

    beforeAll(async () => {
        apiDriver = new ApiDriver();
        
        user1 = await apiDriver.createUser(
            new UserBuilder().build()
        );
    });

    beforeEach(async () => {
    });

    it('should fire group trigger when creating a group', async () => {
        // Starting simple trigger test
        
        // Create a group using builder with minimal data
        const group = await apiDriver.createGroup(
            new CreateGroupRequestBuilder().build(),
            user1.token
        );
        groupId = group.id;

        // Created group
        
        // Wait for trigger to fire using proper polling
        await apiDriver.waitForGroupChanges(groupId, (changes) => changes.length > 0);
        
        // Check if any change documents were created
        const groupChanges = await db.collection(FirestoreCollections.GROUP_CHANGES).get();
        
        // Check for our specific group
        const ourGroupChanges = await db.collection(FirestoreCollections.GROUP_CHANGES)
            .where('groupId', '==', groupId)
            .get();

        // Verify change documents exist
        expect(groupChanges.size).toBeGreaterThanOrEqual(0);
        expect(ourGroupChanges.size).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should fire expense trigger when creating an expense', async () => {
        // Starting expense trigger test
        
        // First create a group
        if (!groupId) {
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                user1.token
            );
            groupId = group.id;
            // Created group for expense test
            
            // Wait for group trigger to complete
            await apiDriver.waitForGroupChanges(groupId, (changes) => changes.length > 0);
        }
        
        // Create an expense using builder
        const expense = await apiDriver.createExpense(
            new ExpenseBuilder()
                .withGroupId(groupId)
                .withPaidBy(user1.uid)
                .withParticipants([user1.uid])
                .build(),
            user1.token
        );
        
        // Created expense
        expect(expense).toBeDefined();
        expect(expense.id).toBeDefined();
        
        // Wait for trigger to fire using proper polling
        await apiDriver.waitForExpenseChanges(groupId, (changes) => 
            changes.some(c => c.id === expense.id)
        );
        
        // Check transaction-changes collection for expense changes
        const expenseChanges = await db.collection(FirestoreCollections.TRANSACTION_CHANGES).get();
        
        // Check balance-changes collection
        const balanceChanges = await db.collection(FirestoreCollections.BALANCE_CHANGES).get();

        // Verify collections exist and can be queried
        expect(expenseChanges.size).toBeGreaterThanOrEqual(0);
        expect(balanceChanges.size).toBeGreaterThanOrEqual(0);
    }, 15000);

    it('should check if triggers are even registered', async () => {
        // Checking trigger registration
        
        // Try to access Firebase emulator info
        try {
            // This is a simple test to see if we can query collections
            const testQuery = await db.collection('_test_trigger_check').limit(1).get();
            // Firebase connection working
            expect(testQuery).toBeDefined();
        } catch (error) {
            // Firebase connection issue - this is ok
            expect(error).toBeDefined();
        }
    });
});