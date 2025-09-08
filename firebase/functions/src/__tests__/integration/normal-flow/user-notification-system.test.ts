import {beforeEach, describe, expect, it} from 'vitest';
import {CreateGroupRequestBuilder, ExpenseBuilder, SettlementBuilder, AppDriver, ApiDriver, borrowTestUsers, generateShortId} from '@splitifyd/test-support';
import {getFirestore} from "../../../firebase";
import {UserToken} from "@splitifyd/shared";

describe('User Notification System Integration Tests', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, getFirestore());

    let users: UserToken[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
    });

    describe('Group Notifications', () => {
        it('should create user notification document when group is created', async () => {
            // Create a group
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            // Verify notification document was created and updated
            const notificationDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(notificationDoc).toBeTruthy();
            expect(notificationDoc!.groups[group.id]).toBeDefined();
            expect(notificationDoc!.groups[group.id].groupDetailsChangeCount).toBeGreaterThan(0);
            expect(notificationDoc!.groups[group.id].lastGroupDetailsChange).toBeTruthy();
        });

        it('should increment group change count when group is updated', async () => {
            // Create group and wait for initial notification
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            // Get initial change count using polling to ensure document is fully updated
            const initialDoc = await appDriver.waitForNotificationWithMatcher(
                users[0].uid,
                group.id,
                (doc) => doc.groups[group.id]?.groupDetailsChangeCount > 0,
                { timeout: 3000, errorMsg: 'Failed to get initial group change count' }
            );
            const initialCount = initialDoc.groups[group.id].groupDetailsChangeCount;

            // Update the group (only send name, avoid currency field that's not allowed)
            await apiDriver.updateGroup(group.id, { name: 'Updated Name' }, users[0].token);

            // Wait for the count to increment using polling
            const finalDoc = await appDriver.waitForNotificationWithMatcher(
                users[0].uid,
                group.id,
                (doc) => doc.groups[group.id]?.groupDetailsChangeCount >= initialCount + 1,
                { timeout: 5000, errorMsg: 'Failed to detect group update notification' }
            );

            // Verify count incremented
            expect(finalDoc.groups[group.id].groupDetailsChangeCount).toBe(initialCount + 1);
        });

        it('should handle rapid multiple group updates', async () => {
            // Create group
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            const initialDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const initialCount = initialDoc!.groups[group.id].groupDetailsChangeCount;

            await Promise.all([
                apiDriver.updateGroup(group.id, { name: 'Update 1' }, users[0].token),
                apiDriver.updateGroup(group.id, { name: 'Update 2' }, users[0].token),
                apiDriver.updateGroup(group.id, { name: 'Update 3' }, users[0].token),
            ]);

            // Wait for all 3 updates to be processed using custom matcher
            const expectedGroupDetailsChangeCount = initialCount + 3;
            await appDriver.waitForGroupDetailsChangeCount(group.id, users[0].uid, expectedGroupDetailsChangeCount);
        });

        it('should notify all group members when member is added', async () => {
            // Create group with multiple members
            const group = await apiDriver.createGroupWithMembers('Multi-member Group', [users[0], users[1]], users[0].token);

            // Wait for both users to receive notifications
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');
            await appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'group');

            // Verify both users have notification documents
            const user0Doc = await appDriver.getUserNotificationDocument(users[0].uid);
            const user1Doc = await appDriver.getUserNotificationDocument(users[1].uid);

            expect(user0Doc!.groups[group.id]).toBeDefined();
            expect(user1Doc!.groups[group.id]).toBeDefined();

            expect(user0Doc!.groups[group.id].groupDetailsChangeCount).toBeGreaterThan(0);
            expect(user1Doc!.groups[group.id].groupDetailsChangeCount).toBeGreaterThan(0);
        });
    });

    describe('Expense Notifications', () => {
        it('should notify users when expense is created', async () => {
            // Create group and expense
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .build(),
                users[0].token
            );

            // Wait for both transaction and balance notifications
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance');

            // Verify notification document was updated
            const notificationDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(notificationDoc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(notificationDoc!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);
            expect(notificationDoc!.groups[group.id].lastTransactionChange).toBeTruthy();
            expect(notificationDoc!.groups[group.id].lastBalanceChange).toBeTruthy();
        });

        it('should notify multiple users for multi-participant expense', async () => {
            // Create group with multiple members
            const group = await apiDriver.createGroupWithMembers(`Multi-user Expense Group ${generateShortId()}`, [users[0], users[1]], users[0].token);

            // Create expense with multiple participants
            await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .build(),
                users[0].token
            );

            // Wait for both users to receive transaction and balance notifications
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance');
            await appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'balance');

            // Verify both users received notifications
            const user0Doc = await appDriver.getUserNotificationDocument(users[0].uid);
            const user1Doc = await appDriver.getUserNotificationDocument(users[1].uid);

            expect(user0Doc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(user1Doc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(user0Doc!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);
            expect(user1Doc!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);
        });

        it('should handle expense updates correctly', async () => {
            // Create group and expense
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .build(),
                users[0].token
            );

            // Wait for initial notifications and get counts
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance');

            const initialDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const initialTransactionCount = initialDoc!.groups[group.id].transactionChangeCount;
            const initialBalanceCount = initialDoc!.groups[group.id].balanceChangeCount;

            // Update expense (only send amount, avoid splits)
            await apiDriver.updateExpense(expense.id, { amount: 200 }, users[0].token);

            // Wait for both transaction and balance counts to increment
            const expectedTransactionCount = initialTransactionCount + 1;
            const expectedBalanceCount = initialBalanceCount + 1;
            await appDriver.waitForTransactionAndBalanceChangeCounts(group.id, users[0].uid, expectedTransactionCount, expectedBalanceCount);
        });

        it('should handle multiple rapid expense updates', async () => {
            // Create group and expense
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .build(),
                users[0].token
            );

            // Wait for initial notifications and get counts
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance');

            const initialDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const initialTransactionCount = initialDoc!.groups[group.id].transactionChangeCount;
            const initialBalanceCount = initialDoc!.groups[group.id].balanceChangeCount;

            // Make 3 rapid updates (only send description, avoid splits)
            await apiDriver.updateExpense(expense.id, { description: 'Update 1' }, users[0].token);
            await apiDriver.updateExpense(expense.id, { description: 'Update 2' }, users[0].token);
            await apiDriver.updateExpense(expense.id, { description: 'Update 3' }, users[0].token);

            // Wait for all 3 updates to be processed
            const expectedTransactionCount = initialTransactionCount + 3;
            const expectedBalanceCount = initialBalanceCount + 3;
            await appDriver.waitForTransactionAndBalanceChangeCounts(group.id, users[0].uid, expectedTransactionCount, expectedBalanceCount);
        });

        it('should handle expense deletion (soft delete)', async () => {
            // Create group and expense
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .build(),
                users[0].token
            );

            // Wait for creation notifications and get counts
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance');

            const beforeDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const beforeTransactionCount = beforeDoc!.groups[group.id].transactionChangeCount;
            const beforeBalanceCount = beforeDoc!.groups[group.id].balanceChangeCount;

            // Delete expense (soft delete)
            await apiDriver.deleteExpense(expense.id, users[0].token);

            // Wait for deletion notifications (soft delete triggers updates)
            const expectedTransactionCount = beforeTransactionCount + 1;
            const expectedBalanceCount = beforeBalanceCount + 1;
            await appDriver.waitForTransactionAndBalanceChangeCounts(group.id, users[0].uid, expectedTransactionCount, expectedBalanceCount);
        });
    });

    describe('Settlement Notifications', () => {
        it('should notify users when settlement is created', async () => {
            // Create group with multiple members
            const group = await apiDriver.createGroupWithMembers(`Settlement Group ${generateShortId()}`, [users[0], users[1]], users[0].token);

            // Wait for initial group notifications
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');
            await appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'group');

            // Create settlement
            await apiDriver.createSettlement(
                new SettlementBuilder()
                    .withGroupId(group.id)
                    .withPayer(users[0].uid)
                    .withPayee(users[1].uid)
                    .build(),
                users[0].token
            );

            // Wait for settlement and balance notifications for both users
            await appDriver.waitForMultiUserTransactionAndBalanceNotifications(group.id, [users[0].uid, users[1].uid]);

            // Verify both users received transaction and balance notifications
            const user0Doc = await appDriver.getUserNotificationDocument(users[0].uid);
            const user1Doc = await appDriver.getUserNotificationDocument(users[1].uid);

            expect(user0Doc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(user1Doc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(user0Doc!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);
            expect(user1Doc!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);
        });
    });

    describe('Cross-entity Notifications', () => {
        it('should track notifications across multiple entity types', async () => {
            // Create group with multiple members
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            const shareResponse = await apiDriver.generateShareLink(group.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);

            // Create expense
            await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid, users[1].uid])
                    .withSplitType('equal')
                    .withAmount(100)
                    .withSplits([
                        { userId: users[0].uid, amount: 50 },
                        { userId: users[1].uid, amount: 50 }
                    ])
                    .build(),
                users[0].token
            );

            // Create settlement
            await apiDriver.createSettlement(
                new SettlementBuilder()
                    .withGroupId(group.id)
                    .withPayer(users[1].uid)
                    .withPayee(users[0].uid)
                    .build(),
                users[1].token
            );

            // Wait for all notifications to be processed in parallel across all users and change types
            await appDriver.waitForMultiUserAllNotifications(group.id, [users[0].uid, users[1].uid]);

            // Verify both users have comprehensive notification tracking
            const user0Doc = await appDriver.getUserNotificationDocument(users[0].uid);
            const user1Doc = await appDriver.getUserNotificationDocument(users[1].uid);

            // Both users should have all types of change counts > 0
            expect(user0Doc!.groups[group.id].groupDetailsChangeCount).toBeGreaterThan(0);
            expect(user0Doc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(user0Doc!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);

            expect(user1Doc!.groups[group.id].groupDetailsChangeCount).toBeGreaterThan(0);
            expect(user1Doc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(user1Doc!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);

            // Verify change version is incremented
            expect(user0Doc!.changeVersion).toBeGreaterThan(0);
            expect(user1Doc!.changeVersion).toBeGreaterThan(0);
        });
    });
});