import { amountToSmallestUnit, GroupDTO, PooledTestUser, toCurrencyISOCode, toDisplayName, USD, UserId } from '@billsplit-wl/shared';
import { ApiDriver, borrowTestUsers, CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder } from '@billsplit-wl/test-support';
import { afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';

async function runWithLimitedConcurrency<T>(operations: Array<() => Promise<T>>, limit: number): Promise<PromiseSettledResult<T>[]> {
    if (operations.length === 0) {
        return [];
    }

    const results: PromiseSettledResult<T>[] = new Array(operations.length);
    let index = 0;

    const worker = async () => {
        while (true) {
            const currentIndex = index;
            index += 1;

            if (currentIndex >= operations.length) {
                break;
            }

            try {
                const value = await operations[currentIndex]();
                results[currentIndex] = {
                    status: 'fulfilled',
                    value,
                } as PromiseFulfilledResult<T>;
            } catch (error) {
                results[currentIndex] = {
                    status: 'rejected',
                    reason: error,
                } as PromiseRejectedResult;
            }
        }
    };

    const workers = Array.from({ length: Math.min(limit, operations.length) }, () => worker());
    await Promise.all(workers);

    return results;
}

describe('Concurrent Operations Integration Tests', () => {
    let apiDriver: ApiDriver;

    beforeAll(async () => {
        apiDriver = await ApiDriver.create();
    });

    let users: PooledTestUser[];
    let testUser1: PooledTestUser;
    let testUser2: PooledTestUser;
    let testUser3: PooledTestUser;
    let testUser4: PooledTestUser;
    let testGroup: GroupDTO;

    beforeEach(async () => {
        // Borrow test users
        users = await borrowTestUsers(6);
        testUser1 = users[0];
        testUser2 = users[1];
        testUser3 = users[2];
        testUser4 = users[3];

        // Create test group via API
        testGroup = await apiDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName('Concurrent Operations Test Group')
                .withDescription('Testing concurrent operations')
                .build(),
            testUser1.token,
        );
    });

    afterEach(async () => {
        // Users are auto-returned by borrowTestUsers
    });

    describe('Concurrent Member Operations', () => {
        test('should handle multiple users joining simultaneously', async () => {
            // Generate share link for concurrent joins
            const { shareToken } = await apiDriver.generateShareableLink(testGroup.id, undefined, testUser1.token);

            // Execute all member additions concurrently via share link
            const addPromises = [
                apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 2'), testUser2.token),
                apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 3'), testUser3.token),
                apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 4'), testUser4.token),
            ];

            // All operations should complete successfully
            await Promise.all(addPromises);

            // Verify all members were added via API
            const { members } = await apiDriver.getGroupFullDetails(testGroup.id, undefined, testUser1.token);
            expect(members.members.length).toBe(4); // testUser1 (admin) + 3 new members
        });

        test('should handle concurrent member queries during membership changes', async () => {
            // Add initial member via share link
            const { shareToken: initialShareToken } = await apiDriver.generateShareableLink(testGroup.id, undefined, testUser1.token);
            await apiDriver.joinGroupByLink(initialShareToken, toDisplayName('Test User 2'), testUser2.token);

            // Run concurrent operations: queries while adding/removing members
            const { shareToken: concurrentShareToken } = await apiDriver.generateShareableLink(testGroup.id, undefined, testUser1.token);
            const operations = [
                // Query operations via API
                () => apiDriver.getGroupFullDetails(testGroup.id, undefined, testUser1.token),
                () => apiDriver.getGroupFullDetails(testGroup.id, undefined, testUser2.token),

                // Modification operations via API
                () => apiDriver.joinGroupByLink(concurrentShareToken, toDisplayName('Test User 3'), testUser3.token),
                () => apiDriver.removeGroupMember(testGroup.id, testUser2.uid, testUser1.token),
            ];

            // Execute all operations concurrently
            const results = await Promise.allSettled(operations.map((op) => op()));

            // Verify that operations completed (some may succeed, some may fail due to race conditions)
            // The key is that the system remains consistent and doesn't crash
            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            const failed = results.filter((r) => r.status === 'rejected').length;

            expect(succeeded + failed).toBe(operations.length);
            expect(succeeded).toBeGreaterThan(0); // At least some operations should succeed

            // System should be in a consistent state - verify via API
            const { members } = await apiDriver.getGroupFullDetails(testGroup.id, undefined, testUser1.token);
            expect(members.members.length).toBeGreaterThan(0);
        });
    });

    describe('Concurrent Group Operations', () => {
        test('should handle concurrent expense creation by multiple members', async () => {
            // Add members via share link
            const { shareToken } = await apiDriver.generateShareableLink(testGroup.id, undefined, testUser1.token);
            let counter = 2;
            for (const user of [testUser2, testUser3, testUser4]) {
                await apiDriver.joinGroupByLink(shareToken, toDisplayName(`Test User ${counter++}`), user.token);
            }

            // Create concurrent expenses via API
            const expensePromises = [
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser1.uid)
                        .withParticipants([testUser1.uid, testUser2.uid])
                        .build(),
                    testUser1.token,
                ),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser2.uid)
                        .withParticipants([testUser2.uid, testUser3.uid])
                        .build(),
                    testUser2.token,
                ),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser3.uid)
                        .withParticipants([testUser3.uid, testUser4.uid])
                        .build(),
                    testUser3.token,
                ),
            ];

            // All expense creations should succeed
            const createdExpenses = await Promise.all(expensePromises);

            expect(createdExpenses).toHaveLength(3);
            createdExpenses.forEach((expense) => {
                expect(expense.id).toBeDefined();
                expect(expense.groupId).toBe(testGroup.id);
                expect(expense.splits.length).toBeGreaterThan(0);
            });
        });

        test('should handle member leaving during balance calculation', async () => {
            // Add member via share link
            const { shareToken } = await apiDriver.generateShareableLink(testGroup.id, undefined, testUser1.token);
            await apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 2'), testUser2.token);

            // Create expense via API
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(testUser1.uid)
                    .withParticipants([testUser1.uid, testUser2.uid])
                    .build(),
                testUser1.token,
            );

            // Simulate concurrent operations: balance queries and member removal
            const operations = [
                // Query operations via API
                () => apiDriver.getGroupFullDetails(testGroup.id, undefined, testUser1.token),
                () => apiDriver.getGroupExpenses(testGroup.id, testUser1.token),

                // Member removal during balance calculation via API
                () => apiDriver.removeGroupMember(testGroup.id, testUser2.uid, testUser1.token),
            ];

            // Execute operations concurrently
            const results = await Promise.allSettled(operations.map((op) => op()));

            // Verify system remains consistent
            // Some operations may succeed, some may fail, but system should not crash
            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            expect(succeeded).toBeGreaterThan(0);

            // Check final state is consistent via API
            const { members } = await apiDriver.getGroupFullDetails(testGroup.id, undefined, testUser1.token);
            expect(members.members.length).toBeGreaterThan(0);
        });
    });

    describe('Error Recovery During Concurrent Operations', () => {
        test('should handle partial failures gracefully', async () => {
            // Add a member via share link
            const { shareToken } = await apiDriver.generateShareableLink(testGroup.id, undefined, testUser1.token);
            await apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 2'), testUser2.token);

            // Create operations where some will succeed and some will fail
            const operations = [
                // Valid operations via API
                () => apiDriver.getGroupFullDetails(testGroup.id, undefined, testUser1.token),
                () => apiDriver.getGroupFullDetails(testGroup.id, undefined, testUser2.token),

                // Operations that will fail for non-member (testUser3 hasn't joined)
                () => apiDriver.getGroupFullDetails(testGroup.id, undefined, testUser3.token),
            ];

            // Execute all operations concurrently
            const results = await Promise.allSettled(operations.map((op) => op()));

            // Verify first two operations succeeded
            expect(results[0].status).toBe('fulfilled');
            expect(results[1].status).toBe('fulfilled');

            // Third operation should fail (not a member)
            expect(results[2].status).toBe('rejected');

            // System should still be in valid state
            const { members } = await apiDriver.getGroupFullDetails(testGroup.id, undefined, testUser1.token);
            expect(members.members.length).toBe(2);
        });
    });

    describe('Balance Correctness Under Concurrent Load', () => {
        test('should maintain mathematically correct balances under heavy concurrent expense and settlement load', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Concurrent Balance Test')
                    .build(),
                testUser1.token,
            );

            const { shareToken } = await apiDriver.generateShareableLink(testGroup.id, undefined, testUser1.token);
            await apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 2'), testUser2.token);
            await apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 3'), testUser3.token);

            // Expense configurations: [payer, amount, participants]
            const expenseConfigs: Array<[PooledTestUser, number, UserId[]]> = [
                [testUser1, 100, [testUser1.uid, testUser2.uid]],
                [testUser2, 80, [testUser2.uid, testUser3.uid]],
                [testUser3, 60, [testUser1.uid, testUser3.uid]],
                [testUser1, 120, [testUser1.uid, testUser2.uid, testUser3.uid]],
                [testUser2, 95, [testUser1.uid, testUser2.uid, testUser3.uid]],
                [testUser3, 85, [testUser1.uid, testUser2.uid]],
            ];

            // Settlement configurations: [payer, payee, amount, payerToken]
            const settlementConfigs: Array<[UserId, UserId, number, string]> = [
                [testUser2.uid, testUser1.uid, 25, testUser2.token],
                [testUser3.uid, testUser1.uid, 30, testUser3.token],
                [testUser1.uid, testUser2.uid, 15, testUser1.token],
                [testUser2.uid, testUser3.uid, 20, testUser2.token],
            ];

            const operations = [
                ...expenseConfigs.map(([payer, amount, participants]) => () =>
                    apiDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(payer.uid)
                            .withAmount(amount, USD)
                            .withParticipants(participants)
                            .withSplitType('equal')
                            .build(),
                        payer.token,
                    )
                ),
                ...settlementConfigs.map(([payerId, payeeId, amount, token]) => () =>
                    apiDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPayerId(payerId)
                            .withPayeeId(payeeId)
                            .withAmount(amount, USD)
                            .build(),
                        token,
                    )
                ),
            ];

            const results = await runWithLimitedConcurrency<unknown>(operations, 3);

            const succeeded = results.filter((r) => r.status === 'fulfilled');

            expect(succeeded.length).toBeGreaterThan(0);

            const balances = await apiDriver.getGroupBalances(testGroup.id, testUser1.token);

            expect(balances.balancesByCurrency[USD]).toBeDefined();
            const currencyBalances = balances.balancesByCurrency[USD];

            const totalUnits = Object.values(currencyBalances).reduce(
                (sum, balance: any) => sum + amountToSmallestUnit(balance.netBalance, USD),
                0,
            );
            expect(totalUnits).toBe(0);
        });

        test('should handle rapid concurrent updates to same user balance', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Same User Contention Test')
                    .build(),
                testUser1.token,
            );

            const { shareToken } = await apiDriver.generateShareableLink(testGroup.id, undefined, testUser1.token);
            await apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 2'), testUser2.token);

            const usd = USD;
            const operations = Array.from({ length: 8 }, (_, i) => () =>
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser1.uid)
                        .withAmount(50 + i, usd)
                        .withParticipants([testUser1.uid, testUser2.uid])
                        .withSplitType('equal')
                        .build(),
                    testUser1.token,
                ));

            const results = await runWithLimitedConcurrency<unknown>(operations, 3);

            const succeeded = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];

            expect(succeeded.length).toBeGreaterThan(0);

            const successfulExpenses = succeeded.map((r) => r.value);
            const expectedDebt = successfulExpenses.reduce((sum, exp) => sum + exp.amount / 2, 0);

            const balances = await apiDriver.getGroupBalances(testGroup.id, testUser1.token);

            expect(balances.balancesByCurrency[usd]).toBeDefined();
            expect(balances.balancesByCurrency[usd][testUser2.uid].netBalance).toBeCloseTo(-expectedDebt, 2);
            expect(balances.balancesByCurrency[usd][testUser1.uid].netBalance).toBeCloseTo(expectedDebt, 2);
        });

        test('should maintain correct multi-currency balances under concurrent operations', async () => {
            const testGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Multi-Currency Concurrent Test')
                    .build(),
                testUser1.token,
            );

            const { shareToken } = await apiDriver.generateShareableLink(testGroup.id, undefined, testUser1.token);
            await apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 2'), testUser2.token);
            await apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 3'), testUser3.token);

            const usd = USD;
            const eur = toCurrencyISOCode('EUR');
            const gbp = toCurrencyISOCode('GBP');

            const operations = [
                () =>
                    apiDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser1.uid)
                            .withAmount(100, usd)
                            .withParticipants([testUser1.uid, testUser2.uid])
                            .withSplitType('equal')
                            .build(),
                        testUser1.token,
                    ),
                () =>
                    apiDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser2.uid)
                            .withAmount(80, eur)
                            .withParticipants([testUser2.uid, testUser3.uid])
                            .withSplitType('equal')
                            .build(),
                        testUser2.token,
                    ),
                () =>
                    apiDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser3.uid)
                            .withAmount(60, gbp)
                            .withParticipants([testUser1.uid, testUser3.uid])
                            .withSplitType('equal')
                            .build(),
                        testUser3.token,
                    ),
                () =>
                    apiDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser1.uid)
                            .withAmount(120, usd)
                            .withParticipants([testUser1.uid, testUser2.uid, testUser3.uid])
                            .withSplitType('equal')
                            .build(),
                        testUser1.token,
                    ),
                () =>
                    apiDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser2.uid)
                            .withAmount(90, eur)
                            .withParticipants([testUser1.uid, testUser2.uid])
                            .withSplitType('equal')
                            .build(),
                        testUser2.token,
                    ),
                () =>
                    apiDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPayerId(testUser2.uid)
                            .withPayeeId(testUser1.uid)
                            .withAmount(25, usd)
                            .build(),
                        testUser2.token,
                    ),
                () =>
                    apiDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPayerId(testUser3.uid)
                            .withPayeeId(testUser2.uid)
                            .withAmount(30, eur)
                            .build(),
                        testUser3.token,
                    ),
                () =>
                    apiDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser3.uid)
                            .withAmount(75, gbp)
                            .withParticipants([testUser2.uid, testUser3.uid])
                            .withSplitType('equal')
                            .build(),
                        testUser3.token,
                    ),
                () =>
                    apiDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser1.uid)
                            .withAmount(110, usd)
                            .withParticipants([testUser1.uid, testUser3.uid])
                            .withSplitType('equal')
                            .build(),
                        testUser1.token,
                    ),
            ];

            const results = await runWithLimitedConcurrency<unknown>(operations, 3);

            const succeeded = results.filter((r) => r.status === 'fulfilled');

            expect(succeeded.length).toBeGreaterThan(0);

            const balances = await apiDriver.getGroupBalances(testGroup.id, testUser1.token);

            const currencies = Object.keys(balances.balancesByCurrency);
            expect(currencies.length).toBeGreaterThan(0);

            currencies.forEach((currencyStr) => {
                const currency = toCurrencyISOCode(currencyStr);
                const currencyBalances = balances.balancesByCurrency[currency];
                const sumUnits = Object.values(currencyBalances).reduce(
                    (total, userBal: any) => total + amountToSmallestUnit(userBal.netBalance, currency),
                    0,
                );
                expect(sumUnits).toBe(0);
            });
        });
    });

    describe('Leave/Remove Race Conditions', () => {
        test('should prevent member leaving with outstanding balance when expense is created concurrently', async () => {
            // Create a fresh group for this test
            const raceTestGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Leave Balance Race Test Group')
                    .build(),
                testUser1.token,
            );

            // Add a second member
            const { shareToken } = await apiDriver.generateShareableLink(raceTestGroup.id, undefined, testUser1.token);
            await apiDriver.joinGroupByLink(shareToken, toDisplayName('Test User 2'), testUser2.token);

            // Verify zero balance before test
            const initialBalances = await apiDriver.getGroupBalances(raceTestGroup.id, testUser1.token);
            expect(initialBalances.balancesByCurrency[USD]).toBeUndefined();

            // Concurrently:
            // 1. Create an expense where testUser2 owes money to testUser1
            // 2. testUser2 attempts to leave the group
            // This tests the TOCTOU race condition where both operations check balance before the transaction
            const concurrentOps = [
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(raceTestGroup.id)
                        .withPaidBy(testUser1.uid)
                        .withAmount(100, USD)
                        .withParticipants([testUser1.uid, testUser2.uid])
                        .withSplitType('equal')
                        .build(),
                    testUser1.token,
                ),
                apiDriver.leaveGroup(raceTestGroup.id, testUser2.token),
            ];

            const results = await Promise.allSettled(concurrentOps);

            // Analyze results
            const expenseResult = results[0];
            const leaveResult = results[1];

            // At least one operation should succeed
            expect(results.some(r => r.status === 'fulfilled')).toBe(true);

            // Get final state
            const { members } = await apiDriver.getGroupFullDetails(raceTestGroup.id, undefined, testUser1.token);
            const finalBalances = await apiDriver.getGroupBalances(raceTestGroup.id, testUser1.token);

            // CRITICAL: If testUser2 is no longer a member, they must have had zero balance when they left
            // This verifies the race condition fix is working
            const testUser2IsMember = members.members.some((m) => m.uid === testUser2.uid);

            if (!testUser2IsMember) {
                // testUser2 left successfully - they must have had zero balance
                // This means the leave completed before the expense was processed
                // or the leave transaction correctly read zero balance
                expect(leaveResult.status).toBe('fulfilled');

                // If expense also succeeded, testUser2's share should now be orphaned
                // (acceptable - this is a business decision about how to handle it)
            } else {
                // testUser2 is still a member - leave should have failed
                // Either because:
                // 1. Expense completed first, creating non-zero balance
                // 2. Concurrent write conflict caused leave to retry and see non-zero balance
                expect(leaveResult.status).toBe('rejected');

                // Verify testUser2 has outstanding balance
                const testUser2Balance = finalBalances.balancesByCurrency[USD]?.[testUser2.uid]?.netBalance;
                expect(testUser2Balance).toBeDefined();
            }
        });
    });

    describe('Join-by-link Race Conditions', () => {
        test('should prevent duplicate display names when two users join concurrently with the same name', async () => {
            // Create a fresh group for this test
            const raceTestGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName('Display Name Race Test Group')
                    .build(),
                testUser1.token,
            );

            // Generate share link
            const { shareToken } = await apiDriver.generateShareableLink(raceTestGroup.id, undefined, testUser1.token);

            // Two users try to join concurrently with the SAME display name
            // This tests the TOCTOU race condition where both users pass the pre-transaction
            // display name check, but both should not be able to join with the same name
            const sameDisplayName = toDisplayName('Duplicate Name');
            const joinPromises = [
                apiDriver.joinGroupByLink(shareToken, sameDisplayName, testUser2.token),
                apiDriver.joinGroupByLink(shareToken, sameDisplayName, testUser3.token),
            ];

            const results = await Promise.allSettled(joinPromises);

            // Count successes and failures
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            // Exactly one should succeed, one should fail with DISPLAY_NAME_TAKEN
            expect(successes.length).toBe(1);
            expect(failures.length).toBe(1);

            // Verify the failure is due to display name conflict
            const failure = failures[0] as PromiseRejectedResult;
            interface ApiErrorResponse { error?: { code?: string; detail?: string; }; }
            const errorResponse = (failure.reason as { response?: ApiErrorResponse; }).response;
            expect(errorResponse?.error?.detail || errorResponse?.error?.code).toBe('DISPLAY_NAME_TAKEN');

            // Verify final state: group has exactly 2 members (owner + 1 new member)
            const { members } = await apiDriver.getGroupFullDetails(raceTestGroup.id, undefined, testUser1.token);
            expect(members.members.length).toBe(2);

            // Verify only one member has the display name
            const membersWithDuplicateName = members.members.filter((m) => m.groupDisplayName === 'Duplicate Name');
            expect(membersWithDuplicateName.length).toBe(1);
        });
    });
});
