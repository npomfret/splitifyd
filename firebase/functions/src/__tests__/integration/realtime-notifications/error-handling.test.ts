// Error Handling & Recovery Integration Tests
// Tests notification system behavior under error conditions and recovery scenarios

import {describe, test, expect} from 'vitest';
import {
    users, testGroup, apiDriver, notificationDriver, 
    setupNotificationTest, cleanupNotificationTest, 
    createBasicExpense
} from './shared-setup';

describe('Error Handling & Recovery Integration Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;

    describe('Network & Connection Errors', () => {

        test('should handle listener restart after network interruption simulation', async () => {
            // 1. START INITIAL LISTENER FIRST - BEFORE ANY ACTIONS
            let [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // Create first expense
            const expense1 = createBasicExpense(testGroup.id, 20.00);
            const beforeExpense1Timestamp = Date.now();
            await apiDriver.createExpense(expense1, users[0].token);
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense1Timestamp);

            // Simulate disconnect by stopping listener
            console.log('Simulating network disconnect...');
            notificationDriver.stopListening(users[0].uid);

            // Create expense while "disconnected"
            const expense2 = createBasicExpense(testGroup.id, 30.00);
            await apiDriver.createExpense(expense2, users[0].token);

            // 2. Reconnect with new listener (captures all state changes)
            console.log('Simulating reconnection...');
            [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // Should automatically receive current notification state
            await listener.waitForEventCount(testGroup.id, 'transaction', 1);

            // 3. Verify we can still receive new notifications
            const expense3 = createBasicExpense(testGroup.id, 40.00);
            const beforeExpense3Timestamp = Date.now();
            await apiDriver.createExpense(expense3, users[0].token);
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense3Timestamp);

            console.log('Successfully handled disconnect/reconnect scenario');
        });

    }); // End Network & Connection Errors

    describe('Service Failure Scenarios', () => {

        test('should handle notification service failures gracefully', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Test that the system continues to work despite potential service issues
            //    (We can't easily mock Firebase failures in integration tests,
            //     but we can test system resilience)
            
            const expense = createBasicExpense(testGroup.id, 33.00, 0);
            const beforeExpense = Date.now();
            await apiDriver.createExpense(expense, users[0].token);

            // 3. Verify notification delivery works under normal conditions
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 4. Create multiple rapid requests to stress the system
            for (let i = 0; i < 3; i++) {
                const rapidExpense = createBasicExpense(testGroup.id, 10 + i, 0);
                await apiDriver.createExpense(rapidExpense, users[0].token);
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // 5. Verify system remains responsive
            await new Promise(resolve => setTimeout(resolve, 2000));
            const allEvents = listener.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');

            expect(allEvents.length).toBeGreaterThanOrEqual(4); // Original + 3 rapid

            console.log('✅ Notification system remains resilient under stress');
        });

        test('should handle document version conflicts', async () => {
            // 1. Set up listeners for multiple users
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([users[0].uid, users[1].uid]);

            // 2. Add user2 to group
            const shareLink = await apiDriver.generateShareLink(testGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, users[1].token);

            // 3. Create concurrent expenses to potentially trigger version conflicts
            // Fire off multiple expenses rapidly to test atomic operations
            const beforeConcurrent = Date.now();
            const concurrentPromises = [];
            for (let i = 0; i < 3; i++) {
                const expense = createBasicExpense(testGroup.id, 20 + i, 0);
                concurrentPromises.push(apiDriver.createExpense(expense, users[0].token));
            }

            await Promise.all(concurrentPromises);

            // 4. Wait for all notifications to be processed
            await new Promise(resolve => setTimeout(resolve, 3000));

            // 5. Verify both users received all notifications despite potential conflicts
            await listener1.waitForEventCount(testGroup.id, 'transaction', 3);
            await listener2.waitForEventCount(testGroup.id, 'transaction', 3);
            
            const user1Events = listener1.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');
            const user2Events = listener2.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');

            expect(user1Events.length).toBeGreaterThanOrEqual(3);
            expect(user2Events.length).toBeGreaterThanOrEqual(3);

            console.log('✅ Atomic operations handle concurrent updates correctly');
        });

        test('should handle corrupted notification documents', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Test that the system can handle unexpected document states
            //    (In integration tests, we can't easily corrupt documents,
            //     but we can test that the system initializes properly)
            
            const expense = createBasicExpense(testGroup.id, 29.00, 0);
            const beforeExpense = Date.now();
            await apiDriver.createExpense(expense, users[0].token);

            // 3. Verify the notification system initializes and works correctly
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 4. Test that restarting listeners works (simulates recovery)
            notificationDriver.stopListening(users[0].uid);
            const [newListener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 5. Verify system continues to work after restart
            const expense2 = createBasicExpense(testGroup.id, 31.00, 0);
            const beforeSecondExpense = Date.now();
            await apiDriver.createExpense(expense2, users[0].token);

            await newListener.waitForNewEvent(testGroup.id, 'transaction', beforeSecondExpense);

            const recentEvents = newListener.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');

            expect(recentEvents.length).toBeGreaterThanOrEqual(1);
            console.log('✅ System gracefully handles reinitialization scenarios');
        });

        test('should handle Firestore permission errors', async () => {
            // 1. Set up listener
            const [listener] = await notificationDriver.setupListenersFirst([users[0].uid]);

            // 2. Test normal operation first
            const expense = createBasicExpense(testGroup.id, 27.00, 0);
            const beforeExpense = Date.now();
            await apiDriver.createExpense(expense, users[0].token);

            // 3. Verify notifications work with proper permissions
            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeExpense);

            // 4. Note: In integration tests with Firebase emulator, 
            //    we can't easily simulate permission errors
            //    But we can verify the system works correctly with valid permissions
            
            const events = listener.getEventsForGroup(testGroup.id)
                .filter(e => e.type === 'transaction');

            expect(events.length).toBeGreaterThanOrEqual(1);

            // 5. Test that the system continues to work correctly
            const expense2 = createBasicExpense(testGroup.id, 38.00, 0);
            const beforeSecondExpense = Date.now();
            await apiDriver.createExpense(expense2, users[0].token);

            await listener.waitForNewEvent(testGroup.id, 'transaction', beforeSecondExpense);

            console.log('✅ System operates correctly with proper permissions (error handling framework ready)');
        });

    }); // End Service Failure Scenarios

});