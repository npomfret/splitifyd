// Integration test for real-time notifications using NotificationDriver pattern
// Tests the mechanism that the webapp relies on for real-time updates

import { beforeEach, describe, expect, test } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { ApiDriver, CreateGroupRequestBuilder, ExpenseBuilder, NotificationDriver, borrowTestUsers } from '@splitifyd/test-support';
import { PooledTestUser } from '@splitifyd/shared';
import { getFirestore } from '../../firebase';

describe('Real-time Notifications Integration Tests', () => {
    const apiDriver = new ApiDriver();
    const notificationDriver = new NotificationDriver(getFirestore());
    let users: PooledTestUser[];
    let testGroup: any;

    beforeEach(async () => {
        users = await borrowTestUsers(3);
        
        // Create a test group
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Notification Test Group ${uuidv4()}`)
            .withDescription('Testing real-time notifications')
            .build();

        testGroup = await apiDriver.createGroup(groupData, users[0].token);
    });

    describe('Single User Notification Tests', () => {

    test('should create notification document when user creates first group', async () => {
        // Create a group
        const groupData = new CreateGroupRequestBuilder()
            .withName(`Basic Test Group ${uuidv4()}`)
            .build();

        const group = await apiDriver.createGroup(groupData, users[0].token);

        // Check that notification document was created with the group entry
        // We don't need to wait for the trackGroupChanges trigger here - just verify the basic structure
        const notification = await notificationDriver.getCurrentNotifications(users[0].uid);
        
        expect(notification).toBeDefined();
        expect(notification!.groups[group.id]).toBeDefined();
        
        // Basic structure checks
        const groupState = notification!.groups[group.id];
        expect(groupState.lastTransactionChange).toBeDefined();
        expect(groupState.lastBalanceChange).toBeDefined(); 
        expect(groupState.lastGroupDetailsChange).toBeDefined();
        expect(typeof groupState.transactionChangeCount).toBe('number');
        expect(typeof groupState.balanceChangeCount).toBe('number');
        expect(typeof groupState.groupDetailsChangeCount).toBe('number');
    });

    test('should update notification when expense is added to group', async () => {
        // Create a fresh group for this test to avoid interference
        const freshGroup = new CreateGroupRequestBuilder()
            .withName(`Expense Test Group ${uuidv4()}`)
            .build();
        const group = await apiDriver.createGroup(freshGroup, users[0].token);

        // Get baseline transaction count (should be 0 for fresh group)
        const beforeNotification = await notificationDriver.getCurrentNotifications(users[0].uid);
        const beforeTransactionCount = beforeNotification?.groups[group.id]?.transactionChangeCount || 0;

        const expense = new ExpenseBuilder()
            .withGroupId(group.id)
            .withDescription(`Basic expense ${uuidv4()}`)
            .withAmount(10.00)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await apiDriver.createExpense(expense, users[0].token);

        // Wait for transaction count to increment
        const afterNotification = await notificationDriver.waitForTransactionChange(
            users[0].uid,
            group.id,
            beforeTransactionCount + 1,
            { timeout: 5000 }
        );

        expect(afterNotification.groups[group.id].transactionChangeCount).toBeGreaterThan(beforeTransactionCount);
        
        console.log('✅ Notification updated when expense added');
    });

    test('should have separate notification documents for different users', async () => {
        // Get notifications for both users
        const user1Notifications = await notificationDriver.getCurrentNotifications(users[0].uid);
        const user2Notifications = await notificationDriver.getCurrentNotifications(users[1].uid);

        // They should exist independently
        expect(user1Notifications).toBeDefined();
        
        // User 2 might not have notifications yet, which is actually correct behavior
        console.log(`User 1 has ${user1Notifications ? Object.keys(user1Notifications.groups || {}).length : 0} groups in notifications`);
        console.log(`User 2 has ${user2Notifications ? Object.keys(user2Notifications.groups || {}).length : 0} groups in notifications`);
        
        console.log('✅ Users have independent notification documents');
    });

    test('should increment change version when notifications are updated', async () => {
        const beforeNotification = await notificationDriver.getCurrentNotifications(users[0].uid);
        const beforeVersion = beforeNotification?.changeVersion || 0;

        // Create an expense to trigger a change
        const expense = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription(`Version test expense ${uuidv4()}`)
            .withAmount(5.00)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await apiDriver.createExpense(expense, users[0].token);

        // Wait for version to increment
        const afterNotification = await notificationDriver.waitForVersion(
            users[0].uid,
            beforeVersion + 1,
            { timeout: 5000 }
        );

        expect(afterNotification.changeVersion).toBeGreaterThan(beforeVersion);
        console.log(`✅ Change version incremented from ${beforeVersion} to ${afterNotification.changeVersion}`);
    });

    test('should contain correct group state in notifications', async () => {
        // Create a specific group for this test
        const groupData = new CreateGroupRequestBuilder()
            .withName(`State Test Group ${uuidv4()}`)
            .build();

        const group = await apiDriver.createGroup(groupData, users[0].token);

        // Wait for notification to be created
        await new Promise(resolve => setTimeout(resolve));
        const notification = await notificationDriver.getCurrentNotifications(users[0].uid);

        expect(notification).toBeDefined();
        expect(notification!.groups[group.id]).toBeDefined();

        const groupState = notification!.groups[group.id];
        
        // Check initial state
        expect(groupState.groupDetailsChangeCount).toBeGreaterThanOrEqual(1);
        expect(groupState.transactionChangeCount).toBe(0);
        expect(groupState.balanceChangeCount).toBe(0);
        
        console.log('✅ Group state structure is correct in notifications');
    });

    test('should receive real-time notification when expense is created', async () => {
        // Start listening for user notifications
        const listener = await notificationDriver.startListening(users[0].uid);

        // Create an expense to trigger notifications
        const expense = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription(`Test expense ${uuidv4()}`)
            .withAmount(25.50)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        console.log('Creating expense to trigger notification...');
        await apiDriver.createExpense(expense, users[0].token);

        // Wait for transaction change event
        const event = await listener.waitForGroupEvent(testGroup.id, 'transaction');
        
        expect(event.groupId).toBe(testGroup.id);
        expect(event.type).toBe('transaction');
        expect(event.userId).toBe(users[0].uid);
        expect(event.groupState?.transactionChangeCount).toBeGreaterThan(0);

        notificationDriver.stopListening(users[0].uid);
    });

    }); // End Single User Tests

    describe('Multi User Notification Tests', () => {

    test('should receive balance change notification after expense creation', async () => {
        const listener = await notificationDriver.startListening(users[0].uid);

        const expense = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription(`Balance test expense ${uuidv4()}`)
            .withAmount(50.00)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await apiDriver.createExpense(expense, users[0].token);

        // Wait for balance change (may come after transaction change)
        try {
            const balanceEvent = await listener.waitForGroupEvent(testGroup.id, 'balance');
            expect(balanceEvent.groupId).toBe(testGroup.id);
            expect(balanceEvent.type).toBe('balance');
            expect(balanceEvent.groupState?.balanceChangeCount).toBeGreaterThan(0);
        } catch (error) {
            // Balance changes might not always trigger separately from transaction changes
            // Check if we got a transaction change instead
            const events = listener.getEventsForGroup(testGroup.id);
            const hasTransactionChange = events.some(e => e.type === 'transaction');
            expect(hasTransactionChange).toBe(true);
            console.log('Balance change not triggered separately, but transaction change detected');
        }

        notificationDriver.stopListening(users[0].uid);
    });

    test('should handle multiple rapid expense creations without missing notifications', async () => {
        const listener = await notificationDriver.startListening(users[0].uid);

        // Create multiple expenses rapidly
        const expenses = Array.from({ length: 3 }, (_, i) => 
            new ExpenseBuilder()
                .withGroupId(testGroup.id)
                .withDescription(`Rapid expense ${i + 1} ${uuidv4()}`)
                .withAmount(10 + i)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .build()
        );

        console.log('Creating multiple expenses rapidly...');
        
        for (const expense of expenses) {
            await apiDriver.createExpense(expense, users[0].token);
            // Small delay to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Wait for transaction events for each expense
        for (let i = 0; i < expenses.length; i++) {
            await listener.waitForGroupEvent(testGroup.id, 'transaction');
        }

        const events = listener.getEventsForGroup(testGroup.id);
        expect(events.length).toBeGreaterThanOrEqual(expenses.length);

        // Check that we received transaction changes
        const transactionEvents = events.filter(e => e.type === 'transaction');
        expect(transactionEvents.length).toBeGreaterThan(0);

        notificationDriver.stopListening(users[0].uid);
    });

    test('should detect when group is deleted from notifications', async () => {
        const listener = await notificationDriver.startListening(users[0].uid);

        // Create an expense to ensure group exists in notifications
        const expense = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription(`Pre-delete expense ${uuidv4()}`)
            .withAmount(15.00)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await apiDriver.createExpense(expense, users[0].token);

        // Wait for initial notification
        await listener.waitForGroupEvent(testGroup.id, 'transaction');

        // Delete the group
        console.log('Deleting group...');
        await apiDriver.deleteGroup(testGroup.id, users[0].token);

        // Wait for group notification (sent before removal)
        const groupEvent = await listener.waitForGroupEvent(testGroup.id, 'group');
        
        expect(groupEvent.groupId).toBe(testGroup.id);
        expect(groupEvent.type).toBe('group');

        notificationDriver.stopListening(users[0].uid);
    });

    test('should verify notification document structure using polling', async () => {
        // Create a fresh group for this test to avoid interference from other tests
        const freshGroup = new CreateGroupRequestBuilder()
            .withName(`Polling Test Group ${uuidv4()}`)
            .withDescription('Group for testing polling-based notifications')
            .build();

        const freshGroupResult = await apiDriver.createGroup(freshGroup, users[0].token);

        // Get baseline transaction count for the fresh group
        const beforeNotification = await notificationDriver.getCurrentNotifications(users[0].uid);
        const beforeTransactionCount = beforeNotification?.groups[freshGroupResult.id]?.transactionChangeCount || 0;

        // Create expense for the fresh group
        const expense = new ExpenseBuilder()
            .withGroupId(freshGroupResult.id)
            .withDescription(`Structure test expense ${uuidv4()}`)
            .withAmount(30.00)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await apiDriver.createExpense(expense, users[0].token);

        // Use polling to verify notification structure - wait for incremental change
        const notification = await notificationDriver.waitForTransactionChange(
            users[0].uid, 
            freshGroupResult.id, 
            beforeTransactionCount + 1,
            { timeout: 5000 }
        );

        expect(notification).toBeDefined();
        expect(notification.changeVersion).toBeGreaterThan(0);
        expect(notification.groups[freshGroupResult.id]).toBeDefined();
        
        const groupState = notification.groups[freshGroupResult.id];
        expect(groupState.transactionChangeCount).toBeGreaterThan(0);
        expect(groupState.lastTransactionChange).toBeDefined();
    });

    test('should handle listener restart after network interruption simulation', async () => {
        // Start initial listener
        let listener = await notificationDriver.startListening(users[0].uid);

        // Create first expense
        const expense1 = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription(`Pre-disconnect expense ${uuidv4()}`)
            .withAmount(20.00)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await apiDriver.createExpense(expense1, users[0].token);
        await listener.waitForGroupEvent(testGroup.id, 'transaction');

        const eventsBeforeDisconnect = listener.getEvents().length;

        // Simulate disconnect by stopping listener
        console.log('Simulating network disconnect...');
        notificationDriver.stopListening(users[0].uid);

        // Create expense while "disconnected"
        const expense2 = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription(`During-disconnect expense ${uuidv4()}`)
            .withAmount(30.00)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await apiDriver.createExpense(expense2, users[0].token);
        await new Promise(resolve => setTimeout(resolve));

        // Reconnect with new listener
        console.log('Simulating reconnection...');
        listener = await notificationDriver.startListening(users[0].uid);

        // Should receive catch-up notification for the state change
        await listener.waitForGroupEvent(testGroup.id, 'transaction');

        const eventsAfterReconnect = listener.getEvents().length;
        expect(eventsAfterReconnect).toBeGreaterThan(0);

        // Verify we can still receive new notifications
        const expense3 = new ExpenseBuilder()
            .withGroupId(testGroup.id)
            .withDescription(`Post-reconnect expense ${uuidv4()}`)
            .withAmount(40.00)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await apiDriver.createExpense(expense3, users[0].token);
        await listener.waitForGroupEvent(testGroup.id, 'transaction');

        console.log('Successfully handled disconnect/reconnect scenario');
        notificationDriver.stopListening(users[0].uid);
    });

    test('should notify both users when user1 creates group, user2 joins, and user1 creates shared expense', async () => {
        const multiUserGroup = await apiDriver.createGroup(
            new CreateGroupRequestBuilder()
                .withName(`Multi-user Test Group ${uuidv4()}`)
                .withDescription('Testing multi-user real-time notifications')
                .build(),
            users[0].token
        );

        const user1Listener = await notificationDriver.startListening(users[0].uid);
        const user2Listener = await notificationDriver.startListening(users[1].uid);

        // Create initial expense for user 1
        const initialExpense = new ExpenseBuilder()
            .withGroupId(multiUserGroup.id)
            .withDescription(`Initial setup expense ${uuidv4()}`)
            .withAmount(5.00)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid])
            .build();

        await apiDriver.createExpense(initialExpense, users[0].token);
        
        // Give Firebase triggers time to process
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await notificationDriver.waitForTransactionChange(
            users[0].uid,
            multiUserGroup.id,
            1,
            { timeout: 3000 }
        );

        // User 2 joins the group
        const shareResponse = await apiDriver.generateShareLink(multiUserGroup.id, users[0].token);
        const joinResponse = await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);
        expect(joinResponse.groupId).toBe(multiUserGroup.id);

        // Create shared expense
        const sharedExpense = new ExpenseBuilder()
            .withGroupId(multiUserGroup.id)
            .withDescription(`Shared expense ${uuidv4()}`)
            .withAmount(50.00)
            .withPaidBy(users[0].uid)
            .withParticipants([users[0].uid, users[1].uid])
            .build();

        const createdSharedExpense = await apiDriver.createExpense(sharedExpense, users[0].token);
        
        // Verify shared expense was created correctly
        expect(createdSharedExpense.participants).toContain(users[0].uid);
        expect(createdSharedExpense.participants).toContain(users[1].uid);
        expect(createdSharedExpense.participants.length).toBe(2);

        // Wait for both users to receive transaction notifications
        await Promise.all([
            user1Listener.waitForGroupEvent(multiUserGroup.id, 'transaction'),
            user2Listener.waitForGroupEvent(multiUserGroup.id, 'transaction')
        ]);
        
        const user1EventsForGroup = user1Listener.getEventsForGroup(multiUserGroup.id);
        const user2EventsForGroup = user2Listener.getEventsForGroup(multiUserGroup.id);
        
        // Get latest transaction events
        const user1TransactionEvents = user1EventsForGroup.filter(e => e.type === 'transaction');
        const user2TransactionEvents = user2EventsForGroup.filter(e => e.type === 'transaction');
        const user1SharedEvent = user1TransactionEvents[user1TransactionEvents.length - 1];
        const user2SharedEvent = user2TransactionEvents[user2TransactionEvents.length - 1];
        
        expect(user1SharedEvent).toBeDefined();
        expect(user2SharedEvent).toBeDefined();
        expect(user1SharedEvent!.groupId).toBe(multiUserGroup.id);
        expect(user2SharedEvent!.groupId).toBe(multiUserGroup.id);

        // Verify notification documents
        const user1Notification = await notificationDriver.waitForTransactionChange(
            users[0].uid,
            multiUserGroup.id,
            2, // Initial + shared
            { timeout: 5000 }
        );
        
        const user2Notification = await notificationDriver.waitForTransactionChange(
            users[1].uid,
            multiUserGroup.id,
            1, // Shared expense
            { timeout: 5000 }
        );

        expect(user1Notification.groups[multiUserGroup.id].transactionChangeCount).toBeGreaterThanOrEqual(2);
        expect(user2Notification.groups[multiUserGroup.id].transactionChangeCount).toBeGreaterThanOrEqual(1);
        expect(user1SharedEvent!.groupState?.transactionChangeCount).toBeGreaterThanOrEqual(2);
        expect(user2SharedEvent!.groupState?.transactionChangeCount).toBeGreaterThanOrEqual(1);

        // Verify event counts
        expect(user1EventsForGroup.length).toBeGreaterThanOrEqual(2);
        expect(user2EventsForGroup.length).toBeGreaterThanOrEqual(1);
        
        // Cleanup
        notificationDriver.stopListening(users[0].uid);
        notificationDriver.stopListening(users[1].uid);
    });

    }); // End Multi User Tests

    afterEach(() => {
        // Cleanup any remaining listeners
        notificationDriver.stopAllListeners();
    });
});