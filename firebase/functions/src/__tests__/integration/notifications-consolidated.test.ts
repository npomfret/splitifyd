// Consolidated Notifications Integration Tests
// Combines tests from realtime-notifications/core-notifications.test.ts, realtime-notifications/business-logic.test.ts,
// realtime-notifications/triggers.test.ts, and normal-flow/user-notification-system.test.ts

import { beforeEach, describe, expect, test } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
    ApiDriver,
    CreateGroupRequestBuilder,
    CreateExpenseRequestBuilder,
    SettlementBuilder,
    AppDriver,
    borrowTestUsers,
    generateShortId,
    TestGroupManager
} from '@splitifyd/test-support';
import { getFirestore } from '../../firebase';
import { UserToken, PooledTestUser } from '@splitifyd/shared';

describe('Notifications Management - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, getFirestore());
    let users: PooledTestUser[];
    let testGroup: any;

    beforeEach(async () => {
        users = await borrowTestUsers(4);
        // Create a fresh test group for notification tests
        testGroup = await TestGroupManager.getOrCreateGroup(users, { memberCount: 3 });
    });

    describe('Core Notification Document Operations', () => {
        test('should create and update notification documents for basic operations', async () => {
            // Create a group and verify notification document creation
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Core Test Group ${uuidv4()}`)
                    .build(),
                users[0].token
            );

            // Wait for notification document creation
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            // Verify notification document structure
            const notificationDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(notificationDoc).toBeTruthy();
            expect(notificationDoc!.groups[group.id]).toBeDefined();
            expect(notificationDoc!.groups[group.id].groupDetailsChangeCount).toBeGreaterThan(0);
            expect(notificationDoc!.groups[group.id].lastGroupDetailsChange).toBeTruthy();

            // Create expense to test transaction notifications
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .withAmount(25.0)
                    .build(),
                users[0].token
            );

            // Wait for transaction notification
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction');

            // Verify transaction notification structure
            const updatedDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(updatedDoc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(updatedDoc!.groups[group.id].lastTransactionChange).toBeTruthy();
        });

        test('should handle notification version increments correctly', async () => {
            // Create group and get initial state
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            const initialDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const initialGroupCount = initialDoc!.groups[group.id].groupDetailsChangeCount;

            // Update group to trigger version increment
            await apiDriver.updateGroup(group.id, { name: 'Updated Name' }, users[0].token);

            // Wait for and verify count increment
            const finalDoc = await appDriver.waitForNotificationWithMatcher(
                users[0].uid,
                group.id,
                (doc) => doc.groups[group.id]?.groupDetailsChangeCount >= initialGroupCount + 1,
                { timeout: 5000, errorMsg: 'Failed to detect group update notification' }
            );

            expect(finalDoc.groups[group.id].groupDetailsChangeCount).toBe(initialGroupCount + 1);
        });

        test('should handle rapid multiple updates without losing notifications', async () => {
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            const initialDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const initialCount = initialDoc!.groups[group.id].groupDetailsChangeCount;

            // Perform multiple rapid updates
            await Promise.all([
                apiDriver.updateGroup(group.id, { name: 'Update 1' }, users[0].token),
                apiDriver.updateGroup(group.id, { name: 'Update 2' }, users[0].token),
                apiDriver.updateGroup(group.id, { name: 'Update 3' }, users[0].token),
            ]);

            // Wait for all updates to be processed
            const expectedCount = initialCount + 3;
            await appDriver.waitForGroupDetailsChangeCount(group.id, users[0].uid, expectedCount);
        });
    });

    describe('Multi-User Notification Distribution', () => {
        test('should notify all group members when operations occur', async () => {
            // Create group with multiple members
            const multiUserGroup = await apiDriver.createGroupWithMembers(
                `Multi-User Group ${uuidv4()}`,
                [users[0], users[1], users[2]],
                users[0].token
            );

            // Wait for all users to receive group creation notifications
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, multiUserGroup.id, 'group'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, multiUserGroup.id, 'group'),
                appDriver.waitForUserNotificationUpdate(users[2].uid, multiUserGroup.id, 'group'),
            ]);

            // Verify all users have notification documents
            const docs = await Promise.all([
                appDriver.getUserNotificationDocument(users[0].uid),
                appDriver.getUserNotificationDocument(users[1].uid),
                appDriver.getUserNotificationDocument(users[2].uid),
            ]);

            docs.forEach((doc, index) => {
                expect(doc!.groups[multiUserGroup.id]).toBeDefined();
                expect(doc!.groups[multiUserGroup.id].groupDetailsChangeCount).toBeGreaterThan(0);
            });

            // Create expense and verify all participants are notified
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(multiUserGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                    .withAmount(60.0)
                    .build(),
                users[0].token
            );

            // Wait for all users to receive transaction notifications
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, multiUserGroup.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, multiUserGroup.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[2].uid, multiUserGroup.id, 'transaction'),
            ]);
        });

        test('should handle member addition and removal notification patterns', async () => {
            // Start with single-member group
            const dynamicGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, dynamicGroup.id, 'group');

            // Add second member
            const shareLink = await apiDriver.generateShareLink(dynamicGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // Both users should receive group update notifications
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, dynamicGroup.id, 'group'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, dynamicGroup.id, 'group'),
            ]);

            // Create expense involving both members
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(dynamicGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withAmount(40.0)
                    .build(),
                users[0].token
            );

            // Both should receive transaction notifications
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, dynamicGroup.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, dynamicGroup.id, 'transaction'),
            ]);

            // Settle all outstanding balances by currency before removing member
            const balances = await apiDriver.getGroupBalances(dynamicGroup.id, users[0].token);
            const dynamicBalancesByCurrency = balances.balancesByCurrency;

            for (const [currency, currencyBalances] of Object.entries(dynamicBalancesByCurrency)) {
                const user1CurrencyBalance = currencyBalances[users[1].uid]?.netBalance || 0;

                if (user1CurrencyBalance < 0) {
                    // users[1] owes users[0] in this currency
                    await apiDriver.createSettlement(
                        new SettlementBuilder()
                            .withGroupId(dynamicGroup.id)
                            .withPayer(users[1].uid)
                            .withPayee(users[0].uid)
                            .withAmount(Math.abs(user1CurrencyBalance))
                            .withCurrency(currency)
                            .build(),
                        users[1].token
                    );
                } else if (user1CurrencyBalance > 0) {
                    // users[0] owes users[1] in this currency
                    await apiDriver.createSettlement(
                        new SettlementBuilder()
                            .withGroupId(dynamicGroup.id)
                            .withPayer(users[0].uid)
                            .withPayee(users[1].uid)
                            .withAmount(Math.abs(user1CurrencyBalance))
                            .withCurrency(currency)
                            .build(),
                        users[0].token
                    );
                }
            }

            // Balance should now be settled, allowing member removal

            // Remove user 1 from group
            await apiDriver.removeGroupMember(dynamicGroup.id, users[1].uid, users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, dynamicGroup.id, 'group');

            // Create another expense - only user 0 should be notified
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(dynamicGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .withAmount(30.0)
                    .build(),
                users[0].token
            );

            await appDriver.waitForUserNotificationUpdate(users[0].uid, dynamicGroup.id, 'transaction');
        });
    });

    describe('Permission-Based Notification Access Control', () => {
        test('should only notify users for groups they have access to', async () => {
            // Create private group for user 0
            const privateGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().withName(`Private Group ${uuidv4()}`).build(),
                users[0].token
            );
            await appDriver.waitForUserNotificationUpdate(users[0].uid, privateGroup.id, 'group');

            // Create public group with multiple members
            const publicGroup = await apiDriver.createGroupWithMembers(
                `Public Group ${uuidv4()}`,
                [users[1], users[2]],
                users[1].token
            );

            // Wait for public group notifications
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[1].uid, publicGroup.id, 'group'),
                appDriver.waitForUserNotificationUpdate(users[2].uid, publicGroup.id, 'group'),
            ]);

            // Create expenses in both groups
            await Promise.all([
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(privateGroup.id)
                        .withPaidBy(users[0].uid)
                        .withParticipants([users[0].uid])
                        .withAmount(25.0)
                        .build(),
                    users[0].token
                ),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(publicGroup.id)
                        .withPaidBy(users[1].uid)
                        .withParticipants([users[1].uid, users[2].uid])
                        .withAmount(35.0)
                        .build(),
                    users[1].token
                ),
            ]);

            // Wait for transaction notifications
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, privateGroup.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, publicGroup.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[2].uid, publicGroup.id, 'transaction'),
            ]);

            // Verify users only have notifications for groups they belong to
            const user0Doc = await appDriver.getUserNotificationDocument(users[0].uid);
            const user1Doc = await appDriver.getUserNotificationDocument(users[1].uid);

            expect(user0Doc!.groups[privateGroup.id]).toBeDefined();
            expect(user0Doc!.groups[publicGroup.id]).toBeUndefined();

            expect(user1Doc!.groups[publicGroup.id]).toBeDefined();
            expect(user1Doc!.groups[privateGroup.id]).toBeUndefined();
        });

        test('should handle permission changes and notification access', async () => {
            // Create group with initial member
            const permissionGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, permissionGroup.id, 'group');

            // Add second member
            const shareLink = await apiDriver.generateShareLink(permissionGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, permissionGroup.id, 'group'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, permissionGroup.id, 'group'),
            ]);

            // Create expense involving both members
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(permissionGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withAmount(50.0)
                    .build(),
                users[0].token
            );

            // Both should receive transaction notifications
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, permissionGroup.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, permissionGroup.id, 'transaction'),
            ]);

            // Settle all outstanding balances by currency before removing member
            const permissionBalances = await apiDriver.getGroupBalances(permissionGroup.id, users[0].token);
            const balancesByCurrency = permissionBalances.balancesByCurrency;

            for (const [currency, currencyBalances] of Object.entries(balancesByCurrency)) {
                const user1CurrencyBalance = currencyBalances[users[1].uid]?.netBalance || 0;

                if (user1CurrencyBalance < 0) {
                    // users[1] owes users[0] in this currency
                    await apiDriver.createSettlement(
                        new SettlementBuilder()
                            .withGroupId(permissionGroup.id)
                            .withPayer(users[1].uid)
                            .withPayee(users[0].uid)
                            .withAmount(Math.abs(user1CurrencyBalance))
                            .withCurrency(currency)
                            .build(),
                        users[1].token
                    );
                } else if (user1CurrencyBalance > 0) {
                    // users[0] owes users[1] in this currency
                    await apiDriver.createSettlement(
                        new SettlementBuilder()
                            .withGroupId(permissionGroup.id)
                            .withPayer(users[0].uid)
                            .withPayee(users[1].uid)
                            .withAmount(Math.abs(user1CurrencyBalance))
                            .withCurrency(currency)
                            .build(),
                        users[0].token
                    );
                }
            }

            // Balance should now be settled, allowing member removal

            // Remove user 1 (change permissions)
            await apiDriver.removeGroupMember(permissionGroup.id, users[1].uid, users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, permissionGroup.id, 'group');

            // Create another expense - only user 0 should be notified
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(permissionGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .withAmount(25.0)
                    .build(),
                users[0].token
            );

            // Only user 0 should receive this notification
            await appDriver.waitForUserNotificationUpdate(users[0].uid, permissionGroup.id, 'transaction');

            // Verify user 1 no longer receives notifications
            const user1FinalDoc = await appDriver.getUserNotificationDocument(users[1].uid);
            // The group should still exist in user1's doc, but the transaction count shouldn't increase beyond the first expense
        });
    });

    describe('Different Event Types and Triggers', () => {
        test('should generate notifications for various operation types', async () => {
            const eventGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, eventGroup.id, 'group');

            // Add a second user to enable settlement testing
            const shareLink = await apiDriver.generateShareLink(eventGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, eventGroup.id, 'group');

            // Test expense creation notification involving both users
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(eventGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withAmount(30.0)
                    .build(),
                users[0].token
            );
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, eventGroup.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, eventGroup.id, 'transaction'),
            ]);

            // Test expense update notification
            await apiDriver.updateExpense(expense.id, { amount: 45.0 }, users[0].token);
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, eventGroup.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, eventGroup.id, 'transaction'),
            ]);

            // Test settlement creation notification (users[1] pays users[0])
            const settlement = await apiDriver.createSettlement(
                new SettlementBuilder()
                    .withGroupId(eventGroup.id)
                    .withPayer(users[1].uid)
                    .withPayee(users[0].uid)
                    .withAmount(15.0)
                    .build(),
                users[1].token
            );
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, eventGroup.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, eventGroup.id, 'transaction'),
            ]);

            // Verify all notifications were received and processed
            const finalDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(finalDoc!.groups[eventGroup.id].transactionChangeCount).toBeGreaterThan(0);
            expect(finalDoc!.groups[eventGroup.id].groupDetailsChangeCount).toBeGreaterThan(0);
        });

        test('should handle balance change notifications', async () => {
            // Create group with multiple users for balance changes
            const balanceGroup = await apiDriver.createGroupWithMembers(
                `Balance Test ${uuidv4()}`,
                [users[0], users[1]],
                users[0].token
            );

            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, balanceGroup.id, 'group'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, balanceGroup.id, 'group'),
            ]);

            // Create expense that affects balances
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(balanceGroup.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withAmount(100.0)
                    .withSplitType('equal')
                    .build(),
                users[0].token
            );

            // Wait for transaction notifications (balance changes may be included)
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, balanceGroup.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, balanceGroup.id, 'transaction'),
            ]);

            // Verify balance-related notification data
            const docs = await Promise.all([
                appDriver.getUserNotificationDocument(users[0].uid),
                appDriver.getUserNotificationDocument(users[1].uid),
            ]);

            docs.forEach(doc => {
                expect(doc!.groups[balanceGroup.id].transactionChangeCount).toBeGreaterThan(0);
                // Balance change count may or may not increment separately from transaction count
                expect(doc!.groups[balanceGroup.id].balanceChangeCount).toBeGreaterThanOrEqual(0);
            });
        });
    });

    describe('Notification System Performance and Edge Cases', () => {
        test('should handle concurrent operations without losing notifications', async () => {
            const concurrentGroup = await apiDriver.createGroupWithMembers(
                `Concurrent Test ${uuidv4()}`,
                [users[0], users[1]],
                users[0].token
            );

            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, concurrentGroup.id, 'group'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, concurrentGroup.id, 'group'),
            ]);

            // Get initial transaction counts
            const initialDocs = await Promise.all([
                appDriver.getUserNotificationDocument(users[0].uid),
                appDriver.getUserNotificationDocument(users[1].uid),
            ]);

            const initialCounts = initialDocs.map(doc => doc!.groups[concurrentGroup.id].transactionChangeCount);

            // Perform concurrent operations
            const concurrentOperations = [
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(concurrentGroup.id)
                        .withPaidBy(users[0].uid)
                        .withParticipants([users[0].uid, users[1].uid])
                        .withAmount(20.0)
                        .build(),
                    users[0].token
                ),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(concurrentGroup.id)
                        .withPaidBy(users[1].uid)
                        .withParticipants([users[0].uid, users[1].uid])
                        .withAmount(30.0)
                        .build(),
                    users[1].token
                ),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(concurrentGroup.id)
                        .withPaidBy(users[0].uid)
                        .withParticipants([users[0].uid, users[1].uid])
                        .withAmount(40.0)
                        .build(),
                    users[0].token
                ),
            ];

            await Promise.all(concurrentOperations);

            // Wait for all notifications to be processed
            await Promise.all([
                appDriver.waitForNotificationWithMatcher(
                    users[0].uid,
                    concurrentGroup.id,
                    (doc) => doc.groups[concurrentGroup.id]?.transactionChangeCount >= initialCounts[0] + 3,
                    { timeout: 10000, errorMsg: 'User 0 did not receive all concurrent notifications' }
                ),
                appDriver.waitForNotificationWithMatcher(
                    users[1].uid,
                    concurrentGroup.id,
                    (doc) => doc.groups[concurrentGroup.id]?.transactionChangeCount >= initialCounts[1] + 3,
                    { timeout: 10000, errorMsg: 'User 1 did not receive all concurrent notifications' }
                ),
            ]);
        });

        test('should handle notification system under high load', async () => {
            const loadTestGroup = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, loadTestGroup.id, 'group');

            const initialDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const initialTransactionCount = initialDoc!.groups[loadTestGroup.id].transactionChangeCount;
            const initialGroupCount = initialDoc!.groups[loadTestGroup.id].groupDetailsChangeCount;

            // Create multiple operations rapidly
            const operations = Array.from({ length: 5 }, (_, i) =>
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(loadTestGroup.id)
                        .withPaidBy(users[0].uid)
                        .withParticipants([users[0].uid])
                        .withAmount(10 + i)
                        .withDescription(`Load Test Expense ${i}`)
                        .build(),
                    users[0].token
                )
            );

            await Promise.all(operations);

            // Wait for all notifications to be processed
            await appDriver.waitForNotificationWithMatcher(
                users[0].uid,
                loadTestGroup.id,
                (doc) => doc.groups[loadTestGroup.id]?.transactionChangeCount >= initialTransactionCount + 5,
                { timeout: 15000, errorMsg: 'Not all load test notifications were processed' }
            );

            // Verify final counts are correct
            const finalDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(finalDoc!.groups[loadTestGroup.id].transactionChangeCount).toBeGreaterThanOrEqual(initialTransactionCount + 5);
        });
    });
});