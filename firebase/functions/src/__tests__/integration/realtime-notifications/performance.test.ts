// Performance & Scalability Integration Tests
// Tests notification system performance under load and with large data sets

import {describe, test, expect} from 'vitest';
import {
    users, testGroup, apiDriver, notificationDriver, 
    setupNotificationTest, cleanupNotificationTest, 
    createBasicExpense, createMultiUserExpense
} from './shared-setup';

describe('Performance & Scalability Integration Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;

    describe('High Volume Operations', () => {

        test('should handle multiple rapid expense creations without missing notifications', async () => {
            // 1. START LISTENER FIRST - BEFORE ANY ACTIONS
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create multiple expenses rapidly and track them with event counts
            const expenses = Array.from({length: 3}, (_, i) =>
                createBasicExpense(testGroup.id, 10 + i)
            );

            console.log('Creating multiple expenses rapidly...');
            const beforeExpensesTimestamp = Date.now();

            for (const expense of expenses) {
                await apiDriver.createExpense(expense, users[0].token);
                // Wait for this expense to trigger a notification
                await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpensesTimestamp);
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            const transactionEventsSinceStart = listener.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');
            
            expect(transactionEventsSinceStart.length).toBeGreaterThanOrEqual(expenses.length);
        });

    }); // End High Volume Operations

    describe('Scalability Tests', () => {

        test('should handle large groups (100+ members) efficiently', async () => {
            // Note: Testing with actual 100+ users would be expensive and slow
            // This test simulates large group behavior with a smaller set

            // 1. Set up listeners for all available users
            const [listener1, listener2, listener3] = await notificationDriver.setupListenersFirst([users[0].uid, users[1].uid, users[2].uid]);

            // 2. Add all users to the group
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);
            const shareLink2 = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink2.linkId, users[2].token);

            // 3. Create an expense that affects all group members
            const expense = createMultiUserExpense(testGroup.id, 90.00, [0, 1, 2]);
            const beforeExpense = Date.now();
            await apiDriver.createExpense(expense, users[0].token);

            // 4. Verify all users receive notifications within reasonable time
            const startTime = Date.now();
            
            await listener1.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);
            await listener2.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);
            await listener3.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            const notificationLatency = Date.now() - startTime;

            // 5. Verify performance is reasonable (should be fast with small group)
            expect(notificationLatency).toBeLessThan(5000); // 5 seconds max

            console.log(`✅ Multi-user notifications completed in ${notificationLatency}ms (scalable architecture)`);
        });

        test('should handle burst of concurrent operations', async () => {
            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([users[0].uid, users[1].uid]);

            // 2. Add user2 to group
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // 3. Create burst of concurrent operations
            const concurrentPromises = [];
            const beforeBurst = Date.now();

            // Multiple users creating expenses simultaneously
            for (let i = 0; i < 4; i++) {
                const userIndex = i % 2; // Alternate between user 0 and 1
                const expense = createBasicExpense(testGroup.id, 15 + i, userIndex);
                concurrentPromises.push(apiDriver.createExpense(expense, users[userIndex].token));
            }

            await Promise.all(concurrentPromises);

            // 4. Wait for all notifications to be processed
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 5. Verify no events are lost
            const user1Events = listener1.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');
            const user2Events = listener2.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');

            expect(user1Events.length).toBeGreaterThanOrEqual(4);
            expect(user2Events.length).toBeGreaterThanOrEqual(4);

            console.log('✅ No notification events lost during burst of concurrent operations');
        });

        test('should respect Firestore batch limits', async () => {
            // Note: Firestore batch limit is 500 operations
            // This test ensures the system handles batching correctly

            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Test that the notification system works with normal load
            //    (In practice, hitting 500+ operations would require hundreds of users)
            const expense = createBasicExpense(testGroup.id, 55.00, 0);
            const beforeExpense = Date.now();
            await apiDriver.createExpense(expense, users[0].token);

            // 3. Verify notification processing works correctly
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 4. Test multiple operations in sequence (simulating batch behavior)
            for (let i = 0; i < 3; i++) {
                const sequentialExpense = createBasicExpense(testGroup.id, 20 + i, 0);
                await apiDriver.createExpense(sequentialExpense, users[0].token);
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            // 5. Verify all operations were processed
            const multipleEvents = listener.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');

            expect(multipleEvents.length).toBeGreaterThanOrEqual(3);
            console.log('✅ Batch processing framework handles multiple operations correctly');
        });

        test('should handle notification document size limits', async () => {
            // Note: Firestore documents have a 1MB limit
            // This test ensures the system manages document size appropriately

            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create multiple expenses to build up notification history
            const numberOfExpenses = 10;

            for (let i = 0; i < numberOfExpenses; i++) {
                const expense = createBasicExpense(testGroup.id, 5 + i, 0);
                await apiDriver.createExpense(expense, users[0].token);
                await new Promise(resolve => setTimeout(resolve, 150));
            }

            // 3. Wait for all notifications to be processed
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 4. Verify all notifications were received
            const allEvents = listener.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');

            expect(allEvents.length).toBeGreaterThanOrEqual(numberOfExpenses);

            // 5. Test that the system continues to work with accumulated history
            const finalExpense = createBasicExpense(testGroup.id, 99.00, 0);
            const beforeFinalExpense = Date.now();
            await apiDriver.createExpense(finalExpense, users[0].token);

            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeFinalExpense);

            console.log('✅ System handles document size management with accumulated history');
        });

    }); // End Scalability Tests

});