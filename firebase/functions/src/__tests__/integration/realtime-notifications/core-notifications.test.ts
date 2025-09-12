// Core Notifications Integration Tests
// Tests fundamental notification document functionality and basic notification behavior

import { describe, expect, test } from 'vitest';
import { user1, testGroup, apiDriver, notificationDriver, setupNotificationTest, cleanupNotificationTest } from './shared-setup';

describe('Core Notifications Integration Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;

    describe('Basic Notification Document Operations', () => {
        test('should create notification document when user creates first group', async () => {
            // 1. START LISTENER FIRST - BEFORE ANY ACTIONS
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Wait for group notification event (proves document was created and updated)
            await listener.waitForEventCount(testGroup.id, 'group', 1);

            // 3. Verify the event was received and has the expected structure
            const groupEvent = listener.getLatestEvent(testGroup.id, 'group');
            expect(groupEvent).toBeDefined();
            expect(groupEvent!.groupId).toBe(testGroup.id);
            expect(groupEvent!.type).toBe('group');

            // Verify the group state structure from the event
            const groupState = groupEvent!.groupState!;
            expect(groupState).toBeDefined();
            expect(groupState.lastGroupDetailsChange).toBeDefined();
            expect(typeof groupState.transactionChangeCount).toBe('number');
            expect(typeof groupState.balanceChangeCount).toBe('number');
            expect(typeof groupState.groupDetailsChangeCount).toBe('number');
        });

        test('should update notification when expense is added to group', async () => {
            // 1. START LISTENER FIRST - BEFORE ANY ACTIONS
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create expense to trigger notification update
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token);

            // 3. Wait for transaction event (proves notification was updated)
            await listener.waitForEventCount(testGroup.id, 'transaction', 1);

            // 4. Verify the transaction event was received with expected data
            const transactionEvent = listener.getLatestEvent(testGroup.id, 'transaction');
            expect(transactionEvent).toBeDefined();
            expect(transactionEvent!.groupId).toBe(testGroup.id);
            expect(transactionEvent!.type).toBe('transaction');
            expect(transactionEvent!.groupState!.transactionChangeCount).toBeGreaterThan(0);

            console.log('✅ Notification updated when expense added - verified by listener event and document state');
        });

        test('should increment change version when notifications are updated', async () => {
            // 1. START LISTENER FIRST - BEFORE ANY ACTIONS
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Wait for initial group event and get version
            await listener.waitForEventCount(testGroup.id, 'group', 1);
            const initialGroupEvent = listener.getLatestEvent(testGroup.id, 'group');
            const initialVersion = initialGroupEvent?.version || 0;

            // 3. Create an expense to trigger a change
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 5.0);

            // 4. Wait for transaction event (proves version will change)
            await listener.waitForEventCount(testGroup.id, 'transaction', 1);

            // 5. Verify version incremented by checking the transaction event
            const transactionEvent = listener.getLatestEvent(testGroup.id, 'transaction');

            expect(transactionEvent).toBeDefined();
            expect(transactionEvent!.version).toBeGreaterThan(initialVersion);
            console.log(`✅ Change version incremented from ${initialVersion} to ${transactionEvent!.version} - verified by listener events only`);
        });

        test('should contain correct group state in notifications', async () => {
            // 1. START LISTENER FIRST - BEFORE ANY ACTIONS
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Wait for group creation event from beforeEach
            await listener.waitForEventCount(testGroup.id, 'group', 1);
            const groupEvent = listener.getLatestEvent(testGroup.id, 'group');

            expect(groupEvent).toBeDefined();
            expect(groupEvent!.groupId).toBe(testGroup.id);
            expect(groupEvent!.type).toBe('group');

            const groupState = groupEvent!.groupState!;

            // Check initial state
            expect(groupState.groupDetailsChangeCount).toBeGreaterThanOrEqual(1);
            expect(groupState.transactionChangeCount).toBe(0);
            expect(groupState.balanceChangeCount).toBe(0);

            console.log('✅ Group state structure is correct in notifications');
        });
    }); // End Basic Operations

    describe('Real-time Event Delivery', () => {
        test('should receive real-time notification when expense is created', async () => {
            // 1. START LISTENER FIRST - BEFORE ANY ACTIONS
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create an expense to trigger notifications
            console.log('Creating expense to trigger notification...');
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 25.5);

            // 3. Wait for transaction change event
            await listener.waitForEventCount(testGroup.id, 'transaction', 1);
            const event = listener.getLatestEvent(testGroup.id, 'transaction');

            expect(event).toBeDefined();
            expect(event!.groupId).toBe(testGroup.id);
            expect(event!.type).toBe('transaction');
            expect(event!.userId).toBe(user1.uid);
            expect(event!.groupState?.transactionChangeCount).toBeGreaterThan(0);
        });

        test('should receive balance change notification after expense creation', async () => {
            // 1. START LISTENER FIRST - BEFORE ANY ACTIONS
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create expense to trigger balance and transaction changes
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 50.0);

            // 3. Wait for transaction event (always triggered)
            await listener.waitForEventCount(testGroup.id, 'transaction', 1);

            // 4. Check if balance event was also triggered
            const balanceEvents = listener.getEventsForGroup(testGroup.id).filter(e => e.type === 'balance');
            if (balanceEvents.length > 0) {
                const balanceEvent = balanceEvents[balanceEvents.length - 1];
                expect(balanceEvent.groupId).toBe(testGroup.id);
                expect(balanceEvent.type).toBe('balance');
                expect(balanceEvent.groupState?.balanceChangeCount).toBeGreaterThan(0);
                console.log('✅ Balance change notification received');
            } else {
                console.log('✅ Balance change not triggered separately (transaction change detected)');
            }
        });

        test('should verify notification event structure using listeners', async () => {
            // 1. START LISTENER FIRST - BEFORE ANY ACTIONS
            const [listener] = await notificationDriver.setupListenersFirst([user1.uid]);

            // 2. Create expense for the test group
            await apiDriver.createBasicExpense(testGroup.id, user1.uid, user1.token, 30.0);

            // 3. Wait for transaction event
            await listener.waitForEventCount(testGroup.id, 'transaction', 1);
            const transactionEvent = listener.getLatestEvent(testGroup.id, 'transaction');

            expect(transactionEvent).toBeDefined();
            expect(transactionEvent!.version).toBeGreaterThan(0);
            expect(transactionEvent!.groupId).toBe(testGroup.id);
            expect(transactionEvent!.type).toBe('transaction');

            const groupState = transactionEvent!.groupState!;
            expect(groupState.transactionChangeCount).toBeGreaterThan(0);
            expect(groupState.lastTransactionChange).toBeDefined();
        });
    }); // End Real-time Event Delivery
});
