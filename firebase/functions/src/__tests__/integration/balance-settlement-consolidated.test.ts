import { beforeEach, describe, expect, test } from 'vitest';
import { ApiDriver, borrowTestUsers, CreateGroupRequestBuilder, CreateExpenseRequestBuilder, SettlementBuilder, TestGroupManager, generateShortId } from '@splitifyd/test-support';
import { PooledTestUser, UserToken } from '@splitifyd/shared';

describe('Balance & Settlement - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(6); // Get enough users for all tests
    });

    describe('Basic Balance Calculation', () => {
        test('should return correct response structure for empty and populated groups', async () => {
            // Test empty group balance structure
            const emptyGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName('Empty Balance Test').build(), users[0].token);

            const emptyBalances = await apiDriver.getGroupBalances(emptyGroup.id, users[0].token);
            expect(emptyBalances.groupId).toBe(emptyGroup.id);
            expect(emptyBalances.userBalances).toBeDefined();
            expect(emptyBalances.simplifiedDebts).toBeDefined();
            expect(emptyBalances.simplifiedDebts).toHaveLength(0);

            // Test populated group
            const testGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName('Populated Balance Test').build(), users[0].token);
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[2].token);

            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(30)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            const populatedBalances = await apiDriver.waitForBalanceUpdate(testGroup.id, users[0].token, 2000);
            expect(populatedBalances.groupId).toBe(testGroup.id);
            expect(Object.keys(populatedBalances.userBalances)).toContain(users[0].uid);
            expect(populatedBalances.userBalances[users[0].uid]).toHaveProperty('netBalance');
            expect(populatedBalances.userBalances[users[0].uid].netBalance).toBeGreaterThan(0); // User 0 should be owed money
        });

        test('should handle basic two-user balance calculations', async () => {
            // Create group with 2 users
            const groupData = new CreateGroupRequestBuilder().withName('Two User Test').build();
            const group = await apiDriver.createGroup(groupData, users[0].token);
            const shareResponse = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);

            // User 0 pays €100, split equally - User 1 owes User 0 €50
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100)
                    .withCurrency('EUR')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Wait for first expense to be processed
            await apiDriver.waitForBalanceUpdate(group.id, users[0].token, 2000);

            // User 1 pays €80, split equally - User 0 owes User 1 €40
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(80)
                    .withCurrency('EUR')
                    .withPaidBy(users[1].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[1].token,
            );

            // Wait for final balance calculation after both expenses
            const balances = await apiDriver.waitForBalanceUpdate(group.id, users[0].token, 2000);

            // Mathematical expectation: User 0 paid €100 and owes €40, net +€10
            // User 1 paid €80 and owes €50, net -€10
            expect(balances.userBalances[users[0].uid].netBalance).toBe(10);
            expect(balances.userBalances[users[1].uid].netBalance).toBe(-10);

            // Verify conservation of money
            const total = balances.userBalances[users[0].uid].netBalance + balances.userBalances[users[1].uid].netBalance;
            expect(total).toBe(0);

            // Verify debt simplification
            expect(balances.simplifiedDebts).toBeDefined();
            expect(balances.simplifiedDebts.length).toBeGreaterThan(0);
        });

        test('should handle zero-sum scenarios correctly', async () => {
            // Test zero-sum scenario
            const zeroSumGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName('Zero Sum Test').build(), users[0].token);
            const zeroShareResponse = await apiDriver.generateShareLink(zeroSumGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(zeroShareResponse.linkId, users[1].token);

            // Both users pay equal amounts
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(zeroSumGroup.id)
                    .withAmount(50)
                    .withCurrency('EUR')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            // Wait for first expense to be processed
            await apiDriver.waitForBalanceUpdate(zeroSumGroup.id, users[0].token, 2000);

            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(zeroSumGroup.id)
                    .withAmount(50)
                    .withCurrency('EUR')
                    .withPaidBy(users[1].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .build(),
                users[1].token,
            );

            // Wait for final balance calculation after both expenses
            const zeroBalances = await apiDriver.waitForBalanceUpdate(zeroSumGroup.id, users[0].token, 2000);

            // Zero-sum scenario: Both users pay €50 and split equally (€25 each)
            // Mathematical expectation: Both users should have net balance of 0
            // (Each paid €50 and owes €50, so they're even)
            expect(zeroBalances.userBalances[users[0].uid].netBalance).toBe(0);
            expect(zeroBalances.userBalances[users[1].uid].netBalance).toBe(0);

            // Verify conservation of money (total should always be zero)
            const zeroTotal = zeroBalances.userBalances[users[0].uid].netBalance + zeroBalances.userBalances[users[1].uid].netBalance;
            expect(zeroTotal).toBe(0);

            // Verify debt simplification - should be empty since all balances are zero
            expect(zeroBalances.simplifiedDebts).toBeDefined();
            expect(zeroBalances.simplifiedDebts.length).toBe(0);
        });

        test('should handle authentication and authorization correctly', async () => {
            const testGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().withName('Auth Test Group').build(), users[0].token);

            // Test that non-member cannot access balances (returns 404 since they can't see the group exists)
            await expect(apiDriver.getGroupBalances(testGroup.id, users[1].token)).rejects.toThrow(/failed with status 404/);

            // Test invalid group ID
            await expect(apiDriver.getGroupBalances('invalid-group-id', users[0].token)).rejects.toThrow(/failed with status 404/);
        });
    });

    describe('Complex Balance Scenarios and Multi-Currency', () => {
        test('should show correct balances when multiple users create expenses with equal split', async () => {
            // Create group with Alice (same as E2E test)
            const groupData = new CreateGroupRequestBuilder().withName('Vacation Trip 2024').withDescription('Beach house rental and activities').build();
            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Add Bob to the group
            const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Verify both members are in the group
            const { members } = await apiDriver.getGroupFullDetails(group.id, users[0].token);
            expect(members.members.length).toBe(2);
            const member1 = members.members.find((m) => m.uid === users[0].uid);
            const member2 = members.members.find((m) => m.uid === users[1].uid);
            expect(member1).toBeDefined();
            expect(member2).toBeDefined();

            const currency = 'EUR';

            // Alice adds beach house expense (€800) - paid by Alice, split equally among all
            const expense1Data = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Beach House Rental')
                .withAmount(80000) // €800.00 in cents
                .withCurrency(currency)
                .withPaidBy(users[0].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid]) // Both participants
                .build();

            await apiDriver.createExpense(expense1Data, users[0].token);

            // Bob adds restaurant expense (€120) - paid by Bob, split equally among all
            const expense2Data = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Restaurant Dinner')
                .withAmount(12000) // €120.00 in cents
                .withCurrency(currency)
                .withPaidBy(users[1].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid]) // Both participants
                .build();

            await apiDriver.createExpense(expense2Data, users[1].token);

            // Get the group balance
            const balances = await apiDriver.getGroupBalances(group.id, users[0].token);

            // Verify the balance calculation
            // Alice paid €800, Bob paid €120, total = €920
            // Each person's share = €920 / 2 = €460
            // Alice should be owed: €800 - €460 = €340
            // Bob should owe: €460 - €120 = €340

            expect(balances.simplifiedDebts).toBeDefined();
            expect(balances.simplifiedDebts.length).toBeGreaterThan(0);

            // The simplified debts should show Bob owes Alice €340
            const debt = balances.simplifiedDebts.find((d: any) => d.from.userId === users[1].uid && d.to.userId === users[0].uid);
            expect(debt).toBeDefined();
            expect(debt?.amount).toBe(34000); // €340.00 in cents

            // Check individual balances
            expect(balances.userBalances[users[0].uid]).toBeDefined();
            expect(balances.userBalances[users[0].uid].netBalance).toBe(34000); // Alice is owed €340

            expect(balances.userBalances[users[1].uid]).toBeDefined();
            expect(balances.userBalances[users[1].uid].netBalance).toBe(-34000); // Bob owes €340

            // Also check via the group endpoint to see what the frontend receives
            const { balances: groupBalances } = await apiDriver.getGroupFullDetails(group.id, users[0].token);

            // The group balance should show that there are unsettled amounts
            expect(groupBalances).toBeDefined();
            expect(groupBalances.balancesByCurrency).toBeDefined();
            expect(groupBalances.balancesByCurrency[currency][users[0].uid].netBalance).toBe(34000); // Alice is owed €340
            expect(groupBalances.balancesByCurrency[currency][users[1].uid].netBalance).toBe(-34000); // Bob owes €340
        });

        test('should handle multi-currency expenses within the same group', async () => {
            // Test multi-currency scenario: expenses in USD, EUR, and GBP within same group
            const groupData = new CreateGroupRequestBuilder().withName('Multi-Currency Group').withDescription('Testing different currencies').build();
            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Add Bob and Charlie to the group
            const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[2].token);

            // Alice pays $300 USD expense, split equally among all 3
            const usdExpense = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Hotel - USD')
                .withAmount(300)
                .withCurrency('USD')
                .withPaidBy(users[0].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .build();
            await apiDriver.createExpense(usdExpense, users[0].token);

            // Bob pays €240 EUR expense, split equally among all 3
            const eurExpense = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Dinner - EUR')
                .withAmount(240)
                .withCurrency('EUR')
                .withPaidBy(users[1].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .build();
            await apiDriver.createExpense(eurExpense, users[1].token);

            // Charlie pays £180 GBP expense, split equally among all 3
            const gbpExpense = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Transport - GBP')
                .withAmount(180)
                .withCurrency('GBP')
                .withPaidBy(users[2].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .build();
            await apiDriver.createExpense(gbpExpense, users[2].token);

            // Get balances - should show separate currency balances
            const balances = await apiDriver.getGroupBalances(group.id, users[0].token);

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
            const aliceUsdCredits = usdDebts.filter((d) => d.to.userId === users[0].uid);
            const totalUsdOwedToAlice = aliceUsdCredits.reduce((sum, d) => sum + d.amount, 0);
            expect(totalUsdOwedToAlice).toBe(200); // $100 from Bob + $100 from Charlie

            // EUR: Bob paid €240, each owes €80, so Alice and Charlie each owe Bob €80
            const bobEurCredits = eurDebts.filter((d) => d.to.userId === users[1].uid);
            const totalEurOwedToBob = bobEurCredits.reduce((sum, d) => sum + d.amount, 0);
            expect(totalEurOwedToBob).toBe(160); // €80 from Alice + €80 from Charlie

            // GBP: Charlie paid £180, each owes £60, so Alice and Bob each owe Charlie £60
            const charlieGbpCredits = gbpDebts.filter((d) => d.to.userId === users[2].uid);
            const totalGbpOwedToCharlie = charlieGbpCredits.reduce((sum, d) => sum + d.amount, 0);
            expect(totalGbpOwedToCharlie).toBe(120); // £60 from Alice + £60 from Bob

            // Verify no cross-currency debt consolidation occurs
            balances.simplifiedDebts.forEach((debt) => {
                expect(['USD', 'EUR', 'GBP']).toContain(debt.currency);
                expect(debt.amount).toBeGreaterThan(0);
            });
        });

        test('should replicate settlement balance bug from failing E2E test', async () => {
            // This test replicates the exact scenario from the failing E2E test:
            // - Create €150 expense split between 2 users
            // - Expected: User2 owes User1 €75 (half of €150)
            // - Actual bug: User2 owes User1 €150 (full amount)
            // - Settlement of actual debt amount should result in "all settled up"

            // Create group with Alice
            const groupData = new CreateGroupRequestBuilder().withName('Settlement Bug Test Group').withDescription('Testing exact settlement balance scenario').build();
            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Add Bob to the group
            const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Alice pays €150 expense split equally between Alice and Bob
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('One Person Pays')
                .withAmount(150) // €150.00 in euros (not cents!)
                .withCurrency('EUR')
                .withPaidBy(users[0].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            const expense = await apiDriver.createExpense(expenseData, users[0].token);

            // Check the stored expense splits
            const storedExpense = await apiDriver.getExpense(expense.id, users[0].token);

            // Expected: Each person should owe $75 (in dollars)
            expect(storedExpense.splits).toHaveLength(2);
            const aliceSplit = storedExpense.splits.find((s: any) => s.userId === users[0].uid);
            const bobSplit = storedExpense.splits.find((s: any) => s.userId === users[1].uid);

            // This should pass - splits should be $75 each
            expect(aliceSplit?.amount).toBe(75); // $75.00 in dollars
            expect(bobSplit?.amount).toBe(75); // $75.00 in dollars

            // Get the balance calculation
            const initialBalances = await apiDriver.getGroupBalances(group.id, users[0].token);

            // Expected balance logic:
            // - Alice paid €150, owes €75 (her share) = net +€75
            // - Bob paid €0, owes €75 (his share) = net -€75
            // So Bob should owe Alice exactly €75

            const bobBalance = initialBalances.userBalances[users[1].uid];
            const aliceBalance = initialBalances.userBalances[users[0].uid];

            // This is the CRITICAL TEST - if this fails, we've found the balance calculation bug
            expect(aliceBalance?.netBalance).toBe(75); // Alice should be owed €75
            expect(bobBalance?.netBalance).toBe(-75); // Bob should owe €75

            // Check simplified debts
            expect(initialBalances.simplifiedDebts).toHaveLength(1);
            const debt = initialBalances.simplifiedDebts[0];

            expect(debt.from.userId).toBe(users[1].uid);
            expect(debt.to.userId).toBe(users[0].uid);
            expect(debt.amount).toBe(75); // Should be €75

            // Now settle the ACTUAL debt amount (whatever the backend calculated)
            const actualDebtAmount = debt.amount; // This should be 75 euros

            const settlementData = new SettlementBuilder()
                .withGroupId(group.id)
                .withPayer(users[1].uid)
                .withPayee(users[0].uid)
                .withAmount(actualDebtAmount) // Already in euros
                .withCurrency('EUR')
                .withNote('Full settlement payment - E2E bug replication')
                .build();

            const settlement = await apiDriver.createSettlement(settlementData, users[1].token);

            // Verify settlement was stored correctly
            const storedSettlement = await apiDriver.getSettlement(group.id, settlement.id, users[1].token);

            expect(storedSettlement.amount).toBe(actualDebtAmount);
            expect(storedSettlement.payer.uid).toBe(users[1].uid);
            expect(storedSettlement.payee.uid).toBe(users[0].uid);

            // Check final balances after settlement
            const finalBalances = await apiDriver.getGroupBalances(group.id, users[0].token);

            const finalAliceBalance = finalBalances.userBalances[users[0].uid];
            const finalBobBalance = finalBalances.userBalances[users[1].uid];

            // After settling the exact debt amount, both should be at $0 net balance
            expect(finalAliceBalance?.netBalance).toBe(0);
            expect(finalBobBalance?.netBalance).toBe(0);

            // Simplified debts should be empty (all settled up)
            expect(finalBalances.simplifiedDebts).toHaveLength(0);

            // This is what the UI uses to show "All settled up!"
            const { balances: finalGroupBalances } = await apiDriver.getGroupFullDetails(group.id, users[0].token);
            // Check that all users have zero net balance (settled up)
            if (Object.keys(finalGroupBalances.balancesByCurrency).length > 0) {
                const currency = Object.keys(finalGroupBalances.balancesByCurrency)[0];
                const userBalances = Object.values(finalGroupBalances.balancesByCurrency[currency]);
                userBalances.forEach((balance: any) => {
                    expect(balance.netBalance).toBe(0);
                });
            }
        });

        test('should handle the specific case where expense splits might be calculated incorrectly', async () => {
            // This test isolates the expense splitting logic to see if that's where the bug occurs

            const groupData = new CreateGroupRequestBuilder().withName('Split Calculation Test').build();
            const group = await apiDriver.createGroup(groupData, users[0].token);

            const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Create the exact same expense as the E2E test
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Test Expense - Equal Split')
                .withAmount(150) // $150.00 in dollars - same as E2E test
                .withPaidBy(users[0].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            const expense = await apiDriver.createExpense(expenseData, users[0].token);

            // Verify the expense was stored with correct splits
            const storedExpense = await apiDriver.getExpense(expense.id, users[0].token);

            // Verify splits are exactly half of total
            expect(storedExpense.splits).toHaveLength(2);
            expect(storedExpense.splits.find((s: any) => s.userId === users[0].uid)?.amount).toBe(75);
            expect(storedExpense.splits.find((s: any) => s.userId === users[1].uid)?.amount).toBe(75);

            // Now check what the balance calculator produces
            const balances = await apiDriver.getGroupBalances(group.id, users[0].token);

            // The balance calculation should show:
            // - Alice paid $150, owes $75 (her share), net: +$75
            // - Bob paid $0, owes $75 (his share), net: -$75
            // So Bob owes Alice $75

            const bobOwes = balances.userBalances[users[1].uid]?.netBalance;
            const aliceOwed = balances.userBalances[users[0].uid]?.netBalance;

            // This is the core assertion - if this fails, we've found the bug
            expect(bobOwes).toBe(-75); // Bob owes $75
            expect(aliceOwed).toBe(75); // Alice is owed $75

            // Check simplified debts
            expect(balances.simplifiedDebts).toHaveLength(1);
            expect(balances.simplifiedDebts[0].amount).toBe(75); // $75 debt
        });
    });

    describe('Settlement Management Operations', () => {
        let testGroup: any;
        let settlementUsers: UserToken[];

        beforeEach(async () => {
            settlementUsers = users.slice(0, 2);
            testGroup = await TestGroupManager.getOrCreateGroup(settlementUsers, { memberCount: 2, fresh: true });
        });

        describe('Settlement Creation', () => {
            test('should create a new settlement', async () => {
                const settlementData = new SettlementBuilder()
                    .withGroupId(testGroup.id)
                    .withPayer(settlementUsers[0].uid)
                    .withPayee(settlementUsers[1].uid)
                    .withAmount(75.5)
                    .withNote('Test settlement payment')
                    .build();

                const createdSettlement = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                expect(createdSettlement.id).toBeDefined();
                expect(createdSettlement.groupId).toBe(testGroup.id);
                expect(createdSettlement.amount).toBe(75.5);
                expect(createdSettlement.note).toBe('Test settlement payment');
            });

            test('should create a settlement without optional fields', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).withAmount(25.0).build();

                const createdSettlement = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                expect(createdSettlement.id).toBeDefined();
                expect(createdSettlement.amount).toBe(25.0);
            });

            test('should reject settlement with invalid group', async () => {
                const settlementData = new SettlementBuilder().withGroupId('invalid-group-id').withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

                await expect(apiDriver.createSettlement(settlementData, settlementUsers[0].token)).rejects.toThrow(/status 404.*GROUP_NOT_FOUND/);
            });

            test('should reject settlement between non-group-members', async () => {
                const outsiderUser = users[2]; // Get a third user from pool

                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(outsiderUser.uid).build();

                await expect(apiDriver.createSettlement(settlementData, settlementUsers[0].token)).rejects.toThrow(/status 400.*USER_NOT_IN_GROUP/);
            });

            test('should validate required fields', async () => {
                const invalidData = {};

                await expect(apiDriver.createSettlement(invalidData, settlementUsers[0].token)).rejects.toThrow(/VALIDATION_ERROR|validation|required/);
            });

            test('should validate positive amounts', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).withAmount(-50).build();

                await expect(apiDriver.createSettlement(settlementData, settlementUsers[0].token)).rejects.toThrow(/status 400.*VALIDATION_ERROR/);
            });
        });

        describe('Settlement Retrieval', () => {
            test('should retrieve a settlement by ID', async () => {
                const settlementData = new SettlementBuilder()
                    .withGroupId(testGroup.id)
                    .withPayer(settlementUsers[0].uid)
                    .withPayee(settlementUsers[1].uid)
                    .withAmount(100.0)
                    .withNote('Retrieve test')
                    .build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);
                const retrieved = await apiDriver.getSettlement(testGroup.id, created.id, settlementUsers[0].token);

                expect(retrieved.id).toBe(created.id);
                expect(retrieved.amount).toBe(100.0);
                expect(retrieved.note).toBe('Retrieve test');
                expect(retrieved.payer).toBeDefined();
                expect(retrieved.payee).toBeDefined();
                expect(retrieved.payer.uid).toBe(settlementUsers[0].uid);
                expect(retrieved.payee.uid).toBe(settlementUsers[1].uid);
            });

            test('should reject retrieval by non-group-member', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);
                const outsiderUser = users[2]; // Get a third user from pool

                await expect(apiDriver.getSettlement(testGroup.id, created.id, outsiderUser.token)).rejects.toThrow(/status 403.*NOT_GROUP_MEMBER/);
            });

            test('should handle non-existent settlement', async () => {
                await expect(apiDriver.getSettlement(testGroup.id, 'non-existent-id', settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
            });
        });

        describe('Settlement Updates', () => {
            test('should update settlement fields', async () => {
                const settlementData = new SettlementBuilder()
                    .withGroupId(testGroup.id)
                    .withPayer(settlementUsers[0].uid)
                    .withPayee(settlementUsers[1].uid)
                    .withAmount(50.0)
                    .withNote('Original note')
                    .build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                const updateData = {
                    amount: 75.25,
                    note: 'Updated note',
                };

                const updated = await apiDriver.updateSettlement(created.id, updateData, settlementUsers[0].token);

                expect(updated.amount).toBe(75.25);
                expect(updated.note).toBe('Updated note');
            });

            test('should reject update by non-creator', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                await expect(apiDriver.updateSettlement(created.id, { amount: 100 }, settlementUsers[1].token)).rejects.toThrow(/status 403.*NOT_SETTLEMENT_CREATOR/);
            });

            test('should validate update data', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                await expect(apiDriver.updateSettlement(created.id, { amount: -100 }, settlementUsers[0].token)).rejects.toThrow(/status 400.*VALIDATION_ERROR/);
            });
        });

        describe('Settlement Deletion', () => {
            test('should delete a settlement', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);
                await apiDriver.deleteSettlement(created.id, settlementUsers[0].token);

                await expect(apiDriver.getSettlement(testGroup.id, created.id, settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
            });

            test('should reject deletion by non-creator', async () => {
                const settlementData = new SettlementBuilder().withGroupId(testGroup.id).withPayer(settlementUsers[0].uid).withPayee(settlementUsers[1].uid).build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                await expect(apiDriver.deleteSettlement(created.id, settlementUsers[1].token)).rejects.toThrow(/status 403.*NOT_SETTLEMENT_CREATOR/);
            });

            test('should handle deletion of non-existent settlement', async () => {
                await expect(apiDriver.deleteSettlement('non-existent-id', settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
            });
        });

        describe('Settlement Listing', () => {
            test('should list settlements for a group', async () => {
                const uniqueId = generateShortId();
                await Promise.all([
                    apiDriver.createSettlement(
                        new SettlementBuilder()
                            .withGroupId(testGroup.id)
                            .withPayer(settlementUsers[0].uid)
                            .withPayee(settlementUsers[1].uid)
                            .withAmount(50)
                            .withNote(`First settlement ${uniqueId}`)
                            .build(),
                        settlementUsers[0].token,
                    ),
                    apiDriver.createSettlement(
                        new SettlementBuilder()
                            .withGroupId(testGroup.id)
                            .withPayer(settlementUsers[1].uid)
                            .withPayee(settlementUsers[0].uid)
                            .withAmount(25)
                            .withNote(`Second settlement ${uniqueId}`)
                            .build(),
                        settlementUsers[1].token,
                    ),
                ]);

                const response = await apiDriver.listSettlements(settlementUsers[0].token, { groupId: testGroup.id });

                expect(response.settlements).toBeDefined();
                expect(Array.isArray(response.settlements)).toBe(true);

                // Filter to only our settlements from this test
                const ourSettlements = response.settlements.filter((s: any) => s.note?.includes(uniqueId));
                expect(ourSettlements).toHaveLength(2);

                const notes = ourSettlements.map((s: any) => s.note);
                expect(notes).toContain(`First settlement ${uniqueId}`);
                expect(notes).toContain(`Second settlement ${uniqueId}`);
            });

            test('should support pagination', async () => {
                const uniqueId = generateShortId();
                const settlements = [];
                for (let i = 0; i < 5; i++) {
                    settlements.push(
                        apiDriver.createSettlement(
                            new SettlementBuilder()
                                .withGroupId(testGroup.id)
                                .withPayer(settlementUsers[0].uid)
                                .withPayee(settlementUsers[1].uid)
                                .withAmount(10 * (i + 1))
                                .withNote(`Pagination Settlement ${i + 1} ${uniqueId}`)
                                .build(),
                            settlementUsers[0].token,
                        ),
                    );
                }
                await Promise.all(settlements);

                // Get initial count to understand existing data
                const allSettlements = await apiDriver.listSettlements(settlementUsers[0].token, {
                    groupId: testGroup.id,
                    limit: 100, // Get all
                });

                const ourSettlements = allSettlements.settlements.filter((s: any) => s.note?.includes(uniqueId));
                expect(ourSettlements).toHaveLength(5); // Verify our 5 settlements were created

                // Test pagination functionality - with shared groups, we need to use a larger limit to ensure we get our data
                const firstPage = await apiDriver.listSettlements(settlementUsers[0].token, {
                    groupId: testGroup.id,
                    limit: 3,
                });

                expect(firstPage.settlements.length).toBeGreaterThanOrEqual(3);
                expect(firstPage.hasMore).toBe(true);
                expect(firstPage.nextCursor).toBeDefined();

                const secondPage = await apiDriver.listSettlements(settlementUsers[0].token, {
                    groupId: testGroup.id,
                    limit: 3,
                    cursor: firstPage.nextCursor,
                });

                expect(secondPage.settlements.length).toBeGreaterThanOrEqual(2);
                // Note: hasMore may be true if there are other settlements from previous tests
            });
        });
    });

    describe('Advanced Settlement Scenarios', () => {
        test('should handle partial settlement scenarios correctly', async () => {
            // Test partial settlements: multiple settlements to cover a debt
            const groupData = new CreateGroupRequestBuilder().withName('Partial Settlement Group').withDescription('Testing partial payment scenarios').build();
            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Add Bob to group
            const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Alice pays €200 expense, split equally - Bob owes Alice €100
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Large Expense')
                .withAmount(200)
                .withCurrency('EUR')
                .withPaidBy(users[0].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();
            await apiDriver.createExpense(expenseData, users[0].token);

            // Verify initial debt: Bob owes Alice $100
            const initialBalances = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(initialBalances.simplifiedDebts).toHaveLength(1);
            expect(initialBalances.simplifiedDebts[0].amount).toBe(100);
            expect(initialBalances.simplifiedDebts[0].from.userId).toBe(users[1].uid);
            expect(initialBalances.simplifiedDebts[0].to.userId).toBe(users[0].uid);

            // Partial settlement 1: Bob pays Alice €40 (40% of debt)
            const partialSettlement1 = new SettlementBuilder()
                .withGroupId(group.id)
                .withPayer(users[1].uid)
                .withPayee(users[0].uid)
                .withAmount(40)
                .withCurrency('EUR')
                .withNote('Partial payment 1 of 3')
                .build();
            await apiDriver.createSettlement(partialSettlement1, users[1].token);

            // Check remaining debt: should be $60
            const balancesAfter1 = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(balancesAfter1.simplifiedDebts).toHaveLength(1);
            expect(balancesAfter1.simplifiedDebts[0].amount).toBe(60);
            expect(balancesAfter1.userBalances[users[1].uid].netBalance).toBe(-60);
            expect(balancesAfter1.userBalances[users[0].uid].netBalance).toBe(60);

            // Partial settlement 2: Bob pays Alice €35 (partial)
            const partialSettlement2 = new SettlementBuilder()
                .withGroupId(group.id)
                .withPayer(users[1].uid)
                .withPayee(users[0].uid)
                .withAmount(35)
                .withCurrency('EUR')
                .withNote('Partial payment 2 of 3')
                .build();
            await apiDriver.createSettlement(partialSettlement2, users[1].token);

            // Check remaining debt: should be $25
            const balancesAfter2 = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(balancesAfter2.simplifiedDebts).toHaveLength(1);
            expect(balancesAfter2.simplifiedDebts[0].amount).toBe(25);
            expect(balancesAfter2.userBalances[users[1].uid].netBalance).toBe(-25);
            expect(balancesAfter2.userBalances[users[0].uid].netBalance).toBe(25);

            // Final settlement: Bob pays remaining €25
            const finalSettlement = new SettlementBuilder()
                .withGroupId(group.id)
                .withPayer(users[1].uid)
                .withPayee(users[0].uid)
                .withAmount(25)
                .withCurrency('EUR')
                .withNote('Final settlement payment')
                .build();
            await apiDriver.createSettlement(finalSettlement, users[1].token);

            // Check final balance: should be fully settled
            const finalBalances = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(finalBalances.simplifiedDebts).toHaveLength(0);
            expect(finalBalances.userBalances[users[1].uid].netBalance).toBe(0);
            expect(finalBalances.userBalances[users[0].uid].netBalance).toBe(0);

            // Group should show "All settled up"
            const { balances: groupFinalBalances } = await apiDriver.getGroupFullDetails(group.id, users[0].token);
            // Check that all users have zero net balance (settled up)
            if (Object.keys(groupFinalBalances.balancesByCurrency).length > 0) {
                const currency = Object.keys(groupFinalBalances.balancesByCurrency)[0];
                const userBalances = Object.values(groupFinalBalances.balancesByCurrency[currency]);
                userBalances.forEach((balance: any) => {
                    expect(balance.netBalance).toBe(0);
                });
            }
        });

        test('should handle overpayment scenarios correctly', async () => {
            // Test overpayment: settlement amount exceeding the debt
            const groupData = new CreateGroupRequestBuilder().withName('Overpayment Test Group').withDescription('Testing overpayment scenarios').build();
            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Add Bob to group
            const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Alice pays $120 expense, split equally - Bob owes Alice $60
            const expenseData = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('Shared Expense')
                .withAmount(120)
                .withCurrency('EUR')
                .withPaidBy(users[0].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();
            await apiDriver.createExpense(expenseData, users[0].token);

            // Verify debt: Bob owes Alice $60
            const initialBalances = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(initialBalances.simplifiedDebts[0].amount).toBe(60);
            expect(initialBalances.simplifiedDebts[0].from.userId).toBe(users[1].uid);

            // Overpayment: Bob pays Alice €100 (exceeds €60 debt)
            const overpayment = new SettlementBuilder()
                .withGroupId(group.id)
                .withPayer(users[1].uid)
                .withPayee(users[0].uid)
                .withAmount(100)
                .withCurrency('EUR')
                .withNote('Overpayment settlement')
                .build();
            await apiDriver.createSettlement(overpayment, users[1].token);

            // Check result: Alice should now owe Bob $40 (overpayment of $40)
            const finalBalances = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(finalBalances.simplifiedDebts).toHaveLength(1);
            expect(finalBalances.simplifiedDebts[0].amount).toBe(40);
            expect(finalBalances.simplifiedDebts[0].from.userId).toBe(users[0].uid);
            expect(finalBalances.simplifiedDebts[0].to.userId).toBe(users[1].uid);

            // Verify net balances are correct
            expect(finalBalances.userBalances[users[0].uid].netBalance).toBe(-40); // Alice owes
            expect(finalBalances.userBalances[users[1].uid].netBalance).toBe(40); // Bob is owed
        });

        test('should handle mixed currency partial settlements', async () => {
            // Test partial settlements across different currencies
            const groupData = new CreateGroupRequestBuilder().withName('Mixed Currency Settlement').withDescription('Testing cross-currency partial settlements').build();
            const group = await apiDriver.createGroup(groupData, users[0].token);

            // Add Bob to group
            const shareLink = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Alice pays $200 USD expense, split equally - Bob owes Alice $100 USD
            const usdExpense = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('USD Expense')
                .withAmount(200)
                .withCurrency('USD')
                .withPaidBy(users[0].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();
            await apiDriver.createExpense(usdExpense, users[0].token);

            // Bob pays €150 EUR expense, split equally - Alice owes Bob €75 EUR
            const eurExpense = new CreateExpenseRequestBuilder()
                .withGroupId(group.id)
                .withDescription('EUR Expense')
                .withAmount(150)
                .withCurrency('EUR')
                .withPaidBy(users[1].uid)
                .withSplitType('equal')
                .withParticipants([users[0].uid, users[1].uid])
                .build();
            await apiDriver.createExpense(eurExpense, users[1].token);

            // Initial state: Bob owes Alice $100 USD, Alice owes Bob €75 EUR
            const initialBalances = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(initialBalances.simplifiedDebts).toHaveLength(2); // One for each currency

            const eurDebt = initialBalances.simplifiedDebts.find((d) => d.currency === 'EUR');
            const usdDebt = initialBalances.simplifiedDebts.find((d) => d.currency === 'USD');

            expect(usdDebt?.from.userId).toBe(users[1].uid);
            expect(usdDebt?.amount).toBe(100);
            expect(eurDebt?.from.userId).toBe(users[0].uid);
            expect(eurDebt?.amount).toBe(75);

            // Partial settlement in USD: Bob pays Alice $60 USD
            const usdSettlement = new SettlementBuilder()
                .withGroupId(group.id)
                .withPayer(users[1].uid)
                .withPayee(users[0].uid)
                .withAmount(60)
                .withCurrency('USD')
                .withNote('Partial USD settlement')
                .build();
            await apiDriver.createSettlement(usdSettlement, users[1].token);

            // Check state: Bob should still owe Alice $40 USD, EUR debt unchanged
            const midBalances = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(midBalances.simplifiedDebts).toHaveLength(2);

            const midEurDebt = midBalances.simplifiedDebts.find((d) => d.currency === 'EUR');
            const midUsdDebt = midBalances.simplifiedDebts.find((d) => d.currency === 'USD');

            expect(midUsdDebt?.amount).toBe(40); // Reduced from $100 to $40
            expect(midEurDebt?.amount).toBe(75); // Unchanged EUR debt

            // Partial settlement in EUR: Alice pays Bob €50 EUR
            const eurSettlement = new SettlementBuilder()
                .withGroupId(group.id)
                .withPayer(users[0].uid)
                .withPayee(users[1].uid)
                .withAmount(50)
                .withCurrency('EUR')
                .withNote('Partial EUR settlement')
                .build();
            await apiDriver.createSettlement(eurSettlement, users[0].token);

            // Final check: Bob owes Alice $40 USD, Alice owes Bob €25 EUR
            const finalBalances = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(finalBalances.simplifiedDebts).toHaveLength(2);

            const finalUsdDebt = finalBalances.simplifiedDebts.find((d) => d.currency === 'USD');
            const finalEurDebt = finalBalances.simplifiedDebts.find((d) => d.currency === 'EUR');

            expect(finalUsdDebt?.amount).toBe(40); // USD debt unchanged
            expect(finalEurDebt?.amount).toBe(25); // EUR debt reduced from €75 to €25
        });
    });
});
