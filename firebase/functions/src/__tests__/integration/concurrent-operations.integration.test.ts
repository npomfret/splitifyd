import { amountToSmallestUnit, GroupDTO } from '@splitifyd/shared';
import { PooledTestUser } from '@splitifyd/shared';
import {
    ApiDriver,
    borrowTestUsers,
    CreateExpenseRequestBuilder,
    CreateGroupRequestBuilder,
    CreateSettlementRequestBuilder,
    getFirebaseEmulatorConfig,
    NotificationDriver,
} from '@splitifyd/test-support';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { getAuth, getFirestore } from '../../firebase';
import { ApplicationBuilder } from '../../services/ApplicationBuilder';

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
    const identityToolkit = getFirebaseEmulatorConfig().identityToolkit;

    const applicationBuilder = ApplicationBuilder.createApplicationBuilder(getFirestore(), getAuth(), identityToolkit);
    const firestoreReader = applicationBuilder.buildFirestoreReader();
    const groupService = applicationBuilder.buildGroupService();
    const groupMemberService = applicationBuilder.buildGroupMemberService();
    const expenseService = applicationBuilder.buildExpenseService();
    const notificationDriver = new NotificationDriver(getFirestore());

    let users: PooledTestUser[];
    let testUser1: PooledTestUser;
    let testUser2: PooledTestUser;
    let testUser3: PooledTestUser;
    let testUser4: PooledTestUser;
    let testGroup: GroupDTO;

    beforeAll(async () => {});

    beforeEach(async () => {
        // Create test users
        users = await borrowTestUsers(6); // Borrow 6 users for concurrent tests
        testUser1 = users[0];
        testUser2 = users[1];
        testUser3 = users[2];
        testUser4 = users[3];

        // Create test group
        testGroup = await groupService.createGroup(
            testUser1.uid,
            new CreateGroupRequestBuilder()
                .withName('Concurrent Operations Test Group')
                .withDescription('Testing concurrent operations')
                .build(),
        );
    });

    afterEach(async () => {
        // Wait for system to settle before stopping listeners
        await notificationDriver.waitForQuiet();
        await notificationDriver.stopAllListeners();
    });

    describe('Concurrent Member Operations', () => {
        test('should handle multiple users joining simultaneously', async () => {
            // Generate share link for concurrent joins (production code path)
            const { linkId } = await applicationBuilder.buildGroupShareService().generateShareableLink(testUser1.uid, testGroup.id);

            // Execute all member additions concurrently via share link
            const addPromises = [
                applicationBuilder.buildGroupShareService().joinGroupByLink(testUser2.uid, linkId),
                applicationBuilder.buildGroupShareService().joinGroupByLink(testUser3.uid, linkId),
                applicationBuilder.buildGroupShareService().joinGroupByLink(testUser4.uid, linkId),
            ];

            // All operations should complete successfully
            await Promise.all(addPromises);

            // Verify all members were added
            const finalMembers = await firestoreReader.getAllGroupMembers(testGroup.id);
            expect(finalMembers).toHaveLength(4); // testUser1 (admin) + 3 new members

            const memberIds = finalMembers.map((m) => m.uid);
            expect(memberIds).toContain(testUser1.uid);
            expect(memberIds).toContain(testUser2.uid);
            expect(memberIds).toContain(testUser3.uid);
            expect(memberIds).toContain(testUser4.uid);
        });

        test('should handle concurrent member queries during membership changes', async () => {
            const groupShareService = applicationBuilder.buildGroupShareService();

            // Add initial member via share link (production code path)
            const { linkId: initialLinkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            await groupShareService.joinGroupByLink(testUser2.uid, initialLinkId);

            // Run concurrent operations: queries while adding/removing members
            const { linkId: concurrentLinkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            const operations = [
                // Query operations
                () => firestoreReader.getAllGroupMembers(testGroup.id),
                () => firestoreReader.getGroupMember(testGroup.id, testUser2.uid),

                // Modification operations (production code paths)
                () => groupShareService.joinGroupByLink(testUser3.uid, concurrentLinkId),
                () => groupMemberService.removeGroupMember(testUser1.uid, testGroup.id, testUser2.uid),
            ];

            // Execute all operations concurrently
            const results = await Promise.allSettled(operations.map((op) => op()));

            // Verify that operations completed (some may succeed, some may fail due to race conditions)
            // The key is that the system remains consistent and doesn't crash
            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            const failed = results.filter((r) => r.status === 'rejected').length;

            expect(succeeded + failed).toBe(operations.length);
            expect(succeeded).toBeGreaterThan(0); // At least some operations should succeed

            // System should be in a consistent state
            const finalMembers = await firestoreReader.getAllGroupMembers(testGroup.id);
            expect(Array.isArray(finalMembers)).toBe(true);
        });

        // NOTE: Concurrent role updates test removed - no production code path exists for updating member roles
        // If role update functionality is implemented in the future, add appropriate concurrent tests here
    });

    describe('Concurrent Group Operations', () => {
        test('should handle concurrent expense creation by multiple members', async () => {
            const groupShareService = applicationBuilder.buildGroupShareService();

            // Add members to group via share link (production code path)
            const { linkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            for (const user of [testUser2, testUser3, testUser4]) {
                await groupShareService.joinGroupByLink(user.uid, linkId);
            }

            // Create concurrent expenses
            const expensePromises = [
                expenseService.createExpense(
                    testUser1.uid,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser1.uid)
                        .withParticipants([testUser1.uid, testUser2.uid])
                        .build(),
                ),
                expenseService.createExpense(
                    testUser2.uid,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser2.uid)
                        .withParticipants([testUser2.uid, testUser3.uid])
                        .build(),
                ),
                expenseService.createExpense(
                    testUser3.uid,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser3.uid)
                        .withParticipants([testUser3.uid, testUser4.uid])
                        .build(),
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
            const groupShareService = applicationBuilder.buildGroupShareService();

            // Add member via share link (production code path)
            const { linkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            await groupShareService.joinGroupByLink(testUser2.uid, linkId);

            // Create expense
            await expenseService.createExpense(
                testUser1.uid,
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withPaidBy(testUser1.uid)
                    .withParticipants([testUser1.uid, testUser2.uid])
                    .build(),
            );

            // Simulate concurrent operations: balance queries and member removal
            const operations = [
                // Balance-related queries that might be running
                () => firestoreReader.getAllGroupMembers(testGroup.id),
                () => expenseService.listGroupExpenses(testGroup.id, testUser1.uid),

                // Member removal during balance calculation (production code path)
                () => groupMemberService.removeGroupMember(testUser1.uid, testGroup.id, testUser2.uid),
            ];

            // Execute operations concurrently
            const results = await Promise.allSettled(operations.map((op) => op()));

            // Verify system remains consistent
            // Some operations may succeed, some may fail, but system should not crash
            const succeeded = results.filter((r) => r.status === 'fulfilled').length;
            expect(succeeded).toBeGreaterThan(0);

            // Check final state is consistent
            const finalMembers = await firestoreReader.getAllGroupMembers(testGroup.id);
            expect(Array.isArray(finalMembers)).toBe(true);
        });
    });

    describe('Error Recovery During Concurrent Operations', () => {
        test('should handle partial failures gracefully', async () => {
            const groupShareService = applicationBuilder.buildGroupShareService();

            // Add a member via share link (production code path)
            const { linkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            await groupShareService.joinGroupByLink(testUser2.uid, linkId);

            // Create operations where some will succeed and some will fail
            const operations = [
                // Valid operations
                () => firestoreReader.getAllGroupMembers(testGroup.id),
                () => firestoreReader.getGroupMember(testGroup.id, testUser2.uid),

                // Operations that will return null for non-existent member (valid behavior)
                () => firestoreReader.getGroupMember(testGroup.id, 'non-existent-user-id'),
            ];

            // Execute all operations concurrently
            const results = await Promise.allSettled(operations.map((op) => op()));

            // Verify operations completed
            const succeeded = results.filter((r) => r.status === 'fulfilled');

            expect(succeeded.length).toBe(operations.length); // All should succeed (null is valid for non-existent)

            // Verify valid operations returned expected results
            expect(results[0].status).toBe('fulfilled'); // getAllGroupMembers should succeed
            expect(results[1].status).toBe('fulfilled'); // getGroupMember for existing user should succeed

            // System should still be in valid state
            const finalMembers = await firestoreReader.getAllGroupMembers(testGroup.id);
            expect(Array.isArray(finalMembers)).toBe(true);
            expect(finalMembers.some((m) => m.uid === testUser2.uid)).toBe(true);
        });
    });

    describe('Balance Correctness Under Concurrent Load', () => {
        const apiDriver = new ApiDriver();

        test('should maintain mathematically correct balances under heavy concurrent expense and settlement load', async () => {
            const groupShareService = applicationBuilder.buildGroupShareService();

            const testGroup = await groupService.createGroup(
                testUser1.uid,
                new CreateGroupRequestBuilder()
                    .withName('Concurrent Balance Test')
                    .build(),
            );

            const { linkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            await groupShareService.joinGroupByLink(testUser2.uid, linkId);
            await groupShareService.joinGroupByLink(testUser3.uid, linkId);

            // Expense configurations: [payer, amount, participants]
            const expenseConfigs: Array<[PooledTestUser, number, string[]]> = [
                [testUser1, 100, [testUser1.uid, testUser2.uid]],
                [testUser2, 80, [testUser2.uid, testUser3.uid]],
                [testUser3, 60, [testUser1.uid, testUser3.uid]],
                [testUser1, 120, [testUser1.uid, testUser2.uid, testUser3.uid]],
                [testUser2, 95, [testUser1.uid, testUser2.uid, testUser3.uid]],
                [testUser3, 85, [testUser1.uid, testUser2.uid]],
            ];

            // Settlement configurations: [payer, payee, amount, payerToken]
            const settlementConfigs: Array<[string, string, number, string]> = [
                [testUser2.uid, testUser1.uid, 25, testUser2.token],
                [testUser3.uid, testUser1.uid, 30, testUser3.token],
                [testUser1.uid, testUser2.uid, 15, testUser1.token],
                [testUser2.uid, testUser3.uid, 20, testUser2.token],
            ];

            const operations = [
                ...expenseConfigs.map(([payer, amount, participants]) => () =>
                    expenseService.createExpense(
                        payer.uid,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(payer.uid)
                            .withAmount(amount, 'USD')
                            .withParticipants(participants)
                            .withSplitType('equal')
                            .build(),
                    )
                ),
                ...settlementConfigs.map(([payerId, payeeId, amount, token]) => () =>
                    apiDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPayerId(payerId)
                            .withPayeeId(payeeId)
                            .withAmount(amount, 'USD')
                            .build(),
                        token,
                    )
                ),
            ];

            const results = await runWithLimitedConcurrency<unknown>(operations, 3);

            const succeeded = results.filter((r) => r.status === 'fulfilled');

            expect(succeeded.length).toBeGreaterThan(0);

            const balances = await apiDriver.getGroupBalances(testGroup.id, testUser1.token);

            expect(balances.balancesByCurrency.USD).toBeDefined();
            const currencyBalances = balances.balancesByCurrency.USD;

            const totalUnits = Object.values(currencyBalances).reduce(
                (sum, balance: any) => sum + amountToSmallestUnit(balance.netBalance, 'USD'),
                0,
            );
            expect(totalUnits).toBe(0);
        });

        test('should handle rapid concurrent updates to same user balance', async () => {
            const groupShareService = applicationBuilder.buildGroupShareService();

            const testGroup = await groupService.createGroup(
                testUser1.uid,
                new CreateGroupRequestBuilder()
                    .withName('Same User Contention Test')
                    .build(),
            );

            const { linkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            await groupShareService.joinGroupByLink(testUser2.uid, linkId);

            const operations = Array.from({ length: 8 }, (_, i) => () =>
                expenseService.createExpense(
                    testUser1.uid,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(testGroup.id)
                        .withPaidBy(testUser1.uid)
                        .withAmount(50 + i, 'USD')
                        .withParticipants([testUser1.uid, testUser2.uid])
                        .withSplitType('equal')
                        .build(),
                ));

            const results = await runWithLimitedConcurrency<unknown>(operations, 3);

            const succeeded = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];

            expect(succeeded.length).toBeGreaterThan(0);

            const successfulExpenses = succeeded.map((r) => r.value);
            const expectedDebt = successfulExpenses.reduce((sum, exp) => sum + exp.amount / 2, 0);

            const balances = await apiDriver.getGroupBalances(testGroup.id, testUser1.token);

            expect(balances.balancesByCurrency.USD).toBeDefined();
            expect(balances.balancesByCurrency.USD[testUser2.uid].netBalance).toBeCloseTo(-expectedDebt, 2);
            expect(balances.balancesByCurrency.USD[testUser1.uid].netBalance).toBeCloseTo(expectedDebt, 2);
        });

        test('should maintain correct multi-currency balances under concurrent operations', async () => {
            const groupShareService = applicationBuilder.buildGroupShareService();

            const testGroup = await groupService.createGroup(
                testUser1.uid,
                new CreateGroupRequestBuilder()
                    .withName('Multi-Currency Concurrent Test')
                    .build(),
            );

            const { linkId } = await groupShareService.generateShareableLink(testUser1.uid, testGroup.id);
            await groupShareService.joinGroupByLink(testUser2.uid, linkId);
            await groupShareService.joinGroupByLink(testUser3.uid, linkId);

            const operations = [
                () =>
                    expenseService.createExpense(
                        testUser1.uid,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser1.uid)
                            .withAmount(100, 'USD')
                            .withParticipants([testUser1.uid, testUser2.uid])
                            .withSplitType('equal')
                            .build(),
                    ),
                () =>
                    expenseService.createExpense(
                        testUser2.uid,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser2.uid)
                            .withAmount(80, 'EUR')
                            .withParticipants([testUser2.uid, testUser3.uid])
                            .withSplitType('equal')
                            .build(),
                    ),
                () =>
                    expenseService.createExpense(
                        testUser3.uid,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser3.uid)
                            .withAmount(60, 'GBP')
                            .withParticipants([testUser1.uid, testUser3.uid])
                            .withSplitType('equal')
                            .build(),
                    ),
                () =>
                    expenseService.createExpense(
                        testUser1.uid,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser1.uid)
                            .withAmount(120, 'USD')
                            .withParticipants([testUser1.uid, testUser2.uid, testUser3.uid])
                            .withSplitType('equal')
                            .build(),
                    ),
                () =>
                    expenseService.createExpense(
                        testUser2.uid,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser2.uid)
                            .withAmount(90, 'EUR')
                            .withParticipants([testUser1.uid, testUser2.uid])
                            .withSplitType('equal')
                            .build(),
                    ),
                () =>
                    apiDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPayerId(testUser2.uid)
                            .withPayeeId(testUser1.uid)
                            .withAmount(25, 'USD')
                            .build(),
                        testUser2.token,
                    ),
                () =>
                    apiDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPayerId(testUser3.uid)
                            .withPayeeId(testUser2.uid)
                            .withAmount(30, 'EUR')
                            .build(),
                        testUser3.token,
                    ),
                () =>
                    expenseService.createExpense(
                        testUser3.uid,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser3.uid)
                            .withAmount(75, 'GBP')
                            .withParticipants([testUser2.uid, testUser3.uid])
                            .withSplitType('equal')
                            .build(),
                    ),
                () =>
                    expenseService.createExpense(
                        testUser1.uid,
                        new CreateExpenseRequestBuilder()
                            .withGroupId(testGroup.id)
                            .withPaidBy(testUser1.uid)
                            .withAmount(110, 'USD')
                            .withParticipants([testUser1.uid, testUser3.uid])
                            .withSplitType('equal')
                            .build(),
                    ),
            ];

            const results = await runWithLimitedConcurrency<unknown>(operations, 3);

            const succeeded = results.filter((r) => r.status === 'fulfilled');

            expect(succeeded.length).toBeGreaterThan(0);

            const balances = await apiDriver.getGroupBalances(testGroup.id, testUser1.token);

            const currencies = Object.keys(balances.balancesByCurrency);
            expect(currencies.length).toBeGreaterThan(0);

            currencies.forEach((currency) => {
                const currencyBalances = balances.balancesByCurrency[currency];
                const sumUnits = Object.values(currencyBalances).reduce(
                    (total, userBal: any) => total + amountToSmallestUnit(userBal.netBalance, currency),
                    0,
                );
                expect(sumUnits).toBe(0);
            });
        });
    });
});
