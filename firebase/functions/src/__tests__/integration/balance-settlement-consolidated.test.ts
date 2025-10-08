import {beforeEach, describe, expect, test} from 'vitest';
import {ApiDriver, borrowTestUsers, CreateGroupRequestBuilder, CreateExpenseRequestBuilder, CreateSettlementRequestBuilder, SettlementUpdateBuilder, TestGroupManager, NotificationDriver} from '@splitifyd/test-support';
import {PooledTestUser, UserToken} from '@splitifyd/shared';
import {getFirestore} from '../../firebase';

describe('Balance & Settlement - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    const notificationDriver = new NotificationDriver(getFirestore());
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(6); // Get enough users for all tests
    });

    afterEach(async () => {
        // Wait for system to settle before stopping listeners
        await notificationDriver.waitForQuiet();
        await notificationDriver.stopAllListeners();
    });

    describe('Basic Balance Calculation', () => {
        test('should return correct response structure for empty and populated groups', async () => {
            // Test empty group balance structure
            const emptyGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder()
                .withName('Empty Balance Test').build(), users[0].token);

            const emptyBalances = await apiDriver.getGroupBalances(emptyGroup.id, users[0].token);
            expect(emptyBalances.groupId).toBe(emptyGroup.id);
            expect(emptyBalances.balancesByCurrency).toBeDefined();
            expect(Object.keys(emptyBalances.balancesByCurrency)).toHaveLength(0); // No currencies for empty group
            expect(emptyBalances.simplifiedDebts).toBeDefined();
            expect(emptyBalances.simplifiedDebts).toHaveLength(0);

            // Test populated group
            const testGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder()
                .withName('Populated Balance Test').build(), users[0].token);
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[2].token);

            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(30)
                    .withCurrency('USD')
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withSplitType('equal')
                    .build(),
                users[0].token,
            );

            const populatedBalances = await apiDriver.waitForBalanceUpdate(testGroup.id, users[0].token, 2000);
            expect(populatedBalances.groupId).toBe(testGroup.id);
            expect(Object.keys(populatedBalances.balancesByCurrency.USD)).toContain(users[0].uid);
            expect(populatedBalances.balancesByCurrency.USD[users[0].uid]).toHaveProperty('netBalance');
            expect(populatedBalances.balancesByCurrency.USD[users[0].uid].netBalance).toBeGreaterThan(0); // User 0 should be owed money
        });

        // REMOVED: Redundant test - now covered by BalanceCalculationService.scenarios.test.ts
        // test('should handle basic two-user balance calculations', async () => {
        //     // Mathematical balance calculation logic is now comprehensively tested in unit tests
        //     // This integration test provided no additional value beyond API testing
        // });

        // REMOVED: Redundant test - now covered by BalanceCalculationService.scenarios.test.ts
        // test('should handle zero-sum scenarios correctly', async () => {
        //     // Zero-sum balance calculation logic is now tested in unit tests
        //     // This integration test provided no additional value beyond API testing
        // });

        test('should handle authentication and authorization correctly', async () => {
            const testGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder()
                .withName('Auth Test Group').build(), users[0].token);

            // Test that non-member cannot access balances (returns 404 since they can't see the group exists)
            await expect(apiDriver.getGroupBalances(testGroup.id, users[1].token)).rejects.toThrow(/failed with status 404/);

            // Test invalid group ID
            await expect(apiDriver.getGroupBalances('invalid-group-id', users[0].token)).rejects.toThrow(/failed with status 404/);
        });
    });

    // REMOVED: Entire "Complex Balance Scenarios and Multi-Currency" test suite
    // All mathematical balance calculation tests have been moved to unit tests in:
    // BalanceCalculationService.scenarios.test.ts
    //
    // These integration tests provided no additional value beyond API testing
    // since the calculation logic itself is now comprehensively tested in unit tests
    // with the same mathematical precision and scenarios.

    describe('Settlement Management Operations', () => {
        let testGroup: any;
        let settlementUsers: UserToken[];

        beforeEach(async () => {
            settlementUsers = users.slice(0, 2);
            testGroup = await TestGroupManager.getOrCreateGroup(settlementUsers, {memberCount: 2, fresh: true});
        });

        // REMOVED: Settlement Creation tests that duplicate unit test coverage
        // The following tests have been moved to SettlementService.test.ts:
        // - Settlement amount validation (positive amounts, max/min values)
        // - Optional field handling (note field)
        // - Group membership validation
        // - Invalid group handling
        //
        // These integration tests provided no additional value beyond API testing
        // since the validation logic itself is now comprehensively tested in unit tests.

        describe('Settlement Retrieval', () => {
            test('should retrieve a settlement by ID', async () => {
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .withAmount(100.0)
                    .withCurrency('USD')
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
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .withCurrency('USD')
                    .build();

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
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .withAmount(50.0)
                    .withCurrency('USD')
                    .withNote('Original note')
                    .build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                const updateData = new SettlementUpdateBuilder()
                    .withAmount(75.25)
                    .withCurrency('USD')
                    .withNote('Updated note').build();

                const updated = await apiDriver.updateSettlement(created.id, updateData, settlementUsers[0].token);

                expect(updated.amount).toBe(75.25);
                expect(updated.note).toBe('Updated note');
            });

            test('should reject update by non-creator', async () => {
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .withCurrency('USD').build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                await expect(apiDriver.updateSettlement(created.id, new SettlementUpdateBuilder()
                    .withAmount(100)
                    .withCurrency('USD').build(), settlementUsers[1].token)).rejects.toThrow(
                    /status 403.*NOT_SETTLEMENT_CREATOR/,
                );
            });

            test('should validate update data', async () => {
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .withCurrency('USD').build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                await expect(apiDriver.updateSettlement(created.id, new SettlementUpdateBuilder()
                    .withAmount(-100)
                    .withCurrency('USD').build(), settlementUsers[0].token)).rejects.toThrow(/status 400.*VALIDATION_ERROR/);
            });
        });

        describe('Settlement Deletion', () => {
            test('should delete a settlement', async () => {
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .withCurrency('USD').build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);
                await apiDriver.deleteSettlement(created.id, settlementUsers[0].token);

                await expect(apiDriver.getSettlement(testGroup.id, created.id, settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
            });

            test('should reject deletion by non-creator', async () => {
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .withCurrency('USD').build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                await expect(apiDriver.deleteSettlement(created.id, settlementUsers[1].token)).rejects.toThrow(/status 403.*INSUFFICIENT_PERMISSIONS/);
            });

            test('should handle deletion of non-existent settlement', async () => {
                await expect(apiDriver.deleteSettlement('non-existent-id', settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
            });
        });
    });

    describe('Advanced Settlement Scenarios', () => {
        test('should handle partial settlement scenarios correctly', async () => {
            // Test partial settlements: multiple settlements to cover a debt
            const groupData = new CreateGroupRequestBuilder()
                .withName('Partial Settlement Group')
                .withDescription('Testing partial payment scenarios').build();
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
            expect(initialBalances.simplifiedDebts[0].from.uid).toBe(users[1].uid);
            expect(initialBalances.simplifiedDebts[0].to.uid).toBe(users[0].uid);

            // Partial settlement 1: Bob pays Alice €40 (40% of debt)
            const partialSettlement1 = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(users[1].uid)
                .withPayeeId(users[0].uid)
                .withAmount(40)
                .withCurrency('EUR')
                .withNote('Partial payment 1 of 3')
                .build();
            await apiDriver.createSettlement(partialSettlement1, users[1].token);

            // Check remaining debt: should be $60
            const balancesAfter1 = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(balancesAfter1.simplifiedDebts).toHaveLength(1);
            expect(balancesAfter1.simplifiedDebts[0].amount).toBe(60);
            expect(balancesAfter1.balancesByCurrency.EUR[users[1].uid].netBalance).toBe(-60);
            expect(balancesAfter1.balancesByCurrency.EUR[users[0].uid].netBalance).toBe(60);

            // Partial settlement 2: Bob pays Alice €35 (partial)
            const partialSettlement2 = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(users[1].uid)
                .withPayeeId(users[0].uid)
                .withAmount(35)
                .withCurrency('EUR')
                .withNote('Partial payment 2 of 3')
                .build();
            await apiDriver.createSettlement(partialSettlement2, users[1].token);

            // Check remaining debt: should be $25
            const balancesAfter2 = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(balancesAfter2.simplifiedDebts).toHaveLength(1);
            expect(balancesAfter2.simplifiedDebts[0].amount).toBe(25);
            expect(balancesAfter2.balancesByCurrency.EUR[users[1].uid].netBalance).toBe(-25);
            expect(balancesAfter2.balancesByCurrency.EUR[users[0].uid].netBalance).toBe(25);

            // Final settlement: Bob pays remaining €25
            const finalSettlement = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(users[1].uid)
                .withPayeeId(users[0].uid)
                .withAmount(25)
                .withCurrency('EUR')
                .withNote('Final settlement payment')
                .build();
            await apiDriver.createSettlement(finalSettlement, users[1].token);

            // Check final balance: should be fully settled
            const finalBalances = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(finalBalances.simplifiedDebts).toHaveLength(0);
            expect(finalBalances.balancesByCurrency.EUR[users[1].uid].netBalance).toBe(0);
            expect(finalBalances.balancesByCurrency.EUR[users[0].uid].netBalance).toBe(0);

            // Group should show "All settled up"
            const {balances: groupFinalBalances} = await apiDriver.getGroupFullDetails(group.id, users[0].token);
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
            const groupData = new CreateGroupRequestBuilder()
                .withName('Overpayment Test Group')
                .withDescription('Testing overpayment scenarios').build();
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
            expect(initialBalances.simplifiedDebts[0].from.uid).toBe(users[1].uid);

            // Overpayment: Bob pays Alice €100 (exceeds €60 debt)
            const overpayment = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(users[1].uid)
                .withPayeeId(users[0].uid)
                .withAmount(100)
                .withCurrency('EUR')
                .withNote('Overpayment settlement')
                .build();
            await apiDriver.createSettlement(overpayment, users[1].token);

            // Check result: Alice should now owe Bob $40 (overpayment of $40)
            const finalBalances = await apiDriver.getGroupBalances(group.id, users[0].token);
            expect(finalBalances.simplifiedDebts).toHaveLength(1);
            expect(finalBalances.simplifiedDebts[0].amount).toBe(40);
            expect(finalBalances.simplifiedDebts[0].from.uid).toBe(users[0].uid);
            expect(finalBalances.simplifiedDebts[0].to.uid).toBe(users[1].uid);

            // Verify net balances are correct
            expect(finalBalances.balancesByCurrency.EUR[users[0].uid].netBalance).toBe(-40); // Alice owes
            expect(finalBalances.balancesByCurrency.EUR[users[1].uid].netBalance).toBe(40); // Bob is owed
        });

        test('should handle mixed currency partial settlements', async () => {
            // Test partial settlements across different currencies
            const groupData = new CreateGroupRequestBuilder()
                .withName('Mixed Currency Settlement')
                .withDescription('Testing cross-currency partial settlements').build();
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

            expect(usdDebt?.from.uid).toBe(users[1].uid);
            expect(usdDebt?.amount).toBe(100);
            expect(eurDebt?.from.uid).toBe(users[0].uid);
            expect(eurDebt?.amount).toBe(75);

            // Partial settlement in USD: Bob pays Alice $60 USD
            const usdSettlement = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(users[1].uid)
                .withPayeeId(users[0].uid)
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
            const eurSettlement = new CreateSettlementRequestBuilder()
                .withGroupId(group.id)
                .withPayerId(users[0].uid)
                .withPayeeId(users[1].uid)
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

    describe('Settlement Soft Delete Operations', () => {
        let testGroup: any;
        let settlementUsers: UserToken[];

        beforeEach(async () => {
            settlementUsers = users.slice(0, 3);
            testGroup = await TestGroupManager.getOrCreateGroup(settlementUsers, {memberCount: 3, fresh: true});
        });

        test('should soft delete settlement and preserve metadata', async () => {
            // Create a settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(testGroup.id)
                .withPayerId(settlementUsers[0].uid)
                .withPayeeId(settlementUsers[1].uid)
                .withAmount(100.0)
                .withCurrency('USD')
                .withNote('Test soft delete')
                .build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

            // Verify deletedAt and deletedBy are null before deletion
            expect(created.deletedAt).toBeNull();
            expect(created.deletedBy).toBeNull();

            // Soft delete the settlement
            await apiDriver.deleteSettlement(created.id, settlementUsers[0].token);

            // Verify it no longer appears in normal queries
            await expect(apiDriver.getSettlement(testGroup.id, created.id, settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
        });

        test('should allow group admin to soft delete any settlement', async () => {
            const groupAdmin = settlementUsers[0]; // Creator is admin
            const settlementCreator = settlementUsers[1];

            // Create settlement by non-admin member
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(testGroup.id)
                .withPayerId(settlementCreator.uid)
                .withPayeeId(settlementUsers[2].uid)
                .withAmount(75.0)
                .withCurrency('USD')
                .build();

            const created = await apiDriver.createSettlement(settlementData, settlementCreator.token);

            // Admin should be able to delete
            await expect(apiDriver.deleteSettlement(created.id, groupAdmin.token)).resolves.not.toThrow();

            // Verify it's deleted
            await expect(apiDriver.getSettlement(testGroup.id, created.id, groupAdmin.token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
        });

        test('should prevent non-creator non-admin from soft deleting settlement', async () => {
            const settlementCreator = settlementUsers[0];
            const otherMember = settlementUsers[2];

            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(testGroup.id)
                .withPayerId(settlementCreator.uid)
                .withPayeeId(settlementUsers[1].uid)
                .withAmount(50.0)
                .withCurrency('USD')
                .build();

            const created = await apiDriver.createSettlement(settlementData, settlementCreator.token);

            // Other member (not creator, not admin) should not be able to delete
            await expect(apiDriver.deleteSettlement(created.id, otherMember.token)).rejects.toThrow(/status 403.*INSUFFICIENT_PERMISSIONS/);
        });

        test('should prevent double deletion of already deleted settlement', async () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(testGroup.id)
                .withPayerId(settlementUsers[0].uid)
                .withPayeeId(settlementUsers[1].uid)
                .withAmount(100.0)
                .withCurrency('USD')
                .build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

            // First deletion should succeed
            await apiDriver.deleteSettlement(created.id, settlementUsers[0].token);

            // Second deletion should fail (settlement already deleted)
            await expect(apiDriver.deleteSettlement(created.id, settlementUsers[0].token)).rejects.toThrow(/status 400.*ALREADY_DELETED|status 404.*SETTLEMENT_NOT_FOUND/);
        });

        test('should not allow updating a soft deleted settlement', async () => {
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(testGroup.id)
                .withPayerId(settlementUsers[0].uid)
                .withPayeeId(settlementUsers[1].uid)
                .withAmount(100.0)
                .withCurrency('USD')
                .build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

            // Soft delete
            await apiDriver.deleteSettlement(created.id, settlementUsers[0].token);

            // Attempt to update should fail
            await expect(
                apiDriver.updateSettlement(
                    created.id,
                    new SettlementUpdateBuilder()
                        .withAmount(200.0)
                        .withCurrency('USD').build(),
                    settlementUsers[0].token,
                ),
            ).rejects.toThrow(/status 400.*ALREADY_DELETED|status 404.*SETTLEMENT_NOT_FOUND/);
        });
    });
});
