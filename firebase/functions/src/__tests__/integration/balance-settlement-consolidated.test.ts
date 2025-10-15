import { PooledTestUser, UserToken } from '@splitifyd/shared';
import {
    ApiDriver,
    borrowTestUsers,
    CreateExpenseRequestBuilder,
    CreateGroupRequestBuilder,
    CreateSettlementRequestBuilder,
    NotificationDriver,
    SettlementUpdateBuilder,
    TestGroupManager,
} from '@splitifyd/test-support';
import { beforeEach, describe, expect, test } from 'vitest';
import { getFirestore } from '../../firebase';

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
            const emptyGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Empty Balance Test')
                    .build(),
                users[0].token,
            );

            const emptyBalances = await apiDriver.getGroupBalances(emptyGroup.id, users[0].token);
            expect(emptyBalances.groupId).toBe(emptyGroup.id);
            expect(emptyBalances.balancesByCurrency).toBeDefined();
            expect(Object.keys(emptyBalances.balancesByCurrency)).toHaveLength(0); // No currencies for empty group
            expect(emptyBalances.simplifiedDebts).toBeDefined();
            expect(emptyBalances.simplifiedDebts).toHaveLength(0);

            // Test populated group
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Populated Balance Test')
                    .build(),
                users[0].token,
            );
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
            expect(parseFloat(populatedBalances.balancesByCurrency.USD[users[0].uid].netBalance)).toBeGreaterThan(0); // User 0 should be owed money
        });

        test('should handle authentication and authorization correctly', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Auth Test Group')
                    .build(),
                users[0].token,
            );

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
            testGroup = await TestGroupManager.getOrCreateGroup(settlementUsers, { memberCount: 2, fresh: true });
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
                expect(retrieved.amount).toBe("100");
                expect(retrieved.currency).toBe('USD');
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
                    .withCurrency('EUR')
                    .withNote('Updated note')
                    .build();

                const updated = await apiDriver.updateSettlement(created.id, updateData, settlementUsers[0].token);

                expect(updated.amount).toBe("75.25");
                expect(updated.currency).toBe('EUR');
                expect(updated.note).toBe('Updated note');
            });

            test('should reject update by non-creator', async () => {
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .withCurrency('USD')
                    .withAmount(1)
                    .build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                await expect(apiDriver.updateSettlement(
                    created.id,
                    new SettlementUpdateBuilder()
                        .withAmount(100)
                        .withCurrency('USD')
                        .build(),
                    settlementUsers[1].token,
                ))
                    .rejects
                    .toThrow(
                        /status 403.*NOT_SETTLEMENT_CREATOR/,
                    );
            });

            test('should validate update data', async () => {
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .withAmount(1)
                    .withCurrency('USD')
                    .build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                await expect(apiDriver.updateSettlement(
                    created.id,
                    new SettlementUpdateBuilder()
                        .withAmount(-100)
                        .withCurrency('USD')
                        .build(),
                    settlementUsers[0].token,
                ))
                    .rejects
                    .toThrow(
                        /status 400.*VALIDATION_ERROR/,
                    );
            });

            // REMOVED: "should update balances correctly when settlement currency is changed"
            // This test has been migrated to unit tests in:
            // firebase/functions/src/__tests__/unit/services/IncrementalBalanceService.scenarios.test.ts
            //
            // The integration test provided no additional value beyond API testing since the
            // calculation logic itself is now comprehensively tested in the unit test with
            // the same mathematical precision. The unit test is 1000-2000x faster.
        });

        describe('Settlement Deletion', () => {
            test('should delete a settlement', async () => {
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);
                await apiDriver.deleteSettlement(created.id, settlementUsers[0].token);

                await expect(apiDriver.getSettlement(testGroup.id, created.id, settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
            });

            test('should reject deletion by non-creator', async () => {
                const settlementData = new CreateSettlementRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPayerId(settlementUsers[0].uid)
                    .withPayeeId(settlementUsers[1].uid)
                    .build();

                const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

                await expect(apiDriver.deleteSettlement(created.id, settlementUsers[1].token)).rejects.toThrow(/status 403.*INSUFFICIENT_PERMISSIONS/);
            });

            test('should handle deletion of non-existent settlement', async () => {
                await expect(apiDriver.deleteSettlement('non-existent-id', settlementUsers[0].token)).rejects.toThrow(/status 404.*SETTLEMENT_NOT_FOUND/);
            });
        });

        describe('Settlement Access After Member Departure', () => {
            test('should view settlements after a member leaves the group', async () => {
                // Setup: Create group with 2 members
                const testUsers = users.slice(0, 2);
                const group = await TestGroupManager.getOrCreateGroup(testUsers, {
                    memberCount: 2,
                    fresh: true,
                });

                // Create expense where user 0 pays
                await apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withAmount(60)
                        .withCurrency('JPY')
                        .withPaidBy(testUsers[0].uid)
                        .withParticipants([testUsers[0].uid, testUsers[1].uid])
                        .withSplitType('equal')
                        .build(),
                    testUsers[0].token,
                );

                // Wait for balance to update
                await apiDriver.waitForBalanceUpdate(group.id, testUsers[0].token, 3000);

                // User 1 creates settlement to pay back user 0
                await apiDriver.createSettlement(
                    new CreateSettlementRequestBuilder()
                        .withGroupId(group.id)
                        .withPayerId(testUsers[1].uid) // User 1 pays
                        .withPayeeId(testUsers[0].uid) // User 0 receives
                        .withAmount(30)
                        .withCurrency('JPY')
                        .build(),
                    testUsers[1].token,
                );

                // User 1 leaves the group
                await apiDriver.leaveGroup(group.id, testUsers[1].token);

                const fullDetails = await apiDriver.getGroupFullDetails(group.id, testUsers[0].token);

                // Assertions: Should successfully fetch group details with settlements
                expect(fullDetails).toBeDefined();
                expect(fullDetails.group).toBeDefined();
                expect(fullDetails.settlements.settlements).toHaveLength(1);

                // Settlement should have payer info even though they left
                const settlement = fullDetails.settlements.settlements[0];
                expect(settlement.payer.uid).toBe(testUsers[1].uid);
                expect(settlement.payee.uid).toBe(testUsers[0].uid);
            });
        });
    });

    describe('Settlement Soft Delete Operations', () => {
        let testGroup: any;
        let settlementUsers: UserToken[];

        beforeEach(async () => {
            settlementUsers = users.slice(0, 3);
            testGroup = await TestGroupManager.getOrCreateGroup(settlementUsers, { memberCount: 3, fresh: true });
        });

        test('should soft delete settlement and preserve metadata', async () => {
            // Create a settlement
            const settlementData = new CreateSettlementRequestBuilder()
                .withGroupId(testGroup.id)
                .withPayerId(settlementUsers[0].uid)
                .withPayeeId(settlementUsers[1].uid)
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
                .build();

            const created = await apiDriver.createSettlement(settlementData, settlementUsers[0].token);

            // Soft delete
            await apiDriver.deleteSettlement(created.id, settlementUsers[0].token);

            // Attempt to update should fail
            await expect(apiDriver.updateSettlement(
                created.id,
                new SettlementUpdateBuilder()
                    .withAmount(200.0)
                    .withCurrency('USD')
                    .build(),
                settlementUsers[0].token,
            ))
                .rejects
                .toThrow(
                    /status 400.*ALREADY_DELETED|status 404.*SETTLEMENT_NOT_FOUND/,
                );
        });
    });
});
