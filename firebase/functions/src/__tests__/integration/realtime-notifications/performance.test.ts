// Performance & Scalability Integration Tests
// Tests notification system performance under load and with large data sets

import { describe, test, expect } from 'vitest';
import { CreateExpenseRequestBuilder } from '@splitifyd/test-support';
import { user1, user2, user3, testGroup, apiDriver, notificationDriver, setupNotificationTest, cleanupNotificationTest } from './shared-setup';

describe('Performance & Scalability Integration Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;

    describe('High Volume Operations', () => {
        test('should handle multiple rapid expense creations without missing notifications', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create multiple expenses in parallel (truly rapid)
            const expensePromises = [];
            for (let i = 0; i < 5; i++) {
                expensePromises.push(apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 10 + i));
            }
            await Promise.all(expensePromises);

            // 3. Wait for all notifications to arrive
            await listener.waitForEventCount(testGroup.id, 'transaction', 5);

            console.log('✅ All rapid expense notifications received without loss');
        });
    }); // End High Volume Operations

    describe('Scalability Tests', () => {
        test('should handle multi-user notifications efficiently', async () => {
            // 1. Set up listeners for all users
            const [listener1, listener2, listener3] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid, user3.uid]);

            // 2. Add all users to the group in parallel
            const shareLink = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await Promise.all([
                apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token),
                apiDriver.joinGroupViaShareLink(shareLink.linkId, user3.token)
            ]);

            // 3. Create an expense that affects all group members
            await apiDriver.createMultiUserExpense(testGroup.id, user1.uid, user1.token, [user1.uid, user2.uid, user3.uid], 90.0);

            // 4. Verify all users receive notifications
            await Promise.all([
                listener1.waitForEventCount(testGroup.id, 'transaction', 1),
                listener2.waitForEventCount(testGroup.id, 'transaction', 1),
                listener3.waitForEventCount(testGroup.id, 'transaction', 1)
            ]);

            console.log('✅ Multi-user notifications delivered to all participants');
        });

        test('should handle burst of concurrent operations', async () => {
            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([user1.uid, user2.uid]);

            // 2. Add user2 to group
            const shareLink = await apiDriver.generateShareLink(testGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // 3. Create burst of concurrent operations
            const concurrentPromises = [];

            // Multiple users creating expenses simultaneously
            for (let i = 0; i < 4; i++) {
                const userIndex = i % 2; // Alternate between user 0 and 1
                const users = [user1, user2];
                concurrentPromises.push(apiDriver.createBasicExpense(testGroup.id, users[userIndex].uid, users[userIndex].token, 15 + i));
            }

            await Promise.all(concurrentPromises);

            // 4. Wait for all notifications to be processed
            await Promise.all([
                listener1.waitForEventCount(testGroup.id, 'transaction', 4),
                listener2.waitForEventCount(testGroup.id, 'transaction', 4)
            ]);

            // 5. Verify no events are lost
            const user1Events = listener1.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');
            const user2Events = listener2.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');

            expect(user1Events.length).toBeGreaterThanOrEqual(4);
            expect(user2Events.length).toBeGreaterThanOrEqual(4);

            console.log('✅ No notification events lost during burst of concurrent operations');
        });

        test('should handle parallel expense creation efficiently', async () => {
            // Test that multiple parallel operations don't cause notification system issues

            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create multiple expenses in parallel to stress test the system
            const batchPromises = [];
            for (let i = 0; i < 10; i++) {
                batchPromises.push(apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 20 + i));
            }
            await Promise.all(batchPromises);

            // 3. Verify all operations triggered notifications
            await listener.waitForEventCount(testGroup.id, 'transaction', 10);

            console.log('✅ Parallel expense creation handled efficiently');
        });

        test('should handle reasonably large expense descriptions', async () => {
            // Test realistic large descriptions (like pasting a receipt)
            // This ensures the system handles detailed expense info without breaking notifications

            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create a large description (~5KB of generated text)
            const detailedReceipt = 'Large expense description test data: ' + 'X'.repeat(5 * 1024); // ~5KB

            // 3. Create expense with detailed description
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(testGroup.id)
                    .withDescription(detailedReceipt.trim())
                    .withAmount(325.14)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .withSplitType('equal')
                    .build(),
                user1.token
            );

            // 4. Verify notification is processed correctly with large but realistic description
            await listener.waitForEventCount(testGroup.id, 'transaction', 1);

            console.log('✅ System handles detailed expense descriptions (receipts) without issues');
        });
    }); // End Scalability Tests
});
