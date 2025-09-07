import {beforeEach, describe, expect, it} from 'vitest';
import {CreateGroupRequestBuilder, ExpenseBuilder, AppDriver, ApiDriver, borrowTestUsers, generateShortId} from '@splitifyd/test-support';
import {getFirestore} from "../../../firebase";
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('Multi-User Expense Visibility Bug Reproduction', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, getFirestore());

    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(2);
    });

    it('should reproduce E2E bug: sequential expense creation by different users', async () => {
        const testId = generateShortId();
        console.log(`🧪 Test ID: ${testId}`);
        
        // Alice creates group
        const group = await apiDriver.createGroupWithMembers(
            `Multi-user Bug Test ${testId}`, 
            [users[0], users[1]], 
            users[0].token
        );
        
        const [alice, bob] = users;
        console.log(`👥 Alice: ${alice.uid}, Bob: ${bob.uid}`);
        console.log(`🏠 Group ID: ${group.id}`);

        // Wait for both users to receive group notifications
        await appDriver.waitForUserNotificationUpdate(alice.uid, group.id, 'group');
        await appDriver.waitForUserNotificationUpdate(bob.uid, group.id, 'group');

        // Alice creates the first expense (Beach House Rental - $800)
        console.log(`🏖️  Alice creating Beach House Rental expense...`);
        const aliceExpense = await apiDriver.createExpense(
            new ExpenseBuilder()
                .withGroupId(group.id)
                .withDescription('Beach House Rental')
                .withAmount(800)
                .withCurrency('USD')
                .withPaidBy(alice.uid)
                .withSplitType('equal')
                .withParticipants([alice.uid, bob.uid])
                .withSplits([
                    { userId: alice.uid, amount: 400 },
                    { userId: bob.uid, amount: 400 }
                ])
                .build(),
            alice.token
        );

        // Wait for Alice's expense notifications to propagate to both users
        await appDriver.waitForUserNotificationUpdate(alice.uid, group.id, 'transaction');
        await appDriver.waitForUserNotificationUpdate(alice.uid, group.id, 'balance');
        await appDriver.waitForUserNotificationUpdate(bob.uid, group.id, 'transaction');
        await appDriver.waitForUserNotificationUpdate(bob.uid, group.id, 'balance');

        // Verify both users can see Alice's expense
        const aliceExpenseFromAlice = await apiDriver.getExpense(aliceExpense.id, alice.token);
        const aliceExpenseFromBob = await apiDriver.getExpense(aliceExpense.id, bob.token);
        
        expect(aliceExpenseFromAlice.description).toBe('Beach House Rental');
        expect(aliceExpenseFromBob.description).toBe('Beach House Rental');
        console.log(`✅ Both users can see Alice's expense`);

        // Bob creates the second expense (Restaurant Dinner - $120)
        console.log(`🍽️  Bob creating Restaurant Dinner expense...`);
        const bobExpense = await apiDriver.createExpense(
            new ExpenseBuilder()
                .withGroupId(group.id)
                .withDescription('Restaurant Dinner')
                .withAmount(120)
                .withCurrency('USD')
                .withPaidBy(bob.uid)
                .withSplitType('equal')
                .withParticipants([alice.uid, bob.uid])
                .withSplits([
                    { userId: alice.uid, amount: 60 },
                    { userId: bob.uid, amount: 60 }
                ])
                .build(),
            bob.token
        );

        // Wait for Bob's expense notifications to propagate to both users
        await appDriver.waitForUserNotificationUpdate(alice.uid, group.id, 'transaction');
        await appDriver.waitForUserNotificationUpdate(alice.uid, group.id, 'balance');
        await appDriver.waitForUserNotificationUpdate(bob.uid, group.id, 'transaction');
        await appDriver.waitForUserNotificationUpdate(bob.uid, group.id, 'balance');

        // THE KEY TEST: Can both users see Bob's expense?
        console.log(`🔍 Testing if both users can see Bob's expense...`);
        
        // Bob should be able to see his own expense
        const bobExpenseFromBob = await apiDriver.getExpense(bobExpense.id, bob.token);
        expect(bobExpenseFromBob.description).toBe('Restaurant Dinner');
        console.log(`✅ Bob can see his own expense`);

        // Alice should also be able to see Bob's expense (THIS MIGHT FAIL)
        try {
            const bobExpenseFromAlice = await apiDriver.getExpense(bobExpense.id, alice.token);
            expect(bobExpenseFromAlice.description).toBe('Restaurant Dinner');
            console.log(`✅ Alice can see Bob's expense`);
        } catch (error) {
            console.log(`❌ REPRODUCED BUG: Alice cannot see Bob's expense!`);
            console.log(`Error:`, error);
            throw new Error(`REPRODUCED BUG: Alice cannot access Bob's expense. This confirms the E2E test failure.`);
        }

        // Additional verification: Check if both expenses are returned in group expense list
        console.log(`📋 Testing group expense list visibility...`);
        
        const aliceGroupExpenses = await apiDriver.getGroupExpenses(group.id, alice.token);
        const bobGroupExpenses = await apiDriver.getGroupExpenses(group.id, bob.token);

        console.log(`Alice sees ${aliceGroupExpenses.expenses.length} expenses`);
        console.log(`Bob sees ${bobGroupExpenses.expenses.length} expenses`);

        const aliceSeesBeachHouse = aliceGroupExpenses.expenses.some(e => e.description === 'Beach House Rental');
        const aliceSeesRestaurant = aliceGroupExpenses.expenses.some(e => e.description === 'Restaurant Dinner');
        const bobSeesBeachHouse = bobGroupExpenses.expenses.some(e => e.description === 'Beach House Rental');
        const bobSeesRestaurant = bobGroupExpenses.expenses.some(e => e.description === 'Restaurant Dinner');

        console.log(`Alice sees Beach House: ${aliceSeesBeachHouse}, Restaurant: ${aliceSeesRestaurant}`);
        console.log(`Bob sees Beach House: ${bobSeesBeachHouse}, Restaurant: ${bobSeesRestaurant}`);

        // Both users should see both expenses
        expect(aliceSeesBeachHouse).toBe(true);
        expect(aliceSeesRestaurant).toBe(true);
        expect(bobSeesBeachHouse).toBe(true);
        expect(bobSeesRestaurant).toBe(true);

        // Final verification: Check notification counts
        const aliceNotifications = await appDriver.getUserNotificationDocument(alice.uid);
        const bobNotifications = await appDriver.getUserNotificationDocument(bob.uid);

        console.log(`Alice notification counts:`, {
            group: aliceNotifications!.groups[group.id].groupDetailsChangeCount,
            transaction: aliceNotifications!.groups[group.id].transactionChangeCount,
            balance: aliceNotifications!.groups[group.id].balanceChangeCount
        });

        console.log(`Bob notification counts:`, {
            group: bobNotifications!.groups[group.id].groupDetailsChangeCount,
            transaction: bobNotifications!.groups[group.id].transactionChangeCount,
            balance: bobNotifications!.groups[group.id].balanceChangeCount
        });

        // Both users should have received transaction and balance notifications
        expect(aliceNotifications!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
        expect(aliceNotifications!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);
        expect(bobNotifications!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
        expect(bobNotifications!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);

        console.log(`✅ Test completed successfully - no bug reproduced`);
    });

    it('should verify expense permissions are correctly set for both users', async () => {
        const testId = generateShortId();
        
        // Create group with both users
        const group = await apiDriver.createGroupWithMembers(
            `Permission Test ${testId}`, 
            [users[0], users[1]], 
            users[0].token
        );
        
        const [alice, bob] = users;

        // Wait for group setup
        await appDriver.waitForUserNotificationUpdate(alice.uid, group.id, 'group');
        await appDriver.waitForUserNotificationUpdate(bob.uid, group.id, 'group');

        // Bob creates an expense
        const expense = await apiDriver.createExpense(
            new ExpenseBuilder()
                .withGroupId(group.id)
                .withDescription('Test Expense for Permissions')
                .withAmount(100)
                .withCurrency('USD')
                .withPaidBy(bob.uid)
                .withSplitType('equal')
                .withParticipants([alice.uid, bob.uid])
                .build(),
            bob.token
        );

        // Wait for notifications
        await appDriver.waitForUserNotificationUpdate(alice.uid, group.id, 'transaction');
        await appDriver.waitForUserNotificationUpdate(bob.uid, group.id, 'transaction');

        // Check raw Firestore permissions by trying to read the expense document directly
        console.log(`🔐 Testing direct Firestore access permissions...`);
        
        // Both users should be able to access the expense via API
        const expenseAsAlice = await apiDriver.getExpense(expense.id, alice.token);
        const expenseAsBob = await apiDriver.getExpense(expense.id, bob.token);

        expect(expenseAsAlice.id).toBe(expense.id);
        expect(expenseAsBob.id).toBe(expense.id);

        console.log(`✅ Both users can access the expense via API`);

        // Check if the issue is in the API layer vs Firestore layer
        console.log(`📊 Testing group expense listing...`);
        
        const aliceExpenseList = await apiDriver.getGroupExpenses(group.id, alice.token);
        const bobExpenseList = await apiDriver.getGroupExpenses(group.id, bob.token);

        console.log(`Alice sees ${aliceExpenseList.expenses.length} expenses`);
        console.log(`Bob sees ${bobExpenseList.expenses.length} expenses`);

        const aliceSeesExpense = aliceExpenseList.expenses.some(e => e.id === expense.id);
        const bobSeesExpense = bobExpenseList.expenses.some(e => e.id === expense.id);

        console.log(`Alice sees the expense in list: ${aliceSeesExpense}`);
        console.log(`Bob sees the expense in list: ${bobSeesExpense}`);

        expect(aliceSeesExpense).toBe(true);
        expect(bobSeesExpense).toBe(true);
    });
});