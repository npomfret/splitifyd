// Multi-User Notifications Integration Tests
// Tests notification behavior across multiple users and group membership scenarios

import {describe, expect, test} from 'vitest';
import {
    users, apiDriver, notificationDriver, 
    setupNotificationTest, cleanupNotificationTest, 
    createBasicExpense, createMultiMemberGroup
} from './shared-setup';
import {CreateGroupRequestBuilder, ExpenseBuilder} from '@splitifyd/test-support';

describe('Multi-User Notifications Integration Tests', () => {
    setupNotificationTest;
    cleanupNotificationTest;

    describe('User Independence Tests', () => {

        test('should have separate notification documents for different users', async () => {
            // 1. START LISTENERS FIRST  
            const [listener1, listener2] = await notificationDriver.setupListenersFirst([users[0].uid, users[1].uid]);

            // 2. Create separate groups for each user to test independence
            const user1Group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                users[0].token
            );

            const user2Group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                users[1].token
            );

            // 3. Wait for each user to receive notification for their own group
            await listener1.waitForEventCount(user1Group.id, 'group', 1);
            await listener2.waitForEventCount(user2Group.id, 'group', 1);

            // 4. Verify each user received their specific group event (test isolation)
            const user1GroupEvent = listener1.getLatestEvent(user1Group.id, 'group');
            const user2GroupEvent = listener2.getLatestEvent(user2Group.id, 'group');

            expect(user1GroupEvent).toBeDefined();
            expect(user1GroupEvent!.groupId).toBe(user1Group.id);
            
            expect(user2GroupEvent).toBeDefined();
            expect(user2GroupEvent!.groupId).toBe(user2Group.id);

            console.log('✅ Users have independent notification documents - verified with test isolation');
        });

    }); // End User Independence Tests

    describe('Group Membership Notifications', () => {

        test('should notify all group members when group name or description changes', async () => {
            // 1. START LISTENERS FIRST - BEFORE ANY ACTIONS
            const userIds = [users[0].uid, users[1].uid, users[2].uid];
            const [listener1, listener2, listener3] = await notificationDriver.setupListenersFirst(userIds);

            // 2. Create a 3-user test group (listeners will capture this)
            const multiUserGroup = await createMultiMemberGroup([0, 1, 2]);

            // 3. Perform the action being tested
            console.log('🔄 Updating group name and description...');
            const beforeUpdate = Date.now();
            await apiDriver.updateGroup(multiUserGroup.id, {
                name: 'Updated Group Name',
                description: 'Updated description for testing notifications'
            }, users[0].token);

            // 4. Wait for all users to receive the specific group update event
            await notificationDriver.waitForAllListenersToReceiveEvent([listener1, listener2, listener3], multiUserGroup.id, 'group', beforeUpdate);

            // 5. Get latest group events for verification (avoiding timestamp race conditions)
            const user1LatestGroupEvent = listener1.getLatestEvent(multiUserGroup.id, 'group');
            const user2LatestGroupEvent = listener2.getLatestEvent(multiUserGroup.id, 'group');
            const user3LatestGroupEvent = listener3.getLatestEvent(multiUserGroup.id, 'group');

            const user1UpdateEvents = user1LatestGroupEvent ? [user1LatestGroupEvent] : [];
            const user2UpdateEvents = user2LatestGroupEvent ? [user2LatestGroupEvent] : [];
            const user3UpdateEvents = user3LatestGroupEvent ? [user3LatestGroupEvent] : [];

            // Each user should receive at least the group update event we triggered
            // (Note: user1 may receive additional events from user2/user3 joins before the update)
            expect(user1UpdateEvents.length).toBeGreaterThanOrEqual(1);
            expect(user2UpdateEvents.length).toBeGreaterThanOrEqual(1);
            expect(user3UpdateEvents.length).toBeGreaterThanOrEqual(1);

            console.log(`📊 Latest group events - User1: ${user1UpdateEvents.length}, User2: ${user2UpdateEvents.length}, User3: ${user3UpdateEvents.length}`);

            // 6. Verify the complete event sequence for user1 (can see everything)
            const allUser1GroupEvents = listener1.getEventsForGroup(multiUserGroup.id);
            console.log(`👀 User1 complete event sequence: ${allUser1GroupEvents.map((e: any) => e.type).join(' → ')}`);
            
            // Should have events for: initial creation, user2 join, user3 join, update
            expect(allUser1GroupEvents.length).toBeGreaterThanOrEqual(2); // At least creation and update

            console.log('✅ All users notified of group changes with complete event capture');

            // Cleanup
            notificationDriver.stopAllListeners();
        });

        test('should notify existing members when new member joins group', async () => {
            // 1. START LISTENERS FIRST - BEFORE ANY ACTIONS
            const userIds = [users[0].uid, users[1].uid, users[2].uid];
            const [listener1, listener2, listener3] = await notificationDriver.setupListenersFirst(userIds);

            // 2. Create a group with user1 initially (listeners capture this)
            const membershipGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder().build(),
                users[0].token
            );

            // 3. User 2 joins first (listeners capture this)
            const shareResponse = await apiDriver.generateShareLink(membershipGroup.id, users[0].token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[1].token);

            // 4. Perform the action being tested - User 3 joins (new member)
            console.log('👤 User 3 joining group...');
            const beforeJoin = Date.now();
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[2].token);

            // 5. Wait for existing members (user1 and user2) to receive group change notifications
            console.log('⏳ Waiting for existing members to be notified of new member join...');
            await listener1.waitForNewEvent(membershipGroup.id, 'group', beforeJoin);
            await listener2.waitForNewEvent(membershipGroup.id, 'group', beforeJoin);

            // 6. Get the latest join events (avoiding timestamp race conditions)
            const user1LatestGroupEvent = listener1.getLatestEvent(membershipGroup.id, 'group');
            const user2LatestGroupEvent = listener2.getLatestEvent(membershipGroup.id, 'group');

            const user1JoinEvents = user1LatestGroupEvent ? [user1LatestGroupEvent] : [];
            const user2JoinEvents = user2LatestGroupEvent ? [user2LatestGroupEvent] : [];

            expect(user1JoinEvents.length).toBeGreaterThanOrEqual(1); // Should get at least one join event
            expect(user2JoinEvents.length).toBeGreaterThanOrEqual(1); // Should get at least one join event

            // 7. Wait for the new member (user3) to receive their group event
            await listener3.waitForNewEvent(membershipGroup.id, 'group', beforeJoin);
            const user3GroupEvent = listener3.getLatestEvent(membershipGroup.id, 'group');
            expect(user3GroupEvent).toBeDefined();
            expect(user3GroupEvent!.groupId).toBe(membershipGroup.id);

            // 8. Verify the complete event sequence shows the full membership story
            const allUser1GroupEvents = listener2.getEventsForGroup(membershipGroup.id);
            console.log(`👀 User1 complete membership sequence: ${allUser1GroupEvents.map((e: any) => e.type).join(' → ')}`);
            
            // User1 should see: initial creation, user2 join, user3 join
            expect(allUser1GroupEvents.length).toBeGreaterThanOrEqual(2); // At least creation + user3 join

            console.log('✅ Existing members notified when new member joins with complete event capture');

            // Cleanup
            notificationDriver.stopAllListeners();
        });

        test('should notify remaining members when member leaves group', async () => {
            // 1. START LISTENERS FIRST - BEFORE ANY ACTIONS
            const userIds = [users[0].uid, users[1].uid, users[2].uid];
            const [listener1, listener2, listener3] = await notificationDriver.setupListenersFirst(userIds);

            // 2. Create a 3-user test group (listeners capture this)
            const leaveTestGroup = await createMultiMemberGroup([0, 1, 2]);

            // 3. Wait for all users to receive group events (ensuring they're all members)
            await Promise.all([
                listener1.waitForEventCount(leaveTestGroup.id, 'group', 1),
                listener2.waitForEventCount(leaveTestGroup.id, 'group', 1),
                listener3.waitForEventCount(leaveTestGroup.id, 'group', 1)
            ]);

            // 4. User 3 leaves the group
            console.log('User 3 leaving group...');
            const beforeLeave = Date.now();
            await apiDriver.leaveGroup(leaveTestGroup.id, users[2].token);

            // 5. Wait for remaining members to receive group change events from the leave
            await Promise.all([
                listener1.waitForNewEvent(leaveTestGroup.id, 'group', beforeLeave),
                listener2.waitForNewEvent(leaveTestGroup.id, 'group', beforeLeave)
            ]);

            // 6. Verify the remaining members received the leave notification
            const user1GroupEvent = listener1.getLatestEvent(leaveTestGroup.id, 'group');
            const user2GroupEvent = listener2.getLatestEvent(leaveTestGroup.id, 'group');

            expect(user1GroupEvent).toBeDefined();
            expect(user2GroupEvent).toBeDefined();

            console.log('✅ Remaining members notified when member leaves - verified through listener events only');
        });

    }); // End Group Membership Tests

    describe('Multi-User Expense Scenarios', () => {

        test('should notify all 3 users for all expenses regardless of participation', async () => {
            // 1. START LISTENERS FIRST - BEFORE ANY ACTIONS
            const userIds = [users[0].uid, users[1].uid, users[2].uid];
            const [listener1, listener2, listener3] = await notificationDriver.setupListenersFirst(userIds);
            
            // 2. Create group and perform setup (listeners capture everything)
            const multiUserGroup = await createMultiMemberGroup([0, 1, 2]);

            // Wait for all users to receive group events (when they joined the group)
            await Promise.all([
                listener1.waitForEventCount(multiUserGroup.id, 'group', 1),
                listener2.waitForEventCount(multiUserGroup.id, 'group', 1),
                listener3.waitForEventCount(multiUserGroup.id, 'group', 1)
            ]);

            // 3. Test different expense participation combinations
            console.log('Creating expense 1: User1 solo expense...');
            const expense1 = new ExpenseBuilder()
                .withGroupId(multiUserGroup.id)
                .withAmount(10.00)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .build();

            await apiDriver.createExpense(expense1, users[0].token);

            const beforeExpense1 = Date.now();
            // Wait for all listeners to receive the transaction event
            await notificationDriver.waitForAllListenersToReceiveEvent([listener1, listener2, listener3], multiUserGroup.id, 'transaction', beforeExpense1);

            console.log('Creating expense 2: User1 + User2 expense (excludes User3)...');
            const beforeExpense2 = Date.now();
            const expense2 = new ExpenseBuilder()
                .withGroupId(multiUserGroup.id)
                .withAmount(20.00)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await apiDriver.createExpense(expense2, users[0].token);

            // Wait for all listeners to receive the transaction event
            await notificationDriver.waitForAllListenersToReceiveEvent([listener1, listener2, listener3], multiUserGroup.id, 'transaction', beforeExpense2);

            console.log('Creating expense 3: User2 + User3 expense (excludes User1)...');
            const beforeExpense3 = Date.now();
            const expense3 = new ExpenseBuilder()
                .withGroupId(multiUserGroup.id)
                .withAmount(30.00)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid, users[2].uid])
                .build();

            await apiDriver.createExpense(expense3, users[1].token);

            // Wait for all listeners to receive the transaction event
            await notificationDriver.waitForAllListenersToReceiveEvent([listener1, listener2, listener3], multiUserGroup.id, 'transaction', beforeExpense3);

            console.log('Creating expense 4: All users expense...');
            const beforeExpense4 = Date.now();
            const expense4 = new ExpenseBuilder()
                .withGroupId(multiUserGroup.id)
                .withAmount(40.00)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .build();

            await apiDriver.createExpense(expense4, users[0].token);

            // Wait for all listeners to receive the transaction event
            await notificationDriver.waitForAllListenersToReceiveEvent([listener1, listener2, listener3], multiUserGroup.id, 'transaction', beforeExpense4);

            // 4. Verify all listeners received transaction events for the 4 expenses
            // Use event count validation instead of timestamp-based filtering
            await Promise.all([
                listener1.waitForEventCount(multiUserGroup.id, 'transaction', 4),
                listener2.waitForEventCount(multiUserGroup.id, 'transaction', 4),
                listener3.waitForEventCount(multiUserGroup.id, 'transaction', 4)
            ]);
            
            const user1TransactionCount = listener1.getEventsForGroup(multiUserGroup.id).filter(e => e.type === 'transaction').length;
            const user2TransactionCount = listener2.getEventsForGroup(multiUserGroup.id).filter(e => e.type === 'transaction').length;
            const user3TransactionCount = listener3.getEventsForGroup(multiUserGroup.id).filter(e => e.type === 'transaction').length;
            
            console.log(`Transaction events total - User1: ${user1TransactionCount}, User2: ${user2TransactionCount}, User3: ${user3TransactionCount}`);

            // All users should have received notifications for all 4 expenses
            expect(user1TransactionCount).toBeGreaterThanOrEqual(4);
            expect(user2TransactionCount).toBeGreaterThanOrEqual(4);
            expect(user3TransactionCount).toBeGreaterThanOrEqual(4);

            // 5. Verify listeners received at least 4 transaction events each (test isolation: only check THIS group)
            await Promise.all([
                listener1.waitForEventCount(multiUserGroup.id, 'transaction', 4),
                listener2.waitForEventCount(multiUserGroup.id, 'transaction', 4),
                listener3.waitForEventCount(multiUserGroup.id, 'transaction', 4)
            ]);

            console.log('✅ All users verified to receive 4+ transaction events for the test group through listener events only');
        });

    }); // End Multi-User Expense Tests

});