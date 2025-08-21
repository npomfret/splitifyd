/**
 * Integration test to reproduce the complex unsettled group scenario
 * This test creates the exact same scenario as the failing E2E test to determine
 * if the balance calculation issue is in the backend or frontend
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ApiDriver, User } from '../../support/ApiDriver';
import { v4 as uuidv4 } from 'uuid';
import { UserBuilder } from '../../support/builders';
import { CreateGroupRequestBuilder } from '../../support/builders';
import { ExpenseBuilder } from '../../support/builders';
import { SettlementBuilder } from '../../support/builders';

describe('Complex Unsettled Balance - API Integration Test', () => {
    let driver: ApiDriver;
    let alice: User;
    let bob: User;

    beforeEach(async () => {
        driver = new ApiDriver();

        // Create two users like in the E2E test
        alice = await driver.createUser(new UserBuilder().withEmail(`alice-${uuidv4()}@test.com`).build());
        bob = await driver.createUser(new UserBuilder().withEmail(`bob-${uuidv4()}@test.com`).build());
    });

    afterEach(async () => {
        // Clean up - Note: User deletion not available in test API
    });

    test('should show correct balances when multiple users create expenses with equal split', async () => {
        // Create group with Alice (same as E2E test)
        const groupData = new CreateGroupRequestBuilder().withName('Vacation Trip 2024').withDescription('Beach house rental and activities').build();
        const group = await driver.createGroup(groupData, alice.token);

        // Add Bob to the group
        const shareLink = await driver.generateShareLink(group.id, alice.token);
        await driver.joinGroupViaShareLink(shareLink.linkId, bob.token);

        // Verify both members are in the group
        const groupAfterJoin = await driver.getGroup(group.id, alice.token);
        expect(Object.keys(groupAfterJoin.members)).toHaveLength(2);
        expect(groupAfterJoin.members).toHaveProperty(alice.uid);
        expect(groupAfterJoin.members).toHaveProperty(bob.uid);

        const currency = "USD";

        // Alice adds beach house expense ($800) - paid by Alice, split equally among all
        const expense1Data = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Beach House Rental')
            .withAmount(80000) // $800.00 in cents
            .withCurrency(currency)
            .withPaidBy(alice.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid]) // Both participants
            .build();

        await driver.createExpense(expense1Data, alice.token);

        // Bob adds restaurant expense ($120) - paid by Bob, split equally among all
        const expense2Data = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Restaurant Dinner')
            .withAmount(12000) // $120.00 in cents
            .withCurrency(currency)
            .withPaidBy(bob.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid]) // Both participants
            .build();

        await driver.createExpense(expense2Data, bob.token);

        // Get the group balance
        const balances = await driver.getGroupBalances(group.id, alice.token);

        // Verify the balance calculation
        // Alice paid $800, Bob paid $120, total = $920
        // Each person's share = $920 / 2 = $460
        // Alice should be owed: $800 - $460 = $340
        // Bob should owe: $460 - $120 = $340

        expect(balances.simplifiedDebts).toBeDefined();
        expect(balances.simplifiedDebts.length).toBeGreaterThan(0);

        // The simplified debts should show Bob owes Alice $340
        const debt = balances.simplifiedDebts.find((d: any) => d.from.userId === bob.uid && d.to.userId === alice.uid);
        expect(debt).toBeDefined();
        expect(debt?.amount).toBe(34000); // $340.00 in cents

        // Check individual balances
        expect(balances.userBalances[alice.uid]).toBeDefined();
        expect(balances.userBalances[alice.uid].netBalance).toBe(34000); // Alice is owed $340

        expect(balances.userBalances[bob.uid]).toBeDefined();
        expect(balances.userBalances[bob.uid].netBalance).toBe(-34000); // Bob owes $340

        // Also check via the group endpoint to see what the frontend receives
        const groupWithBalance = await driver.getGroup(group.id, alice.token);

        // The group balance should show that there are unsettled amounts
        expect(groupWithBalance.balance).toBeDefined();
        expect(groupWithBalance.balance!.balancesByCurrency).toBeDefined();
        expect(groupWithBalance.balance!.balancesByCurrency[currency].netBalance).toBe(34000); // Alice is owed $340
        expect(groupWithBalance.balance!.balancesByCurrency[currency].totalOwed).toBe(34000); // Total Alice is owed
        expect(groupWithBalance.balance!.balancesByCurrency[currency].totalOwing).toBe(0); // Alice owes nothing
    });

    test('should replicate settlement balance bug from failing E2E test', async () => {
        // This test replicates the exact scenario from the failing E2E test:
        // - Create $150 expense split between 2 users
        // - Expected: User2 owes User1 $75 (half of $150)
        // - Actual bug: User2 owes User1 $150 (full amount)
        // - Settlement of actual debt amount should result in "all settled up"

        // Create group with Alice
        const groupData = new CreateGroupRequestBuilder().withName('Settlement Bug Test Group').withDescription('Testing exact settlement balance scenario').build();
        const group = await driver.createGroup(groupData, alice.token);

        // Add Bob to the group
        const shareLink = await driver.generateShareLink(group.id, alice.token);
        await driver.joinGroupViaShareLink(shareLink.linkId, bob.token);

        // Alice pays $150 expense split equally between Alice and Bob
        const expenseData = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('One Person Pays')
            .withAmount(150) // $150.00 in dollars (not cents!)
            .withPaidBy(alice.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid])
            .build();

        const expense = await driver.createExpense(expenseData, alice.token);

        // Check the stored expense splits
        const storedExpense = await driver.getExpense(expense.id, alice.token);

        // Expected: Each person should owe $75 (in dollars)
        expect(storedExpense.splits).toHaveLength(2);
        const aliceSplit = storedExpense.splits.find((s: any) => s.userId === alice.uid);
        const bobSplit = storedExpense.splits.find((s: any) => s.userId === bob.uid);

        // This should pass - splits should be $75 each
        expect(aliceSplit?.amount).toBe(75); // $75.00 in dollars
        expect(bobSplit?.amount).toBe(75); // $75.00 in dollars

        // Get the balance calculation
        const initialBalances = await driver.getGroupBalances(group.id, alice.token);

        // Expected balance logic:
        // - Alice paid $150, owes $75 (her share) = net +$75
        // - Bob paid $0, owes $75 (his share) = net -$75
        // So Bob should owe Alice exactly $75

        const bobBalance = initialBalances.userBalances[bob.uid];
        const aliceBalance = initialBalances.userBalances[alice.uid];

        // This is the CRITICAL TEST - if this fails, we've found the balance calculation bug
        expect(aliceBalance?.netBalance).toBe(75); // Alice should be owed $75
        expect(bobBalance?.netBalance).toBe(-75); // Bob should owe $75

        // Check simplified debts
        expect(initialBalances.simplifiedDebts).toHaveLength(1);
        const debt = initialBalances.simplifiedDebts[0];

        expect(debt.from.userId).toBe(bob.uid);
        expect(debt.to.userId).toBe(alice.uid);
        expect(debt.amount).toBe(75); // Should be $75

        // Now settle the ACTUAL debt amount (whatever the backend calculated)
        const actualDebtAmount = debt.amount; // This should be 75 dollars

        const settlementData = new SettlementBuilder()
            .withGroupId(group.id)
            .withPayer(bob.uid)
            .withPayee(alice.uid)
            .withAmount(actualDebtAmount) // Already in dollars
            .withNote('Full settlement payment - E2E bug replication')
            .build();

        const settlement = await driver.createSettlement(settlementData, bob.token);

        // Verify settlement was stored correctly
        const storedSettlement = await driver.getSettlement(settlement.id, bob.token);

        expect(storedSettlement.amount).toBe(actualDebtAmount);
        expect(storedSettlement.payer.uid).toBe(bob.uid);
        expect(storedSettlement.payee.uid).toBe(alice.uid);

        // Check final balances after settlement
        const finalBalances = await driver.getGroupBalances(group.id, alice.token);

        const finalAliceBalance = finalBalances.userBalances[alice.uid];
        const finalBobBalance = finalBalances.userBalances[bob.uid];

        // After settling the exact debt amount, both should be at $0 net balance
        expect(finalAliceBalance?.netBalance).toBe(0);
        expect(finalBobBalance?.netBalance).toBe(0);

        // Simplified debts should be empty (all settled up)
        expect(finalBalances.simplifiedDebts).toHaveLength(0);

        // This is what the UI uses to show "All settled up!"
        const groupWithFinalBalance = await driver.getGroup(group.id, alice.token);
        expect(Object.keys(groupWithFinalBalance.balance!.balancesByCurrency).length).toBe(0);
    });

    test('should handle the specific case where expense splits might be calculated incorrectly', async () => {
        // This test isolates the expense splitting logic to see if that's where the bug occurs

        const groupData = new CreateGroupRequestBuilder().withName('Split Calculation Test').build();
        const group = await driver.createGroup(groupData, alice.token);

        const shareLink = await driver.generateShareLink(group.id, alice.token);
        await driver.joinGroupViaShareLink(shareLink.linkId, bob.token);

        // Create the exact same expense as the E2E test
        const expenseData = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Test Expense - Equal Split')
            .withAmount(150) // $150.00 in dollars - same as E2E test
            .withPaidBy(alice.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid])
            .build();

        const expense = await driver.createExpense(expenseData, alice.token);

        // Verify the expense was stored with correct splits
        const storedExpense = await driver.getExpense(expense.id, alice.token);

        // Verify splits are exactly half of total
        expect(storedExpense.splits).toHaveLength(2);
        expect(storedExpense.splits.find((s: any) => s.userId === alice.uid)?.amount).toBe(75);
        expect(storedExpense.splits.find((s: any) => s.userId === bob.uid)?.amount).toBe(75);

        // Now check what the balance calculator produces
        const balances = await driver.getGroupBalances(group.id, alice.token);

        // The balance calculation should show:
        // - Alice paid $150, owes $75 (her share), net: +$75
        // - Bob paid $0, owes $75 (his share), net: -$75
        // So Bob owes Alice $75

        const bobOwes = balances.userBalances[bob.uid]?.netBalance;
        const aliceOwed = balances.userBalances[alice.uid]?.netBalance;

        // This is the core assertion - if this fails, we've found the bug
        expect(bobOwes).toBe(-75); // Bob owes $75
        expect(aliceOwed).toBe(75); // Alice is owed $75

        // Check simplified debts
        expect(balances.simplifiedDebts).toHaveLength(1);
        expect(balances.simplifiedDebts[0].amount).toBe(75); // $75 debt
    });
});
