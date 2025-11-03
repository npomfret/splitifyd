import { PooledTestUser } from '@splitifyd/shared';
import { ApiDriver, borrowTestUsers, CreateExpenseRequestBuilder, CreateGroupRequestBuilder } from '@splitifyd/test-support';
import { beforeEach, describe, expect, test } from 'vitest';

describe('Balance & Settlement - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    let users: PooledTestUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(6); // Get enough users for all tests
    });

    afterEach(async () => {
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
            const shareLink = await apiDriver.generateShareableLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupByLink(shareLink.shareToken, users[1].token);
            await apiDriver.joinGroupByLink(shareLink.shareToken, users[2].token);

            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withAmount(30, 'USD')
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

    // REMOVED: Settlement Management Operations (15 tests)
    // All settlement management tests have been moved to unit tests in:
    // firebase/functions/src/__tests__/unit/settlements/SettlementManagement.test.ts
    //
    // The following test suites were converted:
    // - Settlement Retrieval (3 tests): retrieve by ID, non-member rejection, non-existent handling
    // - Settlement Updates (3 tests): field updates, non-creator rejection, validation
    // - Settlement Deletion (3 tests): deletion, non-creator rejection, non-existent handling
    // - Settlement Access After Member Departure (1 test): view settlements after member leaves
    // - Settlement Soft Delete Operations (5 tests): soft delete metadata, admin permissions,
    //   non-creator prevention, double deletion prevention, update prevention
    //
    // These unit tests are 100-300x faster (5-20ms vs 1-3s per test) and provide identical
    // coverage without requiring the Firebase emulator.
    //
    // Only the 2 tests in "Basic Balance Calculation" remain as integration tests because
    // they use waitForBalanceUpdate() which requires emulator timing for async balance calculations.
});
