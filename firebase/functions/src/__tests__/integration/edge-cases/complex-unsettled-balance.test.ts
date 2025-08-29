import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { ApiDriver, User } from '@splitifyd/test-support';
import { v4 as uuidv4 } from 'uuid';
import { UserBuilder } from '@splitifyd/test-support';
import { CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { ExpenseBuilder } from '@splitifyd/test-support';
import { SettlementBuilder } from '@splitifyd/test-support';
import {firestoreDb} from "../../../firebase";

describe('Complex Unsettled Balance - API Integration Test', () => {
    let driver: ApiDriver;
    let alice: User;
    let bob: User;
    let charlie: User;

    beforeEach(async () => {
        driver = new ApiDriver(firestoreDb);

        // Create users for multi-currency and complex scenarios
        alice = await driver.createUser(new UserBuilder().withEmail(`alice-${uuidv4()}@test.com`).build());
        bob = await driver.createUser(new UserBuilder().withEmail(`bob-${uuidv4()}@test.com`).build());
        charlie = await driver.createUser(new UserBuilder().withEmail(`charlie-${uuidv4()}@test.com`).build());
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

        const currency = 'USD';

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

    test('should handle multi-currency expenses within the same group', async () => {
        // Test multi-currency scenario: expenses in USD, EUR, and GBP within same group
        const groupData = new CreateGroupRequestBuilder().withName('Multi-Currency Group').withDescription('Testing different currencies').build();
        const group = await driver.createGroup(groupData, alice.token);

        // Add Bob and Charlie to the group
        const shareLink = await driver.generateShareLink(group.id, alice.token);
        await driver.joinGroupViaShareLink(shareLink.linkId, bob.token);
        await driver.joinGroupViaShareLink(shareLink.linkId, charlie.token);

        // Alice pays $300 USD expense, split equally among all 3
        const usdExpense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Hotel - USD')
            .withAmount(300)
            .withCurrency('USD')
            .withPaidBy(alice.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid, charlie.uid])
            .build();
        await driver.createExpense(usdExpense, alice.token);

        // Bob pays €240 EUR expense, split equally among all 3
        const eurExpense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Dinner - EUR')
            .withAmount(240)
            .withCurrency('EUR')
            .withPaidBy(bob.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid, charlie.uid])
            .build();
        await driver.createExpense(eurExpense, bob.token);

        // Charlie pays £180 GBP expense, split equally among all 3
        const gbpExpense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Transport - GBP')
            .withAmount(180)
            .withCurrency('GBP')
            .withPaidBy(charlie.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid, charlie.uid])
            .build();
        await driver.createExpense(gbpExpense, charlie.token);

        // Get balances - should show separate currency balances
        const balances = await driver.getGroupBalances(group.id, alice.token);

        // Verify simplified debts exist for each currency
        expect(balances.simplifiedDebts.length).toBeGreaterThan(0);

        // Check that debts are properly categorized by currency
        const usdDebts = balances.simplifiedDebts.filter((d) => d.currency === 'USD');
        const eurDebts = balances.simplifiedDebts.filter((d) => d.currency === 'EUR');
        const gbpDebts = balances.simplifiedDebts.filter((d) => d.currency === 'GBP');

        expect(usdDebts.length).toBeGreaterThan(0);
        expect(eurDebts.length).toBeGreaterThan(0);
        expect(gbpDebts.length).toBeGreaterThan(0);

        // Verify currency-specific debt amounts are correct
        // USD: Alice paid $300, each owes $100, so Bob and Charlie each owe Alice $100
        const aliceUsdCredits = usdDebts.filter((d) => d.to.userId === alice.uid);
        const totalUsdOwedToAlice = aliceUsdCredits.reduce((sum, d) => sum + d.amount, 0);
        expect(totalUsdOwedToAlice).toBe(200); // $100 from Bob + $100 from Charlie

        // EUR: Bob paid €240, each owes €80, so Alice and Charlie each owe Bob €80
        const bobEurCredits = eurDebts.filter((d) => d.to.userId === bob.uid);
        const totalEurOwedToBob = bobEurCredits.reduce((sum, d) => sum + d.amount, 0);
        expect(totalEurOwedToBob).toBe(160); // €80 from Alice + €80 from Charlie

        // GBP: Charlie paid £180, each owes £60, so Alice and Bob each owe Charlie £60
        const charlieGbpCredits = gbpDebts.filter((d) => d.to.userId === charlie.uid);
        const totalGbpOwedToCharlie = charlieGbpCredits.reduce((sum, d) => sum + d.amount, 0);
        expect(totalGbpOwedToCharlie).toBe(120); // £60 from Alice + £60 from Bob

        // Verify no cross-currency debt consolidation occurs
        balances.simplifiedDebts.forEach((debt) => {
            expect(['USD', 'EUR', 'GBP']).toContain(debt.currency);
            expect(debt.amount).toBeGreaterThan(0);
        });
    });

    test('should handle partial settlement scenarios correctly', async () => {
        // Test partial settlements: multiple settlements to cover a debt
        const groupData = new CreateGroupRequestBuilder().withName('Partial Settlement Group').withDescription('Testing partial payment scenarios').build();
        const group = await driver.createGroup(groupData, alice.token);

        // Add Bob to group
        const shareLink = await driver.generateShareLink(group.id, alice.token);
        await driver.joinGroupViaShareLink(shareLink.linkId, bob.token);

        // Alice pays $200 expense, split equally - Bob owes Alice $100
        const expenseData = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Large Expense')
            .withAmount(200)
            .withCurrency('USD')
            .withPaidBy(alice.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid])
            .build();
        await driver.createExpense(expenseData, alice.token);

        // Verify initial debt: Bob owes Alice $100
        const initialBalances = await driver.getGroupBalances(group.id, alice.token);
        expect(initialBalances.simplifiedDebts).toHaveLength(1);
        expect(initialBalances.simplifiedDebts[0].amount).toBe(100);
        expect(initialBalances.simplifiedDebts[0].from.userId).toBe(bob.uid);
        expect(initialBalances.simplifiedDebts[0].to.userId).toBe(alice.uid);

        // Partial settlement 1: Bob pays Alice $40 (40% of debt)
        const partialSettlement1 = new SettlementBuilder().withGroupId(group.id).withPayer(bob.uid).withPayee(alice.uid).withAmount(40).withNote('Partial payment 1 of 3').build();
        await driver.createSettlement(partialSettlement1, bob.token);

        // Check remaining debt: should be $60
        const balancesAfter1 = await driver.getGroupBalances(group.id, alice.token);
        expect(balancesAfter1.simplifiedDebts).toHaveLength(1);
        expect(balancesAfter1.simplifiedDebts[0].amount).toBe(60);
        expect(balancesAfter1.userBalances[bob.uid].netBalance).toBe(-60);
        expect(balancesAfter1.userBalances[alice.uid].netBalance).toBe(60);

        // Partial settlement 2: Bob pays Alice $35 (partial)
        const partialSettlement2 = new SettlementBuilder().withGroupId(group.id).withPayer(bob.uid).withPayee(alice.uid).withAmount(35).withNote('Partial payment 2 of 3').build();
        await driver.createSettlement(partialSettlement2, bob.token);

        // Check remaining debt: should be $25
        const balancesAfter2 = await driver.getGroupBalances(group.id, alice.token);
        expect(balancesAfter2.simplifiedDebts).toHaveLength(1);
        expect(balancesAfter2.simplifiedDebts[0].amount).toBe(25);
        expect(balancesAfter2.userBalances[bob.uid].netBalance).toBe(-25);
        expect(balancesAfter2.userBalances[alice.uid].netBalance).toBe(25);

        // Final settlement: Bob pays remaining $25
        const finalSettlement = new SettlementBuilder().withGroupId(group.id).withPayer(bob.uid).withPayee(alice.uid).withAmount(25).withNote('Final settlement payment').build();
        await driver.createSettlement(finalSettlement, bob.token);

        // Check final balance: should be fully settled
        const finalBalances = await driver.getGroupBalances(group.id, alice.token);
        expect(finalBalances.simplifiedDebts).toHaveLength(0);
        expect(finalBalances.userBalances[bob.uid].netBalance).toBe(0);
        expect(finalBalances.userBalances[alice.uid].netBalance).toBe(0);

        // Group should show "All settled up"
        const groupFinal = await driver.getGroup(group.id, alice.token);
        expect(Object.keys(groupFinal.balance!.balancesByCurrency).length).toBe(0);
    });

    test('should handle overpayment scenarios correctly', async () => {
        // Test overpayment: settlement amount exceeding the debt
        const groupData = new CreateGroupRequestBuilder().withName('Overpayment Test Group').withDescription('Testing overpayment scenarios').build();
        const group = await driver.createGroup(groupData, alice.token);

        // Add Bob to group
        const shareLink = await driver.generateShareLink(group.id, alice.token);
        await driver.joinGroupViaShareLink(shareLink.linkId, bob.token);

        // Alice pays $120 expense, split equally - Bob owes Alice $60
        const expenseData = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Shared Expense')
            .withAmount(120)
            .withCurrency('USD')
            .withPaidBy(alice.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid])
            .build();
        await driver.createExpense(expenseData, alice.token);

        // Verify debt: Bob owes Alice $60
        const initialBalances = await driver.getGroupBalances(group.id, alice.token);
        expect(initialBalances.simplifiedDebts[0].amount).toBe(60);
        expect(initialBalances.simplifiedDebts[0].from.userId).toBe(bob.uid);

        // Overpayment: Bob pays Alice $100 (exceeds $60 debt)
        const overpayment = new SettlementBuilder().withGroupId(group.id).withPayer(bob.uid).withPayee(alice.uid).withAmount(100).withNote('Overpayment settlement').build();
        await driver.createSettlement(overpayment, bob.token);

        // Check result: Alice should now owe Bob $40 (overpayment of $40)
        const finalBalances = await driver.getGroupBalances(group.id, alice.token);
        expect(finalBalances.simplifiedDebts).toHaveLength(1);
        expect(finalBalances.simplifiedDebts[0].amount).toBe(40);
        expect(finalBalances.simplifiedDebts[0].from.userId).toBe(alice.uid);
        expect(finalBalances.simplifiedDebts[0].to.userId).toBe(bob.uid);

        // Verify net balances are correct
        expect(finalBalances.userBalances[alice.uid].netBalance).toBe(-40); // Alice owes
        expect(finalBalances.userBalances[bob.uid].netBalance).toBe(40); // Bob is owed
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

    test('should handle mixed currency partial settlements', async () => {
        // Test partial settlements across different currencies
        const groupData = new CreateGroupRequestBuilder().withName('Mixed Currency Settlement').withDescription('Testing cross-currency partial settlements').build();
        const group = await driver.createGroup(groupData, alice.token);

        // Add Bob to group
        const shareLink = await driver.generateShareLink(group.id, alice.token);
        await driver.joinGroupViaShareLink(shareLink.linkId, bob.token);

        // Alice pays $200 USD expense, split equally - Bob owes Alice $100 USD
        const usdExpense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('USD Expense')
            .withAmount(200)
            .withCurrency('USD')
            .withPaidBy(alice.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid])
            .build();
        await driver.createExpense(usdExpense, alice.token);

        // Bob pays €150 EUR expense, split equally - Alice owes Bob €75 EUR
        const eurExpense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('EUR Expense')
            .withAmount(150)
            .withCurrency('EUR')
            .withPaidBy(bob.uid)
            .withSplitType('equal')
            .withParticipants([alice.uid, bob.uid])
            .build();
        await driver.createExpense(eurExpense, bob.token);

        // Initial state: Bob owes Alice $100 USD, Alice owes Bob €75 EUR
        const initialBalances = await driver.getGroupBalances(group.id, alice.token);
        expect(initialBalances.simplifiedDebts).toHaveLength(2); // One for each currency

        const usdDebt = initialBalances.simplifiedDebts.find((d) => d.currency === 'USD');
        const eurDebt = initialBalances.simplifiedDebts.find((d) => d.currency === 'EUR');

        expect(usdDebt?.from.userId).toBe(bob.uid);
        expect(usdDebt?.amount).toBe(100);
        expect(eurDebt?.from.userId).toBe(alice.uid);
        expect(eurDebt?.amount).toBe(75);

        // Partial settlement in USD: Bob pays Alice $60 USD
        const usdSettlement = new SettlementBuilder().withGroupId(group.id).withPayer(bob.uid).withPayee(alice.uid).withAmount(60).withCurrency('USD').withNote('Partial USD settlement').build();
        await driver.createSettlement(usdSettlement, bob.token);

        // Check state: Bob should still owe Alice $40 USD, EUR debt unchanged
        const midBalances = await driver.getGroupBalances(group.id, alice.token);
        expect(midBalances.simplifiedDebts).toHaveLength(2);

        const midUsdDebt = midBalances.simplifiedDebts.find((d) => d.currency === 'USD');
        const midEurDebt = midBalances.simplifiedDebts.find((d) => d.currency === 'EUR');

        expect(midUsdDebt?.amount).toBe(40); // Reduced from $100 to $40
        expect(midEurDebt?.amount).toBe(75); // Unchanged EUR debt

        // Partial settlement in EUR: Alice pays Bob €50 EUR
        const eurSettlement = new SettlementBuilder().withGroupId(group.id).withPayer(alice.uid).withPayee(bob.uid).withAmount(50).withCurrency('EUR').withNote('Partial EUR settlement').build();
        await driver.createSettlement(eurSettlement, alice.token);

        // Final check: Bob owes Alice $40 USD, Alice owes Bob €25 EUR
        const finalBalances = await driver.getGroupBalances(group.id, alice.token);
        expect(finalBalances.simplifiedDebts).toHaveLength(2);

        const finalUsdDebt = finalBalances.simplifiedDebts.find((d) => d.currency === 'USD');
        const finalEurDebt = finalBalances.simplifiedDebts.find((d) => d.currency === 'EUR');

        expect(finalUsdDebt?.amount).toBe(40); // USD debt unchanged
        expect(finalEurDebt?.amount).toBe(25); // EUR debt reduced from €75 to €25
    });
});
