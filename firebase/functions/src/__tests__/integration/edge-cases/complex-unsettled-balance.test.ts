import {describe, test, expect, beforeEach} from 'vitest';
import {ApiDriver, CreateGroupRequestBuilder, borrowTestUsers, User} from '@splitifyd/test-support';
import { ExpenseBuilder } from '@splitifyd/test-support';
import { SettlementBuilder } from '@splitifyd/test-support';
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('Complex Unsettled Balance - API Integration Test', () => {
    const apiDriver = new ApiDriver();

    let user1: AuthenticatedFirebaseUser;
    let user2: AuthenticatedFirebaseUser;
    let user3: AuthenticatedFirebaseUser;

    beforeEach(async () => {
        ([user1, user2, user3] = await borrowTestUsers(3));
    });

    test('should show correct balances when multiple users create expenses with equal split', async () => {
        // Create group with Alice (same as E2E test)
        const groupData = new CreateGroupRequestBuilder().withName('Vacation Trip 2024').withDescription('Beach house rental and activities').build();
        const group = await apiDriver.createGroup(groupData, user1.token);

        // Add Bob to the group
        const shareLink = await apiDriver.generateShareLink(group.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

        // Verify both members are in the group
        const groupAfterJoin = await apiDriver.getGroup(group.id, user1.token);
        expect(Object.keys(groupAfterJoin.members)).toHaveLength(2);
        expect(groupAfterJoin.members).toHaveProperty(user1.uid);
        expect(groupAfterJoin.members).toHaveProperty(user2.uid);

        const currency = 'USD';

        // Alice adds beach house expense ($800) - paid by Alice, split equally among all
        const expense1Data = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Beach House Rental')
            .withAmount(80000) // $800.00 in cents
            .withCurrency(currency)
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid]) // Both participants
            .build();

        await apiDriver.createExpense(expense1Data, user1.token);

        // Bob adds restaurant expense ($120) - paid by Bob, split equally among all
        const expense2Data = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Restaurant Dinner')
            .withAmount(12000) // $120.00 in cents
            .withCurrency(currency)
            .withPaidBy(user2.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid]) // Both participants
            .build();

        await apiDriver.createExpense(expense2Data, user2.token);

        // Get the group balance
        const balances = await apiDriver.getGroupBalances(group.id, user1.token);

        // Verify the balance calculation
        // Alice paid $800, Bob paid $120, total = $920
        // Each person's share = $920 / 2 = $460
        // Alice should be owed: $800 - $460 = $340
        // Bob should owe: $460 - $120 = $340

        expect(balances.simplifiedDebts).toBeDefined();
        expect(balances.simplifiedDebts.length).toBeGreaterThan(0);

        // The simplified debts should show Bob owes Alice $340
        const debt = balances.simplifiedDebts.find((d: any) => d.from.userId === user2.uid && d.to.userId === user1.uid);
        expect(debt).toBeDefined();
        expect(debt?.amount).toBe(34000); // $340.00 in cents

        // Check individual balances
        expect(balances.userBalances[user1.uid]).toBeDefined();
        expect(balances.userBalances[user1.uid].netBalance).toBe(34000); // Alice is owed $340

        expect(balances.userBalances[user2.uid]).toBeDefined();
        expect(balances.userBalances[user2.uid].netBalance).toBe(-34000); // Bob owes $340

        // Also check via the group endpoint to see what the frontend receives
        const groupWithBalance = await apiDriver.getGroup(group.id, user1.token);

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
        const group = await apiDriver.createGroup(groupData, user1.token);

        // Add Bob to the group
        const shareLink = await apiDriver.generateShareLink(group.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

        // Alice pays $150 expense split equally between Alice and Bob
        const expenseData = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('One Person Pays')
            .withAmount(150) // $150.00 in dollars (not cents!)
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();

        const expense = await apiDriver.createExpense(expenseData, user1.token);

        // Check the stored expense splits
        const storedExpense = await apiDriver.getExpense(expense.id, user1.token);

        // Expected: Each person should owe $75 (in dollars)
        expect(storedExpense.splits).toHaveLength(2);
        const aliceSplit = storedExpense.splits.find((s: any) => s.userId === user1.uid);
        const bobSplit = storedExpense.splits.find((s: any) => s.userId === user2.uid);

        // This should pass - splits should be $75 each
        expect(aliceSplit?.amount).toBe(75); // $75.00 in dollars
        expect(bobSplit?.amount).toBe(75); // $75.00 in dollars

        // Get the balance calculation
        const initialBalances = await apiDriver.getGroupBalances(group.id, user1.token);

        // Expected balance logic:
        // - Alice paid $150, owes $75 (her share) = net +$75
        // - Bob paid $0, owes $75 (his share) = net -$75
        // So Bob should owe Alice exactly $75

        const bobBalance = initialBalances.userBalances[user2.uid];
        const aliceBalance = initialBalances.userBalances[user1.uid];

        // This is the CRITICAL TEST - if this fails, we've found the balance calculation bug
        expect(aliceBalance?.netBalance).toBe(75); // Alice should be owed $75
        expect(bobBalance?.netBalance).toBe(-75); // Bob should owe $75

        // Check simplified debts
        expect(initialBalances.simplifiedDebts).toHaveLength(1);
        const debt = initialBalances.simplifiedDebts[0];

        expect(debt.from.userId).toBe(user2.uid);
        expect(debt.to.userId).toBe(user1.uid);
        expect(debt.amount).toBe(75); // Should be $75

        // Now settle the ACTUAL debt amount (whatever the backend calculated)
        const actualDebtAmount = debt.amount; // This should be 75 dollars

        const settlementData = new SettlementBuilder()
            .withGroupId(group.id)
            .withPayer(user2.uid)
            .withPayee(user1.uid)
            .withAmount(actualDebtAmount) // Already in dollars
            .withNote('Full settlement payment - E2E bug replication')
            .build();

        const settlement = await apiDriver.createSettlement(settlementData, user2.token);

        // Verify settlement was stored correctly
        const storedSettlement = await apiDriver.getSettlement(settlement.id, user2.token);

        expect(storedSettlement.amount).toBe(actualDebtAmount);
        expect(storedSettlement.payer.uid).toBe(user2.uid);
        expect(storedSettlement.payee.uid).toBe(user1.uid);

        // Check final balances after settlement
        const finalBalances = await apiDriver.getGroupBalances(group.id, user1.token);

        const finalAliceBalance = finalBalances.userBalances[user1.uid];
        const finalBobBalance = finalBalances.userBalances[user2.uid];

        // After settling the exact debt amount, both should be at $0 net balance
        expect(finalAliceBalance?.netBalance).toBe(0);
        expect(finalBobBalance?.netBalance).toBe(0);

        // Simplified debts should be empty (all settled up)
        expect(finalBalances.simplifiedDebts).toHaveLength(0);

        // This is what the UI uses to show "All settled up!"
        const groupWithFinalBalance = await apiDriver.getGroup(group.id, user1.token);
        expect(Object.keys(groupWithFinalBalance.balance!.balancesByCurrency).length).toBe(0);
    });

    test('should handle multi-currency expenses within the same group', async () => {
        // Test multi-currency scenario: expenses in USD, EUR, and GBP within same group
        const groupData = new CreateGroupRequestBuilder().withName('Multi-Currency Group').withDescription('Testing different currencies').build();
        const group = await apiDriver.createGroup(groupData, user1.token);

        // Add Bob and Charlie to the group
        const shareLink = await apiDriver.generateShareLink(group.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, user3.token);

        // Alice pays $300 USD expense, split equally among all 3
        const usdExpense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Hotel - USD')
            .withAmount(300)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid, user3.uid])
            .build();
        await apiDriver.createExpense(usdExpense, user1.token);

        // Bob pays €240 EUR expense, split equally among all 3
        const eurExpense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Dinner - EUR')
            .withAmount(240)
            .withCurrency('EUR')
            .withPaidBy(user2.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid, user3.uid])
            .build();
        await apiDriver.createExpense(eurExpense, user2.token);

        // Charlie pays £180 GBP expense, split equally among all 3
        const gbpExpense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Transport - GBP')
            .withAmount(180)
            .withCurrency('GBP')
            .withPaidBy(user3.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid, user3.uid])
            .build();
        await apiDriver.createExpense(gbpExpense, user3.token);

        // Get balances - should show separate currency balances
        const balances = await apiDriver.getGroupBalances(group.id, user1.token);

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
        const aliceUsdCredits = usdDebts.filter((d) => d.to.userId === user1.uid);
        const totalUsdOwedToAlice = aliceUsdCredits.reduce((sum, d) => sum + d.amount, 0);
        expect(totalUsdOwedToAlice).toBe(200); // $100 from Bob + $100 from Charlie

        // EUR: Bob paid €240, each owes €80, so Alice and Charlie each owe Bob €80
        const bobEurCredits = eurDebts.filter((d) => d.to.userId === user2.uid);
        const totalEurOwedToBob = bobEurCredits.reduce((sum, d) => sum + d.amount, 0);
        expect(totalEurOwedToBob).toBe(160); // €80 from Alice + €80 from Charlie

        // GBP: Charlie paid £180, each owes £60, so Alice and Bob each owe Charlie £60
        const charlieGbpCredits = gbpDebts.filter((d) => d.to.userId === user3.uid);
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
        const group = await apiDriver.createGroup(groupData, user1.token);

        // Add Bob to group
        const shareLink = await apiDriver.generateShareLink(group.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

        // Alice pays $200 expense, split equally - Bob owes Alice $100
        const expenseData = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Large Expense')
            .withAmount(200)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        await apiDriver.createExpense(expenseData, user1.token);

        // Verify initial debt: Bob owes Alice $100
        const initialBalances = await apiDriver.getGroupBalances(group.id, user1.token);
        expect(initialBalances.simplifiedDebts).toHaveLength(1);
        expect(initialBalances.simplifiedDebts[0].amount).toBe(100);
        expect(initialBalances.simplifiedDebts[0].from.userId).toBe(user2.uid);
        expect(initialBalances.simplifiedDebts[0].to.userId).toBe(user1.uid);

        // Partial settlement 1: Bob pays Alice $40 (40% of debt)
        const partialSettlement1 = new SettlementBuilder().withGroupId(group.id).withPayer(user2.uid).withPayee(user1.uid).withAmount(40).withNote('Partial payment 1 of 3').build();
        await apiDriver.createSettlement(partialSettlement1, user2.token);

        // Check remaining debt: should be $60
        const balancesAfter1 = await apiDriver.getGroupBalances(group.id, user1.token);
        expect(balancesAfter1.simplifiedDebts).toHaveLength(1);
        expect(balancesAfter1.simplifiedDebts[0].amount).toBe(60);
        expect(balancesAfter1.userBalances[user2.uid].netBalance).toBe(-60);
        expect(balancesAfter1.userBalances[user1.uid].netBalance).toBe(60);

        // Partial settlement 2: Bob pays Alice $35 (partial)
        const partialSettlement2 = new SettlementBuilder().withGroupId(group.id).withPayer(user2.uid).withPayee(user1.uid).withAmount(35).withNote('Partial payment 2 of 3').build();
        await apiDriver.createSettlement(partialSettlement2, user2.token);

        // Check remaining debt: should be $25
        const balancesAfter2 = await apiDriver.getGroupBalances(group.id, user1.token);
        expect(balancesAfter2.simplifiedDebts).toHaveLength(1);
        expect(balancesAfter2.simplifiedDebts[0].amount).toBe(25);
        expect(balancesAfter2.userBalances[user2.uid].netBalance).toBe(-25);
        expect(balancesAfter2.userBalances[user1.uid].netBalance).toBe(25);

        // Final settlement: Bob pays remaining $25
        const finalSettlement = new SettlementBuilder().withGroupId(group.id).withPayer(user2.uid).withPayee(user1.uid).withAmount(25).withNote('Final settlement payment').build();
        await apiDriver.createSettlement(finalSettlement, user2.token);

        // Check final balance: should be fully settled
        const finalBalances = await apiDriver.getGroupBalances(group.id, user1.token);
        expect(finalBalances.simplifiedDebts).toHaveLength(0);
        expect(finalBalances.userBalances[user2.uid].netBalance).toBe(0);
        expect(finalBalances.userBalances[user1.uid].netBalance).toBe(0);

        // Group should show "All settled up"
        const groupFinal = await apiDriver.getGroup(group.id, user1.token);
        expect(Object.keys(groupFinal.balance!.balancesByCurrency).length).toBe(0);
    });

    test('should handle overpayment scenarios correctly', async () => {
        // Test overpayment: settlement amount exceeding the debt
        const groupData = new CreateGroupRequestBuilder().withName('Overpayment Test Group').withDescription('Testing overpayment scenarios').build();
        const group = await apiDriver.createGroup(groupData, user1.token);

        // Add Bob to group
        const shareLink = await apiDriver.generateShareLink(group.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

        // Alice pays $120 expense, split equally - Bob owes Alice $60
        const expenseData = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Shared Expense')
            .withAmount(120)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        await apiDriver.createExpense(expenseData, user1.token);

        // Verify debt: Bob owes Alice $60
        const initialBalances = await apiDriver.getGroupBalances(group.id, user1.token);
        expect(initialBalances.simplifiedDebts[0].amount).toBe(60);
        expect(initialBalances.simplifiedDebts[0].from.userId).toBe(user2.uid);

        // Overpayment: Bob pays Alice $100 (exceeds $60 debt)
        const overpayment = new SettlementBuilder().withGroupId(group.id).withPayer(user2.uid).withPayee(user1.uid).withAmount(100).withNote('Overpayment settlement').build();
        await apiDriver.createSettlement(overpayment, user2.token);

        // Check result: Alice should now owe Bob $40 (overpayment of $40)
        const finalBalances = await apiDriver.getGroupBalances(group.id, user1.token);
        expect(finalBalances.simplifiedDebts).toHaveLength(1);
        expect(finalBalances.simplifiedDebts[0].amount).toBe(40);
        expect(finalBalances.simplifiedDebts[0].from.userId).toBe(user1.uid);
        expect(finalBalances.simplifiedDebts[0].to.userId).toBe(user2.uid);

        // Verify net balances are correct
        expect(finalBalances.userBalances[user1.uid].netBalance).toBe(-40); // Alice owes
        expect(finalBalances.userBalances[user2.uid].netBalance).toBe(40); // Bob is owed
    });

    test('should handle the specific case where expense splits might be calculated incorrectly', async () => {
        // This test isolates the expense splitting logic to see if that's where the bug occurs

        const groupData = new CreateGroupRequestBuilder().withName('Split Calculation Test').build();
        const group = await apiDriver.createGroup(groupData, user1.token);

        const shareLink = await apiDriver.generateShareLink(group.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

        // Create the exact same expense as the E2E test
        const expenseData = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('Test Expense - Equal Split')
            .withAmount(150) // $150.00 in dollars - same as E2E test
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();

        const expense = await apiDriver.createExpense(expenseData, user1.token);

        // Verify the expense was stored with correct splits
        const storedExpense = await apiDriver.getExpense(expense.id, user1.token);

        // Verify splits are exactly half of total
        expect(storedExpense.splits).toHaveLength(2);
        expect(storedExpense.splits.find((s: any) => s.userId === user1.uid)?.amount).toBe(75);
        expect(storedExpense.splits.find((s: any) => s.userId === user2.uid)?.amount).toBe(75);

        // Now check what the balance calculator produces
        const balances = await apiDriver.getGroupBalances(group.id, user1.token);

        // The balance calculation should show:
        // - Alice paid $150, owes $75 (her share), net: +$75
        // - Bob paid $0, owes $75 (his share), net: -$75
        // So Bob owes Alice $75

        const bobOwes = balances.userBalances[user2.uid]?.netBalance;
        const aliceOwed = balances.userBalances[user1.uid]?.netBalance;

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
        const group = await apiDriver.createGroup(groupData, user1.token);

        // Add Bob to group
        const shareLink = await apiDriver.generateShareLink(group.id, user1.token);
        await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

        // Alice pays $200 USD expense, split equally - Bob owes Alice $100 USD
        const usdExpense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('USD Expense')
            .withAmount(200)
            .withCurrency('USD')
            .withPaidBy(user1.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        await apiDriver.createExpense(usdExpense, user1.token);

        // Bob pays €150 EUR expense, split equally - Alice owes Bob €75 EUR
        const eurExpense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription('EUR Expense')
            .withAmount(150)
            .withCurrency('EUR')
            .withPaidBy(user2.uid)
            .withSplitType('equal')
            .withParticipants([user1.uid, user2.uid])
            .build();
        await apiDriver.createExpense(eurExpense, user2.token);

        // Initial state: Bob owes Alice $100 USD, Alice owes Bob €75 EUR
        const initialBalances = await apiDriver.getGroupBalances(group.id, user1.token);
        expect(initialBalances.simplifiedDebts).toHaveLength(2); // One for each currency

        const usdDebt = initialBalances.simplifiedDebts.find((d) => d.currency === 'USD');
        const eurDebt = initialBalances.simplifiedDebts.find((d) => d.currency === 'EUR');

        expect(usdDebt?.from.userId).toBe(user2.uid);
        expect(usdDebt?.amount).toBe(100);
        expect(eurDebt?.from.userId).toBe(user1.uid);
        expect(eurDebt?.amount).toBe(75);

        // Partial settlement in USD: Bob pays Alice $60 USD
        const usdSettlement = new SettlementBuilder().withGroupId(group.id).withPayer(user2.uid).withPayee(user1.uid).withAmount(60).withCurrency('USD').withNote('Partial USD settlement').build();
        await apiDriver.createSettlement(usdSettlement, user2.token);

        // Check state: Bob should still owe Alice $40 USD, EUR debt unchanged
        const midBalances = await apiDriver.getGroupBalances(group.id, user1.token);
        expect(midBalances.simplifiedDebts).toHaveLength(2);

        const midUsdDebt = midBalances.simplifiedDebts.find((d) => d.currency === 'USD');
        const midEurDebt = midBalances.simplifiedDebts.find((d) => d.currency === 'EUR');

        expect(midUsdDebt?.amount).toBe(40); // Reduced from $100 to $40
        expect(midEurDebt?.amount).toBe(75); // Unchanged EUR debt

        // Partial settlement in EUR: Alice pays Bob €50 EUR
        const eurSettlement = new SettlementBuilder().withGroupId(group.id).withPayer(user1.uid).withPayee(user2.uid).withAmount(50).withCurrency('EUR').withNote('Partial EUR settlement').build();
        await apiDriver.createSettlement(eurSettlement, user1.token);

        // Final check: Bob owes Alice $40 USD, Alice owes Bob €25 EUR
        const finalBalances = await apiDriver.getGroupBalances(group.id, user1.token);
        expect(finalBalances.simplifiedDebts).toHaveLength(2);

        const finalUsdDebt = finalBalances.simplifiedDebts.find((d) => d.currency === 'USD');
        const finalEurDebt = finalBalances.simplifiedDebts.find((d) => d.currency === 'EUR');

        expect(finalUsdDebt?.amount).toBe(40); // USD debt unchanged
        expect(finalEurDebt?.amount).toBe(25); // EUR debt reduced from €75 to €25
    });
});
