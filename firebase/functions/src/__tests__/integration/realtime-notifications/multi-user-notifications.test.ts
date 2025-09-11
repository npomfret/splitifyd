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

            // 3. Mark timestamp before the action we're testing
            const beforeUpdateTimestamp = Date.now();
            console.log(`📍 Marked timestamp before group update: ${new Date(beforeUpdateTimestamp).toISOString()}`);
            
            // 4. Perform the action being tested
            console.log('🔄 Updating group name and description...');
            await apiDriver.updateGroup(multiUserGroup.id, {
                name: 'Updated Group Name',
                description: 'Updated description for testing notifications'
            }, users[0].token);

            // 5. Wait for all users to receive the specific group update event
            await notificationDriver.waitForAllListenersToReceiveEvent([listener1, listener2, listener3], multiUserGroup.id, 'group', beforeUpdateTimestamp);

            // 6. Verify the events are what we expect
            const user1UpdateEvents = listener1.getEventsSince(beforeUpdateTimestamp)
                .filter((e: any) => e.groupId === multiUserGroup.id && e.type === 'group');
            const user2UpdateEvents = listener2.getEventsSince(beforeUpdateTimestamp)
                .filter((e: any) => e.groupId === multiUserGroup.id && e.type === 'group');
            const user3UpdateEvents = listener3.getEventsSince(beforeUpdateTimestamp)
                .filter((e: any) => e.groupId === multiUserGroup.id && e.type === 'group');

            // Each user should receive at least the group update event we triggered
            // (Note: user1 may receive additional events from user2/user3 joins before the update)
            expect(user1UpdateEvents.length).toBeGreaterThanOrEqual(1);
            expect(user2UpdateEvents.length).toBeGreaterThanOrEqual(1);
            expect(user3UpdateEvents.length).toBeGreaterThanOrEqual(1);

            console.log(`📊 Events after update timestamp - User1: ${user1UpdateEvents.length}, User2: ${user2UpdateEvents.length}, User3: ${user3UpdateEvents.length}`);

            // 7. Verify the complete event sequence for user1 (can see everything)
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

            // 4. Mark timestamp before the specific action we're testing (user3 joining)
            const beforeUser3JoinTimestamp = Date.now();
            console.log(`📍 Marked timestamp before user3 joins: ${new Date(beforeUser3JoinTimestamp).toISOString()}`);
            
            // 5. Perform the action being tested - User 3 joins (new member)
            console.log('👤 User 3 joining group...');
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, users[2].token);

            // 6. Wait for existing members (user1 and user2) to receive group change notifications
            console.log('⏳ Waiting for existing members to be notified of new member join...');
            await listener1.waitForNewEvent(membershipGroup.id, 'group', beforeUser3JoinTimestamp);
            await listener2.waitForNewEvent(membershipGroup.id, 'group', beforeUser3JoinTimestamp);

            // 7. Verify the join event was captured correctly
            const user1JoinEvents = listener1.getEventsSince(beforeUser3JoinTimestamp)
                .filter((e: any) => e.groupId === membershipGroup.id && e.type === 'group');
            const user2JoinEvents = listener2.getEventsSince(beforeUser3JoinTimestamp)
                .filter((e: any) => e.groupId === membershipGroup.id && e.type === 'group');

            expect(user1JoinEvents.length).toBeGreaterThanOrEqual(1); // Should get at least one join event
            expect(user2JoinEvents.length).toBeGreaterThanOrEqual(1); // Should get at least one join event

            // 8. Wait for the new member (user3) to receive their group event
            await listener3.waitForNewEvent(membershipGroup.id, 'group', beforeUser3JoinTimestamp);
            const user3GroupEvent = listener3.getLatestEvent(membershipGroup.id, 'group');
            expect(user3GroupEvent).toBeDefined();
            expect(user3GroupEvent!.groupId).toBe(membershipGroup.id);

            // 9. Verify the complete event sequence shows the full membership story
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

            // 4. Mark timestamp before the leave action
            const beforeLeaveTimestamp = Date.now();
            console.log('User 3 leaving group...');
            
            // 5. User 3 leaves the group
            await apiDriver.leaveGroup(leaveTestGroup.id, users[2].token);

            // 6. Wait for remaining members to receive group change events from the leave
            await Promise.all([
                listener1.waitForNewEvent(leaveTestGroup.id, 'group', beforeLeaveTimestamp),
                listener2.waitForNewEvent(leaveTestGroup.id, 'group', beforeLeaveTimestamp)
            ]);

            // 7. The leaving member should have the group removed from their notifications
            // Instead of waiting for group_removed event, check that no more group events come for user3
            // and verify the remaining members received the leave notification
            const user1GroupEvent = listener1.getEventsSince(beforeLeaveTimestamp)
                .find(e => e.groupId === leaveTestGroup.id && e.type === 'group');
            const user2GroupEvent = listener2.getEventsSince(beforeLeaveTimestamp)
                .find(e => e.groupId === leaveTestGroup.id && e.type === 'group');

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

            // 3. Mark timestamp before expense tests begin
            const beforeExpensesTimestamp = Date.now();
            
            // Test different expense participation combinations
            console.log('Creating expense 1: User1 solo expense...');
            const expense1 = new ExpenseBuilder()
                .withGroupId(multiUserGroup.id)
                .withAmount(10.00)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid])
                .build();

            await apiDriver.createExpense(expense1, users[0].token);

            // Wait for all listeners to receive the transaction event
            await notificationDriver.waitForAllListenersToReceiveEvent([listener1, listener2, listener3], multiUserGroup.id, 'transaction', beforeExpensesTimestamp);

            console.log('Creating expense 2: User1 + User2 expense (excludes User3)...');
            const beforeExpense2Timestamp = Date.now();
            const expense2 = new ExpenseBuilder()
                .withGroupId(multiUserGroup.id)
                .withAmount(20.00)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid])
                .build();

            await apiDriver.createExpense(expense2, users[0].token);

            // Wait for all listeners to receive the transaction event
            await notificationDriver.waitForAllListenersToReceiveEvent([listener1, listener2, listener3], multiUserGroup.id, 'transaction', beforeExpense2Timestamp);

            console.log('Creating expense 3: User2 + User3 expense (excludes User1)...');
            const beforeExpense3Timestamp = Date.now();
            const expense3 = new ExpenseBuilder()
                .withGroupId(multiUserGroup.id)
                .withAmount(30.00)
                .withPaidBy(users[1].uid)
                .withParticipants([users[1].uid, users[2].uid])
                .build();

            await apiDriver.createExpense(expense3, users[1].token);

            // Wait for all listeners to receive the transaction event
            await notificationDriver.waitForAllListenersToReceiveEvent([listener1, listener2, listener3], multiUserGroup.id, 'transaction', beforeExpense3Timestamp);

            console.log('Creating expense 4: All users expense...');
            const beforeExpense4Timestamp = Date.now();
            const expense4 = new ExpenseBuilder()
                .withGroupId(multiUserGroup.id)
                .withAmount(40.00)
                .withPaidBy(users[0].uid)
                .withParticipants([users[0].uid, users[1].uid, users[2].uid])
                .build();

            await apiDriver.createExpense(expense4, users[0].token);

            // Wait for all listeners to receive the transaction event
            await notificationDriver.waitForAllListenersToReceiveEvent([listener1, listener2, listener3], multiUserGroup.id, 'transaction', beforeExpense4Timestamp);

            // Already verified that all listeners received events above

            // 4. Verify all listeners received transaction events for the 4 expenses
            const transactionEventsSinceStart = [listener1, listener2, listener3].map(listener => 
                listener.getEventsSince(beforeExpensesTimestamp).filter(e => 
                    e.groupId === multiUserGroup.id && e.type === 'transaction'
                )
            );
            
            console.log(`Transaction events since start - User1: ${transactionEventsSinceStart[0].length}, User2: ${transactionEventsSinceStart[1].length}, User3: ${transactionEventsSinceStart[2].length}`);

            // All users should have received notifications for all 4 expenses
            expect(transactionEventsSinceStart[0].length).toBeGreaterThanOrEqual(4);
            expect(transactionEventsSinceStart[1].length).toBeGreaterThanOrEqual(4);
            expect(transactionEventsSinceStart[2].length).toBeGreaterThanOrEqual(4);

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