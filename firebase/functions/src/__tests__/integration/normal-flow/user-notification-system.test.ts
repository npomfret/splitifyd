import {beforeEach, describe, expect, it} from 'vitest';
import {CreateGroupRequestBuilder, ExpenseBuilder, SettlementBuilder, AppDriver, ApiDriver, borrowTestUsers, generateShortId} from '@splitifyd/test-support';
import {getFirestore} from "../../../firebase";
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";

describe('User Notification System Integration Tests', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, getFirestore());

    let users: AuthenticatedFirebaseUser[];

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

            // Get initial change count
            let notificationDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const initialCount = notificationDoc!.groups[group.id].groupDetailsChangeCount;

            // Update the group (only send name, avoid currency field that's not allowed)
            await apiDriver.updateGroup(group.id, { name: 'Updated Name' }, users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            // Verify count incremented
            notificationDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(notificationDoc!.groups[group.id].groupDetailsChangeCount).toBe(initialCount + 1);
        });

        it('should handle rapid multiple group updates', async () => {
            // Create group
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            const initialDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const initialCount = initialDoc!.groups[group.id].groupDetailsChangeCount;

            // Make 3 rapid updates (only send name, avoid currency field that's not allowed)
            await apiDriver.updateGroup(group.id, { name: 'Update 1' }, users[0].token);
            await apiDriver.updateGroup(group.id, { name: 'Update 2' }, users[0].token);
            await apiDriver.updateGroup(group.id, { name: 'Update 3' }, users[0].token);

            // Wait for all updates to be processed
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            // Verify all updates were counted
            const finalDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(finalDoc!.groups[group.id].groupDetailsChangeCount).toBe(initialCount + 3);
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
            await apiDriver.assertExpense(group.id, expense.id, users[0].token);

            // Wait for initial notifications
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance');

            // Get initial counts
            let notificationDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const initialTransactionCount = notificationDoc!.groups[group.id].transactionChangeCount;
            const initialBalanceCount = notificationDoc!.groups[group.id].balanceChangeCount;
            console.log('🔍 INITIAL COUNTS:', { initialTransactionCount, initialBalanceCount });

            // Update expense (only send amount, avoid splits)
            console.log('🔨 UPDATING EXPENSE...');
            await apiDriver.updateExpense(expense.id, { amount: 200 }, users[0].token);

            // Wait for update notifications with expected counts
            console.log('⏳ WAITING FOR TRANSACTION UPDATE...');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction', 5000, initialTransactionCount + 1);
            console.log('⏳ WAITING FOR BALANCE UPDATE...');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance', 5000, initialBalanceCount + 1);

            // Verify counts incremented
            notificationDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const finalTransactionCount = notificationDoc!.groups[group.id].transactionChangeCount;
            const finalBalanceCount = notificationDoc!.groups[group.id].balanceChangeCount;
            console.log('🔍 FINAL COUNTS:', { finalTransactionCount, finalBalanceCount });
            console.log('📊 EXPECTED:', { transaction: initialTransactionCount + 1, balance: initialBalanceCount + 1 });
            
            expect(notificationDoc!.groups[group.id].transactionChangeCount).toBe(initialTransactionCount + 1);
            expect(notificationDoc!.groups[group.id].balanceChangeCount).toBe(initialBalanceCount + 1);
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

            // Wait for all notifications to be processed with expected counts
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction', 5000, initialTransactionCount + 3);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance', 5000, initialBalanceCount + 3);

            // Verify all updates were counted
            const finalDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(finalDoc!.groups[group.id].transactionChangeCount).toBe(initialTransactionCount + 3);
            expect(finalDoc!.groups[group.id].balanceChangeCount).toBe(initialBalanceCount + 3);
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

            // Wait for deletion notifications with expected counts
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction', 5000, beforeTransactionCount + 1);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance', 5000, beforeBalanceCount + 1);

            // Verify counts incremented (soft delete triggers updates)
            const afterDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(afterDoc!.groups[group.id].transactionChangeCount).toBe(beforeTransactionCount + 1);
            expect(afterDoc!.groups[group.id].balanceChangeCount).toBe(beforeBalanceCount + 1);
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
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance');
            await appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'balance');

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
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance');

            await appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'group');
            await appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'transaction');
            await appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'balance');

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