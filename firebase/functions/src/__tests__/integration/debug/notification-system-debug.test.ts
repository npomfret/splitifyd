import {beforeEach, describe, expect, it} from 'vitest';
import {CreateGroupRequestBuilder, ExpenseBuilder, SettlementBuilder, AppDriver, ApiDriver, borrowTestUsers} from '@splitifyd/test-support';
import {getFirestore} from "../../../firebase";
import {AuthenticatedFirebaseUser} from "@splitifyd/shared";
import { notificationService } from '../../../services/notification-service';

describe('Notification System Debug Tests', () => {
    const apiDriver = new ApiDriver();
    const appDriver = new AppDriver(apiDriver, getFirestore());

    let users: AuthenticatedFirebaseUser[];

    beforeEach(async () => {
        users = await borrowTestUsers(3);
    });

    describe('Core Notification Flow', () => {
        it('should handle complete expense workflow with detailed logging', async () => {
            console.log('🏗️  Creating group...');
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            console.log('✅ Group created:', group.id);

            console.log('⏳ Waiting for group notification...');
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group', 10000);
            console.log('✅ Group notification received');

            // Verify group notification structure
            let notificationDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(notificationDoc).toBeTruthy();
            expect(notificationDoc!.groups[group.id]).toBeDefined();
            expect(notificationDoc!.groups[group.id].groupDetailsChangeCount).toBeGreaterThan(0);

            console.log('🔨 Creating expense...');
            const expense = await apiDriver.createExpense(
                new ExpenseBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(users[0].uid)
                    .withParticipants([users[0].uid])
                    .withAmount(10)
                    .withSplitType('equal')
                    .build(),
                users[0].token
            );
            console.log('✅ Expense created:', expense.id);

            // Verify both transaction and balance notifications
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction', 10000);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance', 10000);
            console.log('✅ Expense notifications received');

            // Verify final counters
            const finalDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            expect(finalDoc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(finalDoc!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);

            console.log('📊 Final counts:', {
                transaction: finalDoc!.groups[group.id].transactionChangeCount,
                balance: finalDoc!.groups[group.id].balanceChangeCount,
                group: finalDoc!.groups[group.id].groupDetailsChangeCount
            });
        });

        it('should handle multi-user settlement notifications', async () => {
            console.log('🏗️  Creating group with multiple members...');
            const group = await apiDriver.createGroupWithMembers('Settlement Test Group', [users[0], users[1]], users[0].token);
            console.log('✅ Group created with members:', group.id);

            // Wait for both users to receive group notifications
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');
            await appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'group');

            console.log('🔨 Creating settlement...');
            const settlement = await apiDriver.createSettlement(
                new SettlementBuilder()
                    .withGroupId(group.id)
                    .withPayer(users[0].uid)
                    .withPayee(users[1].uid)
                    .withAmount(50.0)
                    .build(),
                users[0].token
            );
            console.log('✅ Settlement created:', settlement.id);

            // Wait for both users to receive transaction and balance notifications
            await Promise.all([
                appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'balance'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'transaction'),
                appDriver.waitForUserNotificationUpdate(users[1].uid, group.id, 'balance')
            ]);

            // Verify both users received notifications
            const user0Doc = await appDriver.getUserNotificationDocument(users[0].uid);
            const user1Doc = await appDriver.getUserNotificationDocument(users[1].uid);

            expect(user0Doc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(user1Doc!.groups[group.id].transactionChangeCount).toBeGreaterThan(0);
            expect(user0Doc!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);
            expect(user1Doc!.groups[group.id].balanceChangeCount).toBeGreaterThan(0);

            console.log('📊 Settlement notification counts:');
            console.log(`User0: tx=${user0Doc!.groups[group.id].transactionChangeCount}, bal=${user0Doc!.groups[group.id].balanceChangeCount}`);
            console.log(`User1: tx=${user1Doc!.groups[group.id].transactionChangeCount}, bal=${user1Doc!.groups[group.id].balanceChangeCount}`);
        });
    });

    describe('Notification Service Direct Testing', () => {
        it('should handle rapid concurrent updates correctly', async () => {
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);
            await appDriver.waitForUserNotificationUpdate(users[0].uid, group.id, 'group');

            console.log('🧪 Testing rapid concurrent updates...');

            // Get initial counts
            const initialDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const initialTransactionCount = initialDoc!.groups[group.id].transactionChangeCount;
            const initialBalanceCount = initialDoc!.groups[group.id].balanceChangeCount;

            // Make rapid concurrent updates
            const updatePromises = [
                notificationService.updateUserNotification(users[0].uid, group.id, 'transaction'),
                notificationService.updateUserNotification(users[0].uid, group.id, 'balance'),
                notificationService.updateUserNotification(users[0].uid, group.id, 'transaction'),
                notificationService.updateUserNotification(users[0].uid, group.id, 'balance'),
                notificationService.updateUserNotification(users[0].uid, group.id, 'transaction')
            ];

            const results = await Promise.all(updatePromises);
            console.log('✅ All concurrent updates completed');
            console.log('Update results:', results.map(r => r.success));

            // Wait for all updates to settle
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check final counts
            const finalDoc = await appDriver.getUserNotificationDocument(users[0].uid);
            const finalTransactionCount = finalDoc!.groups[group.id].transactionChangeCount;
            const finalBalanceCount = finalDoc!.groups[group.id].balanceChangeCount;

            console.log('📊 Concurrent update results:');
            console.log(`Transaction: ${initialTransactionCount} → ${finalTransactionCount} (expected +3)`);
            console.log(`Balance: ${initialBalanceCount} → ${finalBalanceCount} (expected +2)`);

            expect(finalTransactionCount).toBe(initialTransactionCount + 3);
            expect(finalBalanceCount).toBe(initialBalanceCount + 2);
        });

        it('should verify notification service initialization behavior', async () => {
            const testUserId = users[2].uid;
            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), users[0].token);

            console.log('🧪 Testing notification service initialization...');

            // Clean up any existing document first
            await getFirestore().doc(`user-notifications/${testUserId}`).delete();

            // Ensure document doesn't exist initially
            let doc = await appDriver.getUserNotificationDocument(testUserId);
            expect(doc).toBeNull();

            // Test ensureUserInGroup
            await notificationService.ensureUserInGroup(testUserId, group.id);
            console.log('✅ ensureUserInGroup completed');

            // Verify document was created
            doc = await appDriver.getUserNotificationDocument(testUserId);
            expect(doc).toBeTruthy();
            expect(doc!.groups[group.id]).toBeDefined();
            expect(doc!.changeVersion).toBe(0);

            // Test that calling ensureUserInGroup again doesn't reinitialize
            const initialChangeVersion = doc!.changeVersion;
            await notificationService.ensureUserInGroup(testUserId, group.id);

            doc = await appDriver.getUserNotificationDocument(testUserId);
            expect(doc!.changeVersion).toBe(initialChangeVersion); // Should not change

            console.log('✅ Repeat ensureUserInGroup preserved existing data');
        });
    });
});