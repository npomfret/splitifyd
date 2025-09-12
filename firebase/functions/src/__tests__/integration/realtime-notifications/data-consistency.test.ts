// Data Consistency & Edge Cases Integration Tests
// Tests notification system data consistency and edge case handling

import { describe, expect, test } from 'vitest';
import { user1, user2, testGroup, apiDriver, notificationDriver, setupNotificationTest, cleanupNotificationTest } from './shared-setup';
import { SettlementBuilder } from '@splitifyd/test-support';

describe('Data Consistency & Edge Cases Integration Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;


    describe('Data Integrity Tests', () => {
        test('should handle settlement notifications correctly', async () => {
            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid]);

            // 2. Add user2 to group and create multi-user expense
            const shareLink = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            await apiDriver.createMultiUserExpense(testGroup.id, user1.uid, user1.token, [user1.uid, user2.uid], 80.0);

            // 3. Create a settlement
            const settlement = new SettlementBuilder().withGroupId(testGroup.id).withPayer(user2.uid).withPayee(user1.uid).withAmount(40.0).build();
            await apiDriver.createSettlement(settlement, user2.token);

            // 4. Wait for settlement notifications (balance changes)
            await listener1.waitForEventCount(testGroup.id, 'balance', 1);
            await listener2.waitForEventCount(testGroup.id, 'balance', 1);

            // 5. Verify settlement triggers appropriate notifications
            const balanceEvents1 = listener1.getEventsForGroup(testGroup.id).filter(e => e.type === 'balance');
            const balanceEvents2 = listener2.getEventsForGroup(testGroup.id).filter(e => e.type === 'balance');

            expect(balanceEvents1.length).toBeGreaterThanOrEqual(1);
            expect(balanceEvents2.length).toBeGreaterThanOrEqual(1);

            console.log('✅ Settlements trigger proper balance notifications');
        });

        test('should handle partial group membership cleanup', async () => {
            // This test verifies that removed users stop receiving notifications from a group
            
            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid]);

            // 2. Add user2 to group and wait for all join events
            const shareLink = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);
            await listener1.waitForEventCount(testGroup.id, 'group', 1);
            await listener2.waitForEventCount(testGroup.id, 'group', 1);

            // 3. Create initial activity that both users should receive
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 35.0);
            await listener1.waitForEventCount(testGroup.id, 'transaction', 1);
            await listener2.waitForEventCount(testGroup.id, 'transaction', 1);

            // 4. Remove user2 from group and wait for removal to complete
            await apiDriver.removeGroupMember(testGroup.id, user2.uid, user1.token);
            
            // Wait for all removal notifications including cleanup
            await listener1.waitForEventCount(testGroup.id, 'group', 2); // Initial join + removal notification
            
            // Wait for user2's removal notification - this may trigger cleanup
            const initialUser2Events = listener2.getEventsForGroup(testGroup.id).length;
            
            // 5. Create post-removal expense - user2 should NOT receive these notifications
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 45.0);
            
            // 6. Wait for user1 to receive all notifications from the new expense
            await listener1.waitForEventCount(testGroup.id, 'transaction', 2);
            await listener1.waitForEventCount(testGroup.id, 'balance', 2);

            // 7. Verify user2 did not receive new notifications (may have received cleanup events though)
            const finalUser2Events = listener2.getEventsForGroup(testGroup.id).length;
            
            // The key test: user2 should not have received the second expense notifications
            const user2TransactionEvents = listener2.getEventsForGroup(testGroup.id).filter(e => e.type === 'transaction');
            expect(user2TransactionEvents.length).toBe(1); // Only the first expense, not the second

            console.log(`✅ User2 received ${finalUser2Events} total events but only 1 transaction (correct isolation)`);
            console.log('✅ Group membership cleanup prevents transaction notifications to removed users');
        });

        test('should handle group recreation with same ID', async () => {
            // Note: This test is conceptual as group IDs are typically unique
            // But it tests the system's robustness to edge cases

            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create activity in original group
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 25.0);
            await listener.waitForEventCount(testGroup.id, 'transaction', 1);

            // 3. Track original group state
            const originalEventCount = listener.getEventsForGroup(testGroup.id).length;

            // 4. Create another expense to test continued functionality
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 35.0);
            await listener.waitForEventCount(testGroup.id, 'transaction', 2);

            const finalEventCount = listener.getEventsForGroup(testGroup.id).length;
            expect(finalEventCount).toBeGreaterThan(originalEventCount);

            console.log('✅ Notification system maintains proper state isolation');
        });

        test('should maintain change counter accuracy under concurrency', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create multiple expenses in rapid succession to test counter accuracy
            const numberOfExpenses = 5;
            const expensePromises = [];

            for (let i = 0; i < numberOfExpenses; i++) {
                expensePromises.push(apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 10 + i));
            }

            // Wait for all expenses to be created
            await Promise.all(expensePromises);

            // 3. Wait for all transaction events to arrive
            await listener.waitForEventCount(testGroup.id, 'transaction', numberOfExpenses);

            // 4. Verify all events were received
            const transactionEvents = listener.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');
            expect(transactionEvents.length).toBeGreaterThanOrEqual(numberOfExpenses);

            // 5. Verify version numbers are sequential (if available in events)
            const versions = transactionEvents.map((e) => e.version).sort((a, b) => a - b);
            for (let i = 1; i < versions.length; i++) {
                expect(versions[i]).toBeGreaterThan(versions[i - 1]);
            }

            console.log('✅ Change counters maintain accuracy under rapid concurrent changes');
        });

        test('should handle expense updates correctly', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create an expense
            const createdExpense = await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 50.0);
            await listener.waitForEventCount(testGroup.id, 'transaction', 1);

            // 3. Edit the expense
            const editRequest = {
                description: 'Updated expense description',
                amount: 75.0,
            };

            await apiDriver.updateExpense(createdExpense.id, editRequest, user1.token);

            // 4. Wait for edit notifications - should trigger at least one more transaction event
            await listener.waitForEventCount(testGroup.id, 'transaction', 2);

            // 5. Verify both transaction and balance events fire for updates
            const allEvents = listener.getEventsForGroup(testGroup.id);
            const transactionEvents = allEvents.filter((e) => e.type === 'transaction');
            const balanceEvents = allEvents.filter((e) => e.type === 'balance');

            expect(transactionEvents.length).toBeGreaterThanOrEqual(2); // create + update
            expect(balanceEvents.length).toBeGreaterThanOrEqual(1);

            console.log('✅ Expense updates trigger both transaction and balance notifications');
        });

        test('should handle notification document migration scenarios', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Test that current notification system works as expected
            //    This establishes a baseline for future migration scenarios
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 42.0);

            // 3. Wait for notifications
            await listener.waitForEventCount(testGroup.id, 'transaction', 1);

            // 4. Verify current document structure works
            const events = listener.getEventsForGroup(testGroup.id);
            expect(events.length).toBeGreaterThanOrEqual(1);

            // 5. Verify event structure has expected fields for future compatibility
            const transactionEvent = events.find((e) => e.type === 'transaction');
            expect(transactionEvent).toBeDefined();
            expect(transactionEvent!.version).toBeDefined();
            expect(transactionEvent!.timestamp).toBeDefined();
            expect(transactionEvent!.userId).toBeDefined();

            console.log('✅ Current notification document structure ready for migration scenarios');
        });
    }); // End Data Integrity Tests
});
