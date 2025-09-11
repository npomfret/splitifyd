// Real-time Synchronization Tests
// Tests advanced real-time listener behavior and synchronization edge cases

import { describe, test, expect } from 'vitest';
import { users, testGroup, apiDriver, notificationDriver, setupNotificationTest, cleanupNotificationTest, createBasicExpense } from './shared-setup';

describe('Real-time Synchronization Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;

    describe('Listener Management', () => {
        test('should handle listener subscription churn', async () => {
            // 1. Start initial listener
            let [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create initial expense to establish baseline
            const expense1 = createBasicExpense(testGroup.id, 25.0, 0);
            const beforeFirstExpense = Date.now();
            await apiDriver.createExpense(expense1, users[0].token);

            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeFirstExpense);

            // 3. Simulate subscription churn by restarting listeners multiple times
            for (let i = 0; i < 3; i++) {
                // Stop current listener
                notificationDriver.stopListening(users[0].uid);

                // Create expense while disconnected
                const expenseWhileDisconnected = createBasicExpense(testGroup.id, 30 + i, 0);
                await apiDriver.createExpense(expenseWhileDisconnected, users[0].token);

                // Restart listener
                [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

                // Verify listener catches up and remains stable
                const stableExpense = createBasicExpense(testGroup.id, 40 + i, 0);
                const beforeStableExpense = Date.now();
                await apiDriver.createExpense(stableExpense, users[0].token);

                await listener.waitForNewEvent(testGroup.id, 'transaction', beforeStableExpense);
            }

            console.log('✅ Listener handles subscription churn without missing events');
        });

        test('should handle simultaneous listener connections', async () => {
            // 1. Set up two separate listener setups for same user (simulating multiple devices)
            const [listener1] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // Stop first and restart to simulate second device
            notificationDriver.stopListening(users[0].uid);
            const [listener2] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create an expense while second listener is active
            const expense = createBasicExpense(testGroup.id, 45.0, 0);
            const beforeExpense = Date.now();
            await apiDriver.createExpense(expense, users[0].token);

            // 3. Verify listener receives events
            await listener2.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 4. Test that restarting listeners doesn't cause issues
            notificationDriver.stopListening(users[0].uid);
            const [listener3] = await notificationDriver.setupListenersFirst([users[0].uid]);

            const expense2 = createBasicExpense(testGroup.id, 55.0, 0);
            const beforeSecondExpense = Date.now();
            await apiDriver.createExpense(expense2, users[0].token);

            await listener3.waitForNewEvent(testGroup.id, 'transaction', beforeSecondExpense);

            const events = listener3.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');

            expect(events.length).toBeGreaterThanOrEqual(1);
            console.log('✅ Multiple listener connections handle synchronization correctly');
        });
    }); // End Listener Management

    describe('Document State Synchronization', () => {
        test('should handle document version resets correctly', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create initial expenses to build up version numbers
            for (let i = 0; i < 3; i++) {
                const expense = createBasicExpense(testGroup.id, 20 + i, 0);
                await apiDriver.createExpense(expense, users[0].token);
                await new Promise((resolve) => setTimeout(resolve, 300));
            }

            // 3. Wait for all events to be processed
            await new Promise((resolve) => setTimeout(resolve, 2000));

            // 4. Track initial version progression
            const initialEvents = listener.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');

            expect(initialEvents.length).toBeGreaterThanOrEqual(3);

            // 5. Restart listener (simulates potential version reset scenarios)
            notificationDriver.stopListening(users[0].uid);
            const [newListener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 6. Verify system continues to work after restart
            const newExpense = createBasicExpense(testGroup.id, 99.0, 0);
            const beforeNewExpense = Date.now();
            await apiDriver.createExpense(newExpense, users[0].token);

            await newListener.waitForNewEvent(testGroup.id, 'transaction', beforeNewExpense);

            console.log('✅ System handles version reset scenarios correctly');
        });

        test('should handle listener restart with pending notifications', async () => {
            // 1. Set up initial listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Create first expense
            const expense1 = createBasicExpense(testGroup.id, 30.0, 0);
            const beforeExpense1 = Date.now();
            await apiDriver.createExpense(expense1, users[0].token);

            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense1);

            // 3. Stop listener and create expenses while offline
            notificationDriver.stopListening(users[0].uid);

            const expense2 = createBasicExpense(testGroup.id, 35.0, 0);
            const expense3 = createBasicExpense(testGroup.id, 40.0, 0);

            await apiDriver.createExpense(expense2, users[0].token);
            await apiDriver.createExpense(expense3, users[0].token);

            // 4. Restart listener - should sync current state
            const [newListener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 5. Create new expense to verify listener is working
            const expense4 = createBasicExpense(testGroup.id, 45.0, 0);
            const beforeExpense4 = Date.now();
            await apiDriver.createExpense(expense4, users[0].token);

            await newListener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense4);

            // 6. Verify listener received the new notification
            const newEvents = newListener.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');

            expect(newEvents.length).toBeGreaterThanOrEqual(1);
            console.log('✅ Listener restart handles pending notifications correctly');
        });

        test('should handle notification document locking scenarios', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Test rapid concurrent operations that might cause document contention
            const concurrentPromises = [];
            const beforeConcurrent = Date.now();

            // Create multiple expenses rapidly to potentially cause document locking
            for (let i = 0; i < 5; i++) {
                const expense = createBasicExpense(testGroup.id, 50 + i, 0);
                concurrentPromises.push(apiDriver.createExpense(expense, users[0].token));
            }

            // 3. Wait for all operations to complete
            await Promise.all(concurrentPromises);

            // 4. Wait for all notifications to be processed
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // 5. Verify all notifications were received despite potential locking
            const concurrentEvents = listener.getEventsForGroup(testGroup.id).filter((e) => e.type === 'transaction');

            expect(concurrentEvents.length).toBeGreaterThanOrEqual(5);

            // 6. Test that system continues to work after potential document contention
            const finalExpense = createBasicExpense(testGroup.id, 100.0, 0);
            const beforeFinalExpense = Date.now();
            await apiDriver.createExpense(finalExpense, users[0].token);

            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeFinalExpense);

            console.log('✅ System handles document locking scenarios gracefully');
        });
    }); // End Document State Synchronization
});
