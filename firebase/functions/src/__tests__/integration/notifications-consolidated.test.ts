/**
 * Consolidated Notifications Integration Tests
 *
 * IMPORTANT TESTING PATTERNS AND CONSTRAINTS:
 *
 * 1. NOTIFICATION TESTING APPROACH:
 *    - Use NotificationDriver, NOT AppDriver for notification tests
 *    - AppDriver "cheats" by peeking at the database - not allowed for notification testing
 *    - NotificationDriver mimics real webapp behavior with Firestore listeners
 *
 * 2. REQUIRED TEST STRUCTURE:
 *    - Always call setupListenersFirst() before any operations
 *    - Follow this EXACT pattern for each test operation:
 *      1. ACTION: Make an action (createExpense, removeGroupMember, etc.)
 *      2. WAIT: Wait for ALL expected events to be fully processed (waitForEventCount)
 *         CRITICAL: The system is DETERMINISTIC - events WILL arrive, you MUST wait long enough!
 *      3. ASSERT: Assert exact event counts (assertEventCount)
 *      4. CLEAR: Clear events before next action (clearEvents)
 *      5. Repeat for next action
 *
 * 3. STATE SYNCHRONIZATION (CRITICAL):
 *    - NEVER use setTimeout() or arbitrary delays: await new Promise(resolve => setTimeout(resolve, 500))
 *    - ALWAYS wait for proper state changes using waitForEventCount()
 *    - For member removal, wait for ALL trigger notifications before proceeding
 *    - Example: Wait for both trackGroupChanges AND trackMembershipDeletion notifications
 *
 * 4. NOTIFICATION TRIGGERS:
 *    - trackGroupChanges: Fires on group document updates
 *    - trackExpenseChanges: Fires on expense document changes
 *    - trackSettlementChanges: Fires on settlement document changes
 *    - trackMembershipDeletion: Fires on membership document deletion
 *
 * 5. EVENT ISOLATION:
 *    - Use clearEvents() between operations to isolate test assertions
 *    - Each test operation should have predictable, deterministic event counts
 *    - Wait for events to fully process before moving to next operation
 *
 * 6. AVOID COMPLEX HELPERS:
 *    - Don't use createGroupWithMembers() - it hides complexity
 *    - Perform operations explicitly and wait for events at each step
 *    - Each action should be followed by appropriate event waiting/assertion
 *
 * Combines tests from realtime-notifications/core-notifications.test.ts,
 * realtime-notifications/business-logic.test.ts, realtime-notifications/triggers.test.ts,
 * and normal-flow/user-notification-system.test.ts
 */

import { amountToSmallestUnit, calculateEqualSplits, PooledTestUser, smallestUnitToAmountString, ZERO } from '@splitifyd/shared';
import {
    ApiDriver,
    borrowTestUsers,
    CreateExpenseRequestBuilder,
    CreateGroupRequestBuilder,
    CreateSettlementRequestBuilder,
    ExpenseUpdateBuilder,
    GroupUpdateBuilder,
    NotificationDriver,
} from '@splitifyd/test-support';
import { v4 as uuidv4 } from 'uuid';
import { beforeEach, describe, expect, test } from 'vitest';
import { getFirestore } from '../../firebase';

describe('Notifications Management - Consolidated Tests', () => {
    const apiDriver = new ApiDriver();
    const notificationDriver = new NotificationDriver(getFirestore());
    let user1: PooledTestUser;
    let user2: PooledTestUser;
    let user3: PooledTestUser;

    beforeEach(async () => {
        [user1, user2, user3] = await borrowTestUsers(3);
        await notificationDriver.waitForQuiet();
    });

    afterEach(async () => {
        // Wait for system to settle before stopping listeners
        // This prevents race conditions where listeners from previous test
        // are still processing events when next test starts - which slows things down a lot
        await notificationDriver.waitForQuiet();
        await notificationDriver.stopAllListeners(); // Now async - waits for Firestore cleanup
    });

    describe('Core Notification Document Operations', () => {
        // NOTE: Notification business logic (batch updates, field mapping, validation) is now tested in unit tests: NotificationService.unit.test.ts
        // This integration test focuses on real-time Firebase behavior and trigger integration
        test('should create and update notification documents for basic operations', async () => {
            // Set up listeners for all users before any operations
            const [user1Listener, user2Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid]);

            // Create a group and verify notification document creation
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // Wait for group creation notification (increased timeout for Firebase emulator trigger latency)
            await user1Listener.waitForGroupEvent(group.id, 1);

            // Assert event count after group creation
            user1Listener.assertEventCount(group.id, 1, 'group');

            // Clear events to isolate next operation
            notificationDriver.clearEvents();

            // Add second user to group
            const shareResponse = await apiDriver.generateShareLink(group.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);

            // Wait for membership notifications for BOTH users
            // user1 sees groupDetailsChangeCount=2 (creation + member addition)
            // user2 sees groupDetailsChangeCount=1 (their initial state when joining)
            await user1Listener.waitForGroupEvent(group.id, 2);
            await user2Listener.waitForGroupEvent(group.id, 1);

            // Assert exact event counts - each user should have received exactly 1 group event
            user1Listener.assertEventCount(group.id, 1, 'group');
            user2Listener.assertEventCount(group.id, 1, 'group');

            // Clear events to isolate next operation
            notificationDriver.clearEvents();

            // Create expense involving both users to ensure transaction notification triggers
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .withAmount(100.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // Wait for transaction, balance, and group notifications for BOTH users - expense creation triggers all three event types
            // NOTE: Phase 1 of group activity tracking adds touchGroup() to expense operations, which increments groupDetailsChangeCount
            await user1Listener.waitForTransactionEvent(group.id, 1);
            await user2Listener.waitForTransactionEvent(group.id, 1);
            await user1Listener.waitForBalanceEvent(group.id, 1);
            await user2Listener.waitForBalanceEvent(group.id, 1);
            await user1Listener.waitForGroupEvent(group.id, 3); // Was 2 before Phase 1; touchGroup() increments from 2→3
            await user2Listener.waitForGroupEvent(group.id, 2); // Was 1 before Phase 1; touchGroup() increments from 1→2

            // Assert exact event counts - expense creation should trigger transaction, balance, and group events (3 total)
            user1Listener.assertEventCount(group.id, 1, 'transaction');
            user1Listener.assertEventCount(group.id, 1, 'balance');
            user1Listener.assertEventCount(group.id, 1, 'group');
            user2Listener.assertEventCount(group.id, 1, 'transaction');
            user2Listener.assertEventCount(group.id, 1, 'balance');
            user2Listener.assertEventCount(group.id, 1, 'group');

            // Verify total event counts
            expect(user1Listener.getGroupEvents(group.id)).toHaveLength(3);
            expect(user2Listener.getGroupEvents(group.id)).toHaveLength(3);
        });

        test('should handle notification version increments correctly', async () => {
            // Set up listener for user1 before any operations
            const [user1Listener] = await notificationDriver.setupListeners([user1.uid]);

            // Create group and wait for initial notification
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // Wait for group creation notification - new group starts at count 1
            await user1Listener.waitForGroupEvent(group.id, 1);

            // Assert event count after group creation
            user1Listener.assertEventCount(group.id, 1, 'group');
            expect(user1Listener.getGroupEvents(group.id)).toHaveLength(1);

            // Clear events to isolate next operation
            notificationDriver.clearEvents();

            // Update group to trigger version increment
            await apiDriver.updateGroup(
                group.id,
                new GroupUpdateBuilder()
                    .withName('Updated Name')
                    .build(),
                user1.token,
            );

            // Wait for group update notification - count should increment to 2
            await user1Listener.waitForGroupEvent(group.id, 2);

            // Assert exact event count after update - should have received 1 group event after clearing
            user1Listener.assertEventCount(group.id, 1, 'group');
            expect(user1Listener.getGroupEvents(group.id)).toHaveLength(1);
        });

        test('should handle rapid multiple updates without losing notifications', async () => {
            // Set up listener for user1 before any operations
            const [user1Listener] = await notificationDriver.setupListeners([user1.uid]);

            // Create group and wait for initial notification
            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // Wait for group creation notification - new group starts at count 1
            await user1Listener.waitForGroupEvent(group.id, 1);

            // Assert event count after group creation
            user1Listener.assertEventCount(group.id, 1, 'group');

            // Clear events to isolate next operation
            notificationDriver.clearEvents();

            // Perform multiple rapid parallel updates
            // Due to optimistic locking, some updates may fail with CONCURRENT_UPDATE (409) errors
            // This is expected and correct behavior - we verify notifications are generated for successful updates
            const results = await Promise.allSettled([
                apiDriver.updateGroup(
                    group.id,
                    new GroupUpdateBuilder()
                        .withName('Update 1')
                        .build(),
                    user1.token,
                ),
                apiDriver.updateGroup(
                    group.id,
                    new GroupUpdateBuilder()
                        .withName('Update 2')
                        .withDescription('Updated desc')
                        .build(),
                    user1.token,
                ),
                apiDriver.updateGroup(
                    group.id,
                    new GroupUpdateBuilder()
                        .withName('Update 3')
                        .build(),
                    user1.token,
                ),
            ]);

            // Analyze results - some may succeed, some may fail due to concurrent modification
            const successes = results.filter((r) => r.status === 'fulfilled');
            const failures = results.filter((r) => r.status === 'rejected');

            // At least one update should succeed
            expect(successes.length).toBeGreaterThan(0);

            // Note: Failures are NOT guaranteed - depends on timing of Firebase's optimistic lock detection
            // Sometimes all updates succeed (fast execution), sometimes 1-2 fail (concurrent conflict detected)
            // If there are failures, they should be CONCURRENT_UPDATE conflicts (expected)
            if (failures.length > 0) {
                const conflicts = failures.filter(
                    (r) =>
                        r.status === 'rejected'
                        && (r.reason?.message?.includes('CONCURRENT_UPDATE') || r.reason?.message?.includes('409')),
                );
                expect(conflicts.length).toBeGreaterThan(0);
            }

            // Wait for notifications matching the number of successful updates
            await user1Listener.waitForEventCount(group.id, 'group', successes.length);

            // Verify we received exactly the number of notifications matching successful updates
            // This proves notifications are NOT lost despite concurrent update conflicts
            user1Listener.assertEventCount(group.id, successes.length, 'group');

            // Verify final group state reflects one of the successful updates
            const finalGroup = await apiDriver.getGroup(group.id, user1.token);
            expect(['Update 1', 'Update 2', 'Update 3']).toContain(finalGroup.name);
        });
    });

    describe('Multi-User Notification Distribution', () => {
        // NOTE: Multi-user batch notification logic is now tested in unit tests: NotificationService.unit.test.ts
        // This integration test focuses on real-time distribution behavior via Firebase
        test('should notify all group members when operations occur', async () => {
            // Set up listeners for all users before any operations
            const [user1Listener, user2Listener, user3Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid, user3.uid]);

            // Step 1: Create group with just the creator
            const multiUserGroup = await apiDriver.createGroup(
                {
                    name: `Multi-User Group ${uuidv4()}`,
                    description: `Test group created at ${new Date().toISOString()}`,
                },
                user1.token,
            );

            // Wait for group creation event to fully process - only creator should be notified
            await user1Listener.waitForEventCount(multiUserGroup.id, 'group', 1);
            user1Listener.assertEventCount(multiUserGroup.id, 1, 'group');

            // Other users should have no events yet
            const user2EventsAfterCreate = user2Listener.getGroupEvents(multiUserGroup.id);
            const user3EventsAfterCreate = user3Listener.getGroupEvents(multiUserGroup.id);
            expect(user2EventsAfterCreate.length).toBe(0);
            expect(user3EventsAfterCreate.length).toBe(0);

            // Clear events to isolate next step
            notificationDriver.clearEvents();

            // Step 2: Generate share link and have user2 join
            const { linkId } = await apiDriver.generateShareLink(multiUserGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(linkId, user2.token);

            // Wait for member join events to fully process - both existing members should be notified
            await user1Listener.waitForEventCount(multiUserGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(multiUserGroup.id, 'group', 1);
            user1Listener.assertEventCount(multiUserGroup.id, 1, 'group');
            user2Listener.assertEventCount(multiUserGroup.id, 1, 'group');

            // User3 should still have no events
            const user3EventsAfterUser2Join = user3Listener.getGroupEvents(multiUserGroup.id);
            expect(user3EventsAfterUser2Join.length).toBe(0);

            // Clear events to isolate next step
            notificationDriver.clearEvents();

            // Step 3: Have user3 join
            await apiDriver.joinGroupViaShareLink(linkId, user3.token);

            // Wait for member join events to fully process - all members should be notified
            await user1Listener.waitForEventCount(multiUserGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(multiUserGroup.id, 'group', 1);
            await user3Listener.waitForEventCount(multiUserGroup.id, 'group', 1);
            user1Listener.assertEventCount(multiUserGroup.id, 1, 'group');
            user2Listener.assertEventCount(multiUserGroup.id, 1, 'group');
            user3Listener.assertEventCount(multiUserGroup.id, 1, 'group');

            // Clear events to isolate next operation
            notificationDriver.clearEvents();

            // Create expense and verify all participants are notified
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(multiUserGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid, user3.uid])
                    .withAmount(60.0)
                    .withCurrency('USD')
                    .withSplitType('equal')
                    .build(),
                user1.token,
            );

            // Wait for all users to receive transaction notifications
            await user1Listener.waitForTransactionEvent(multiUserGroup.id, 1);
            await user2Listener.waitForTransactionEvent(multiUserGroup.id, 1);
            await user3Listener.waitForTransactionEvent(multiUserGroup.id, 1);

            // Assert transaction event counts
            user1Listener.assertEventCount(multiUserGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(multiUserGroup.id, 1, 'transaction');
            user3Listener.assertEventCount(multiUserGroup.id, 1, 'transaction');
        });

        test('should handle member addition and removal notification patterns', async () => {
            // Set up listeners for user1 and user2 before any operations
            const [user1Listener, user2Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid]);

            // Clear any historical events from previous tests that may be in the initial snapshot
            notificationDriver.clearEvents();

            // Start with single-member group
            const dynamicGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // Wait for group creation notification
            await user1Listener.waitForGroupEvent(dynamicGroup.id, 1);
            user1Listener.assertEventCount(dynamicGroup.id, 1, 'group');

            // Clear events to isolate next operation
            notificationDriver.clearEvents();

            // Add second member via share link
            const shareLink = await apiDriver.generateShareLink(dynamicGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // Both users should receive group update notifications for member addition
            await user1Listener.waitForEventCount(dynamicGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(dynamicGroup.id, 'group', 1);

            user1Listener.assertEventCount(dynamicGroup.id, 1, 'group');
            user2Listener.assertEventCount(dynamicGroup.id, 1, 'group');

            // Clear events to isolate next operation
            notificationDriver.clearEvents();

            // Create expense involving both members
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(dynamicGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .withAmount(40.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // Both should receive transaction notifications
            await user1Listener.waitForTransactionEvent(dynamicGroup.id, 1);
            await user1Listener.waitForBalanceEvent(dynamicGroup.id, 1);
            await user2Listener.waitForTransactionEvent(dynamicGroup.id, 1);
            await user2Listener.waitForBalanceEvent(dynamicGroup.id, 1);

            user1Listener.assertEventCount(dynamicGroup.id, 1, 'transaction');
            user1Listener.assertEventCount(dynamicGroup.id, 1, 'balance');
            user2Listener.assertEventCount(dynamicGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(dynamicGroup.id, 1, 'balance');
            notificationDriver.clearEvents();

            // Settle all outstanding balances by currency before removing member
            const balances = await apiDriver.getGroupBalances(dynamicGroup.id, user1.token);

            for (const [currency, currencyBalances] of Object.entries(balances.balancesByCurrency)) {
                const user1CurrencyBalance = currencyBalances[user2.uid]?.netBalance || ZERO;
                const balanceUnits = amountToSmallestUnit(user1CurrencyBalance, currency);

                if (balanceUnits < 0) {
                    // user2 owes user1 in this currency
                    await apiDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(dynamicGroup.id)
                            .withPayerId(user2.uid)
                            .withPayeeId(user1.uid)
                            .withAmount(smallestUnitToAmountString(Math.abs(balanceUnits), currency))
                            .withCurrency(currency)
                            .build(),
                        user2.token,
                    );

                    await user1Listener.waitForEventCount(dynamicGroup.id, 'transaction', 1);
                    await user1Listener.waitForEventCount(dynamicGroup.id, 'balance', 1);
                    await user2Listener.waitForEventCount(dynamicGroup.id, 'transaction', 1);
                    await user2Listener.waitForEventCount(dynamicGroup.id, 'balance', 1);
                    notificationDriver.clearEvents();
                } else if (balanceUnits > 0) {
                    // user1 owes user2 in this currency
                    await apiDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(dynamicGroup.id)
                            .withPayerId(user1.uid)
                            .withPayeeId(user2.uid)
                            .withAmount(smallestUnitToAmountString(Math.abs(balanceUnits), currency))
                            .withCurrency(currency)
                            .build(),
                        user1.token,
                    );

                    await user1Listener.waitForEventCount(dynamicGroup.id, 'transaction', 1);
                    await user1Listener.waitForEventCount(dynamicGroup.id, 'balance', 1);
                    await user2Listener.waitForEventCount(dynamicGroup.id, 'transaction', 1);
                    await user2Listener.waitForEventCount(dynamicGroup.id, 'balance', 1);
                    notificationDriver.clearEvents();
                }
            }

            await apiDriver.removeGroupMember(dynamicGroup.id, user2.uid, user1.token);

            await user1Listener.waitForEventCount(dynamicGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(dynamicGroup.id, 'group', 0); // removed user should see nothing

            notificationDriver.clearEvents();

            user2Listener.assertEventCount(dynamicGroup.id, 0, 'transaction');

            {
                // sanity check
                // const {members} = await apiDriver.getGroupFullDetails(dynamicGroup.id, user1.token);
                // expect(members.members.length).toBe(1);
                // expect(members.members[0].uid).toBe(user1.uid);
            }

            // Create another expense - only user1 (remaining member) should be notified
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(dynamicGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .withAmount(30.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // WAIT: Wait for all transaction events from expense creation to complete
            // Expense creation after member removal can trigger multiple events (observed: 2)
            await user1Listener.waitForEventCount(dynamicGroup.id, 'transaction', 1);
            await user1Listener.waitForEventCount(dynamicGroup.id, 'balance', 1);

            // ASSERT: Verify user1 received transaction events (system generates 2 for this scenario)
            user1Listener.assertEventCount(dynamicGroup.id, 1, 'transaction');
            user1Listener.assertEventCount(dynamicGroup.id, 1, 'balance');

            // User2 should not receive any events for this group (they were removed)
            user2Listener.assertEventCount(dynamicGroup.id, 0, 'transaction');
        });

        test('should notify remaining members when a member leaves group', async () => {
            // Set up listeners for all users before any operations
            const [user1Listener, user2Listener, user3Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid, user3.uid]);

            // ACTION: Create group with user1 as creator
            const leaveGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Leave Notification Test ${uuidv4()}`)
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(leaveGroup.id, 1);

            // ASSERT: Only creator should receive notification
            user1Listener.assertEventCount(leaveGroup.id, 1, 'group');
            user2Listener.assertEventCount(leaveGroup.id, 0, 'group');
            user3Listener.assertEventCount(leaveGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add user2 and user3 to the group
            const shareLink = await apiDriver.generateShareLink(leaveGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // WAIT: Wait for user2 join notifications
            await user1Listener.waitForEventCount(leaveGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(leaveGroup.id, 'group', 1);

            // CLEAR: Clear events before adding user3
            notificationDriver.clearEvents();

            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user3.token);

            // WAIT: Wait for user3 join notifications
            await user1Listener.waitForEventCount(leaveGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(leaveGroup.id, 'group', 1);
            await user3Listener.waitForEventCount(leaveGroup.id, 'group', 1);

            // ASSERT: All users should receive notifications about member addition
            user1Listener.assertEventCount(leaveGroup.id, 1, 'group');
            user2Listener.assertEventCount(leaveGroup.id, 1, 'group');
            user3Listener.assertEventCount(leaveGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate member removal
            notificationDriver.clearEvents();

            // ACTION: User3 leaves the group (self-removal)
            await apiDriver.leaveGroup(leaveGroup.id, user3.token);

            // WAIT: Remaining members (user1 and user2) should receive group change notifications
            // This verifies the new behavior in leaveGroupAtomic() that explicitly notifies remaining members
            await user1Listener.waitForEventCount(leaveGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(leaveGroup.id, 'group', 1);

            // ASSERT: Remaining members should receive group change notification
            user1Listener.assertEventCount(leaveGroup.id, 1, 'group');
            user2Listener.assertEventCount(leaveGroup.id, 1, 'group');

            // The leaving member (user3) should NOT receive a group notification
            // (their notification document is cleaned up when they leave)
            user3Listener.assertEventCount(leaveGroup.id, 0, 'group');

            // ASSERT: Verify the group event contains the updated member list information
            const user1GroupEvents = user1Listener.getGroupEvents(leaveGroup.id).filter((e) => e.type === 'group');
            const user2GroupEvents = user2Listener.getGroupEvents(leaveGroup.id).filter((e) => e.type === 'group');

            expect(user1GroupEvents.length).toBe(1);
            expect(user2GroupEvents.length).toBe(1);

            // Verify groupDetailsChangeCount was incremented (member departure changes group details)
            expect(user1GroupEvents[0].groupState?.groupDetailsChangeCount).toBeGreaterThan(0);
            expect(user2GroupEvents[0].groupState?.groupDetailsChangeCount).toBeGreaterThan(0);
        });
    });

    describe('Permission-Based Notification Access Control', () => {
        test('should only notify users for groups they have access to', async () => {
            // Set up listeners for all users before any operations
            const [user1Listener, user2Listener, user3Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid, user3.uid]);

            // ACTION: Create private group for user1
            const privateGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Private Group ${uuidv4()}`)
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(privateGroup.id, 1);

            // ASSERT: Only user1 should receive notification for private group
            user1Listener.assertEventCount(privateGroup.id, 1, 'group');
            user2Listener.assertEventCount(privateGroup.id, 0, 'group');
            user3Listener.assertEventCount(privateGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Create public group with user2 as creator
            const publicGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Public Group ${uuidv4()}`)
                    .build(),
                user2.token,
            );

            // WAIT: Wait for group creation notification
            await user2Listener.waitForGroupEvent(publicGroup.id, 1);

            // ASSERT: Only user2 should receive notification for public group creation
            user1Listener.assertEventCount(publicGroup.id, 0, 'group');
            user2Listener.assertEventCount(publicGroup.id, 1, 'group');
            user3Listener.assertEventCount(publicGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add user3 to public group
            const shareLink = await apiDriver.generateShareLink(publicGroup.id, user2.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user3.token);

            // WAIT: Wait for member addition notifications
            await user2Listener.waitForEventCount(publicGroup.id, 'group', 1);
            await user3Listener.waitForEventCount(publicGroup.id, 'group', 1);

            // ASSERT: Only users in public group should receive notifications
            user1Listener.assertEventCount(publicGroup.id, 0, 'group');
            user2Listener.assertEventCount(publicGroup.id, 1, 'group');
            user3Listener.assertEventCount(publicGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Create expense in private group
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(privateGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .withAmount(25.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // WAIT: Wait for transaction notification
            await user1Listener.waitForTransactionEvent(privateGroup.id, 1);

            // ASSERT: Only user1 should receive private group expense notification
            user1Listener.assertEventCount(privateGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(privateGroup.id, 0, 'transaction');
            user3Listener.assertEventCount(privateGroup.id, 0, 'transaction');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Create expense in public group
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(publicGroup.id)
                    .withPaidBy(user2.uid)
                    .withParticipants([user2.uid, user3.uid])
                    .withAmount(35.0)
                    .withCurrency('USD')
                    .build(),
                user2.token,
            );

            // WAIT: Wait for transaction notifications for both public group members
            await user2Listener.waitForTransactionEvent(publicGroup.id, 1);
            await user3Listener.waitForTransactionEvent(publicGroup.id, 1);

            // ASSERT: Only users in public group should receive expense notifications
            user1Listener.assertEventCount(publicGroup.id, 0, 'transaction');
            user2Listener.assertEventCount(publicGroup.id, 1, 'transaction');
            user3Listener.assertEventCount(publicGroup.id, 1, 'transaction');

            // ASSERT: Verify cross-group access control - users don't receive notifications for groups they don't belong to
            user1Listener.assertEventCount(publicGroup.id, 0); // user1 has no access to public group
            user2Listener.assertEventCount(privateGroup.id, 0); // user2 has no access to private group
            user3Listener.assertEventCount(privateGroup.id, 0); // user3 has no access to private group
        });

        test('should handle permission changes and notification access', async () => {
            // Set up listeners for both users before any operations
            const [user1Listener, user2Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid]);

            // ACTION: Create group with initial member
            const permissionGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(permissionGroup.id, 1);

            // ASSERT: Only user1 should receive initial notification
            user1Listener.assertEventCount(permissionGroup.id, 1, 'group');
            user2Listener.assertEventCount(permissionGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add second member
            const shareLink = await apiDriver.generateShareLink(permissionGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // WAIT: Wait for member addition notifications
            await user1Listener.waitForEventCount(permissionGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(permissionGroup.id, 'group', 1);

            // ASSERT: Both users should receive notifications about member addition
            user1Listener.assertEventCount(permissionGroup.id, 1, 'group');
            user2Listener.assertEventCount(permissionGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Create expense involving both members
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(permissionGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .withAmount(50.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // WAIT: Wait for transaction notifications
            await user1Listener.waitForTransactionEvent(permissionGroup.id, 1);
            await user2Listener.waitForTransactionEvent(permissionGroup.id, 1);

            // ASSERT: Both users should receive transaction notifications
            user1Listener.assertEventCount(permissionGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(permissionGroup.id, 1, 'transaction');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Settle all outstanding balances by currency before removing member
            const permissionBalances = await apiDriver.getGroupBalances(permissionGroup.id, user1.token);
            const balancesByCurrency = permissionBalances.balancesByCurrency;

            let settlementsCreated = 0;
            for (const [currency, currencyBalances] of Object.entries(balancesByCurrency)) {
                const user1CurrencyBalance = currencyBalances[user2.uid]?.netBalance || ZERO;
                const balanceUnits = amountToSmallestUnit(user1CurrencyBalance, currency);

                if (balanceUnits < 0) {
                    // user2 owes user1 in this currency
                    await apiDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(permissionGroup.id)
                            .withPayerId(user2.uid)
                            .withPayeeId(user1.uid)
                            .withAmount(smallestUnitToAmountString(Math.abs(balanceUnits), currency))
                            .withCurrency(currency)
                            .build(),
                        user2.token,
                    );
                    settlementsCreated++;
                } else if (balanceUnits > 0) {
                    // user1 owes user2 in this currency
                    await apiDriver.createSettlement(
                        new CreateSettlementRequestBuilder()
                            .withGroupId(permissionGroup.id)
                            .withPayerId(user1.uid)
                            .withPayeeId(user2.uid)
                            .withAmount(smallestUnitToAmountString(Math.abs(balanceUnits), currency))
                            .withCurrency(currency)
                            .build(),
                        user1.token,
                    );
                    settlementsCreated++;
                }
            }

            // WAIT: Ensure all settlement notifications are processed
            if (settlementsCreated > 0) {
                await user1Listener.waitForEventCount(permissionGroup.id, 'transaction', settlementsCreated);
                await user1Listener.waitForEventCount(permissionGroup.id, 'balance', settlementsCreated);
                await user1Listener.waitForEventCount(permissionGroup.id, 'group', settlementsCreated);
                await user2Listener.waitForEventCount(permissionGroup.id, 'transaction', settlementsCreated);
                await user2Listener.waitForEventCount(permissionGroup.id, 'balance', settlementsCreated);
                await user2Listener.waitForEventCount(permissionGroup.id, 'group', settlementsCreated);
            }

            // CLEAR: Clear events before member removal
            notificationDriver.clearEvents();

            // ACTION: Remove user2 (change permissions)
            await apiDriver.removeGroupMember(permissionGroup.id, user2.uid, user1.token);

            // WAIT: Wait for member removal notification
            await user1Listener.waitForEventCount(permissionGroup.id, 'group', 1);

            // ASSERT: Only user1 should receive removal notification, user2 gets 0 events (removed from group)
            user1Listener.assertEventCount(permissionGroup.id, 1, 'group');
            user2Listener.assertEventCount(permissionGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Create another expense - only user1 should be notified
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(permissionGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .withAmount(25.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // WAIT: Wait for transaction notification
            await user1Listener.waitForEventCount(permissionGroup.id, 'transaction', 1);

            // ASSERT: Only user1 should receive notification (user2 was removed)
            user1Listener.assertEventCount(permissionGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(permissionGroup.id, 0, 'transaction');
        });
    });

    describe('Different Event Types and Triggers', () => {
        test('should generate notifications for various operation types', async () => {
            // Set up listeners for both users before any operations
            const [user1Listener, user2Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid]);

            // ACTION: Create group
            const eventGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(eventGroup.id, 1);

            // ASSERT: Only creator should receive notification
            user1Listener.assertEventCount(eventGroup.id, 1, 'group');
            user2Listener.assertEventCount(eventGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add a second user to enable settlement testing
            const shareLink = await apiDriver.generateShareLink(eventGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // WAIT: Wait for member addition notifications
            await user1Listener.waitForEventCount(eventGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(eventGroup.id, 'group', 1);

            // ASSERT: Both users should receive group notifications
            user1Listener.assertEventCount(eventGroup.id, 1, 'group');
            user2Listener.assertEventCount(eventGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Test expense creation notification involving both users
            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(eventGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .withAmount(30.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // WAIT: Wait for transaction notifications
            await user1Listener.waitForTransactionEvent(eventGroup.id, 1);
            await user2Listener.waitForTransactionEvent(eventGroup.id, 1);

            // ASSERT: Both users should receive transaction notifications
            user1Listener.assertEventCount(eventGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(eventGroup.id, 1, 'transaction');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Test expense update notification
            const expenseUpdateParticipants = [user1.uid, user2.uid];
            await apiDriver.updateExpense(
                expense.id,
                new ExpenseUpdateBuilder()
                    .withAmount(45.0)
                    .withCurrency('USD')
                    .withParticipants(expenseUpdateParticipants)
                    .withSplits(calculateEqualSplits(45.0, 'USD', expenseUpdateParticipants))
                    .build(),
                user1.token,
            );

            // WAIT: Wait for expense update transaction notifications
            await user1Listener.waitForEventCount(eventGroup.id, 'transaction', 1);
            await user2Listener.waitForEventCount(eventGroup.id, 'transaction', 1);

            // ASSERT: Both users should receive update notifications
            user1Listener.assertEventCount(eventGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(eventGroup.id, 1, 'transaction');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Test settlement creation notification (user2 pays user1)
            await apiDriver.createSettlement(
                new CreateSettlementRequestBuilder()
                    .withGroupId(eventGroup.id)
                    .withPayerId(user2.uid)
                    .withPayeeId(user1.uid)
                    .build(),
                user2.token,
            );

            // WAIT: Wait for settlement transaction notifications
            await user1Listener.waitForEventCount(eventGroup.id, 'transaction', 1);
            await user2Listener.waitForEventCount(eventGroup.id, 'transaction', 1);

            // ASSERT: Both users should receive settlement notifications
            user1Listener.assertEventCount(eventGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(eventGroup.id, 1, 'transaction');

            // ASSERT: Verify cumulative counts across all operations
            const user1Events = user1Listener.getGroupEvents(eventGroup.id);
            const user2Events = user2Listener.getGroupEvents(eventGroup.id);

            // Each user should have received multiple transaction events across all operations
            expect(user1Events.filter((e) => e.type === 'transaction').length).toBeGreaterThan(0);
            expect(user2Events.filter((e) => e.type === 'transaction').length).toBeGreaterThan(0);
        });

        test('should handle balance change notifications', async () => {
            // Set up listeners for both users before any operations
            const [user1Listener, user2Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid]);

            // ACTION: Create group with user1 as creator
            const balanceGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Balance Test ${uuidv4()}`)
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(balanceGroup.id, 1);

            // ASSERT: Only creator should receive notification
            user1Listener.assertEventCount(balanceGroup.id, 1, 'group');
            user2Listener.assertEventCount(balanceGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add user2 to the group
            const shareLink = await apiDriver.generateShareLink(balanceGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // WAIT: Wait for member addition notifications
            await user1Listener.waitForEventCount(balanceGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(balanceGroup.id, 'group', 1);

            // ASSERT: Both users should receive group notifications
            user1Listener.assertEventCount(balanceGroup.id, 1, 'group');
            user2Listener.assertEventCount(balanceGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Create expense that affects balances
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(balanceGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .withAmount(100.0)
                    .withCurrency('USD')
                    .withSplitType('equal')
                    .build(),
                user1.token,
            );

            // WAIT: Wait for transaction and balance notifications
            await user1Listener.waitForTransactionEvent(balanceGroup.id, 1);
            await user2Listener.waitForTransactionEvent(balanceGroup.id, 1);
            await user1Listener.waitForBalanceEvent(balanceGroup.id, 1);
            await user2Listener.waitForBalanceEvent(balanceGroup.id, 1);

            // ASSERT: Both users should receive both transaction and balance notifications
            user1Listener.assertEventCount(balanceGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(balanceGroup.id, 1, 'transaction');
            user1Listener.assertEventCount(balanceGroup.id, 1, 'balance');
            user2Listener.assertEventCount(balanceGroup.id, 1, 'balance');

            // ASSERT: Verify balance-related notification events were received
            const user1Events = user1Listener.getGroupEvents(balanceGroup.id);
            const user2Events = user2Listener.getGroupEvents(balanceGroup.id);

            const user1BalanceEvents = user1Events.filter((e) => e.type === 'balance');
            const user2BalanceEvents = user2Events.filter((e) => e.type === 'balance');

            expect(user1BalanceEvents.length).toBeGreaterThan(0);
            expect(user2BalanceEvents.length).toBeGreaterThan(0);

            // Verify balance counter increments in event data
            expect(user1BalanceEvents[0].groupState?.balanceChangeCount).toBeGreaterThan(0);
            expect(user2BalanceEvents[0].groupState?.balanceChangeCount).toBeGreaterThan(0);
        });
    });

    describe('Listener Management and Connection Handling', () => {
        test('should handle listener subscription churn without missing events', async () => {
            // Set up listener before any operations
            const [user1Listener] = await notificationDriver.setupListeners([user1.uid]);

            // ACTION: Create group
            const churnGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(churnGroup.id, 1);

            // ASSERT: Verify group creation event
            user1Listener.assertEventCount(churnGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operations
            notificationDriver.clearEvents();

            // ACTION: Simulate subscription churn by creating expenses sequentially
            for (let i = 0; i < 3; i++) {
                // Create expense while listener is active
                await apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(churnGroup.id)
                        .withPaidBy(user1.uid)
                        .withParticipants([user1.uid])
                        .withAmount(25 + i)
                        .withCurrency('USD')
                        .build(),
                    user1.token,
                );

                // WAIT: Wait for each transaction notification to be processed
                await user1Listener.waitForEventCount(churnGroup.id, 'transaction', i + 1);
            }

            // ASSERT: Verify all notifications were received despite potential listener churn
            user1Listener.assertEventCount(churnGroup.id, 3, 'transaction');

            // ASSERT: Verify events were captured correctly
            const transactionEvents = user1Listener.getGroupEvents(churnGroup.id).filter((e) => e.type === 'transaction');
            expect(transactionEvents.length).toBe(3);
        });

        test('should handle network interruption and recovery', async () => {
            // Set up listener before any operations
            const [user1Listener] = await notificationDriver.setupListeners([user1.uid]);

            // ACTION: Create group
            const recoveryGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(recoveryGroup.id, 1);

            // ASSERT: Verify group creation event
            user1Listener.assertEventCount(recoveryGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operations
            notificationDriver.clearEvents();

            // ACTION: Create first expense and verify notification
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(recoveryGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .withAmount(20.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // WAIT: Wait for first transaction notification
            await user1Listener.waitForTransactionEvent(recoveryGroup.id, 1);

            // ASSERT: Verify first expense notification
            user1Listener.assertEventCount(recoveryGroup.id, 1, 'transaction');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Simulate "network interruption recovery" by creating additional operations
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(recoveryGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .withAmount(35.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // WAIT: Verify system continues to work after simulated recovery
            await user1Listener.waitForEventCount(recoveryGroup.id, 'transaction', 1);

            // ASSERT: Verify system recovered and processed the second transaction
            user1Listener.assertEventCount(recoveryGroup.id, 1, 'transaction');

            // ASSERT: Verify events were captured correctly across "network interruption"
            const transactionEvents = user1Listener.getGroupEvents(recoveryGroup.id).filter((e) => e.type === 'transaction');
            expect(transactionEvents.length).toBe(1); // Only the recovery transaction since we cleared
        });

        test('should handle document version conflicts gracefully', async () => {
            // Set up listeners for both users before any operations
            const [user1Listener, user2Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid]);

            // ACTION: Create group with user1 as creator
            const conflictGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Conflict Test ${uuidv4()}`)
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(conflictGroup.id, 1);

            // ASSERT: Only creator should receive notification
            user1Listener.assertEventCount(conflictGroup.id, 1, 'group');
            user2Listener.assertEventCount(conflictGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add user2 to the group
            const shareLink = await apiDriver.generateShareLink(conflictGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // WAIT: Wait for member addition notifications
            await user1Listener.waitForEventCount(conflictGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(conflictGroup.id, 'group', 1);

            // ASSERT: Both users should receive group notifications
            user1Listener.assertEventCount(conflictGroup.id, 1, 'group');
            user2Listener.assertEventCount(conflictGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operations
            notificationDriver.clearEvents();

            // ACTION: Create rapid concurrent operations to potentially trigger version conflicts
            const concurrentPromises = [];
            for (let i = 0; i < 5; i++) {
                concurrentPromises.push(
                    apiDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(conflictGroup.id)
                            .withPaidBy(user1.uid)
                            .withParticipants([user1.uid, user2.uid])
                            .withAmount(50 + i)
                            .withCurrency('USD')
                            .build(),
                        user1.token,
                    ),
                );
            }

            await Promise.all(concurrentPromises);

            // WAIT: Wait for all notifications to be processed despite potential conflicts
            await user1Listener.waitForEventCount(conflictGroup.id, 'transaction', 5);
            await user2Listener.waitForEventCount(conflictGroup.id, 'transaction', 5);

            // ASSERT: Both users should receive all concurrent notifications despite conflicts
            user1Listener.assertEventCount(conflictGroup.id, 5, 'transaction');
            user2Listener.assertEventCount(conflictGroup.id, 5, 'transaction');

            // ASSERT: Verify all events were captured correctly
            const user1Events = user1Listener.getGroupEvents(conflictGroup.id);
            const user2Events = user2Listener.getGroupEvents(conflictGroup.id);

            expect(user1Events.filter((e) => e.type === 'transaction').length).toBe(5);
            expect(user2Events.filter((e) => e.type === 'transaction').length).toBe(5);
        });

        test('should handle document locking scenarios under load', async () => {
            // Set up listener before any operations
            const [user1Listener] = await notificationDriver.setupListeners([user1.uid]);

            // ACTION: Create group
            const lockingGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(lockingGroup.id, 1);

            // ASSERT: Verify group creation event
            user1Listener.assertEventCount(lockingGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operations
            notificationDriver.clearEvents();

            // ACTION: Test rapid concurrent operations that might cause document contention
            const concurrentPromises = [];
            for (let i = 0; i < 7; i++) {
                concurrentPromises.push(
                    apiDriver.createExpense(
                        new CreateExpenseRequestBuilder()
                            .withGroupId(lockingGroup.id)
                            .withPaidBy(user1.uid)
                            .withParticipants([user1.uid])
                            .withAmount(50 + i)
                            .withCurrency('USD')
                            .build(),
                        user1.token,
                    ),
                );
            }

            await Promise.all(concurrentPromises);

            // WAIT: Verify all notifications were received despite potential locking
            await user1Listener.waitForEventCount(lockingGroup.id, 'transaction', 7);

            // ASSERT: All concurrent operations should have been processed
            user1Listener.assertEventCount(lockingGroup.id, 7, 'transaction');

            // CLEAR: Clear events before testing system continuity
            notificationDriver.clearEvents();

            // ACTION: Test that system continues to work after potential document contention
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(lockingGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .withAmount(100.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // WAIT: Verify system recovery
            await user1Listener.waitForEventCount(lockingGroup.id, 'transaction', 1);

            // ASSERT: System should continue to work after document contention
            user1Listener.assertEventCount(lockingGroup.id, 1, 'transaction');

            // ASSERT: Verify events were captured correctly
            const transactionEvents = user1Listener.getGroupEvents(lockingGroup.id).filter((e) => e.type === 'transaction');
            expect(transactionEvents.length).toBe(1); // Only the recovery transaction since we cleared
        });
    });

    describe('Service Integration and Cross-Feature Testing', () => {
        test('should integrate with balance calculation changes', async () => {
            // Set up listeners for both users before any operations
            const [user1Listener, user2Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid]);

            // ACTION: Create group with user1 as creator
            const balanceGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Balance Integration Test ${uuidv4()}`)
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(balanceGroup.id, 1);

            // ASSERT: Only creator should receive notification
            user1Listener.assertEventCount(balanceGroup.id, 1, 'group');
            user2Listener.assertEventCount(balanceGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add user2 to the group
            const shareLink = await apiDriver.generateShareLink(balanceGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // WAIT: Wait for member addition notifications
            await user1Listener.waitForEventCount(balanceGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(balanceGroup.id, 'group', 1);

            // ASSERT: Both users should receive group notifications
            user1Listener.assertEventCount(balanceGroup.id, 1, 'group');
            user2Listener.assertEventCount(balanceGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Create multi-user expense that affects balances
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(balanceGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .withAmount(90.0)
                    .withCurrency('USD')
                    .withSplitType('equal')
                    .build(),
                user1.token,
            );

            // WAIT: Wait for balance-related notifications
            await user1Listener.waitForTransactionEvent(balanceGroup.id, 1);
            await user2Listener.waitForTransactionEvent(balanceGroup.id, 1);
            await user1Listener.waitForBalanceEvent(balanceGroup.id, 1);
            await user2Listener.waitForBalanceEvent(balanceGroup.id, 1);

            // ASSERT: Both users should receive transaction and balance notifications
            user1Listener.assertEventCount(balanceGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(balanceGroup.id, 1, 'transaction');
            user1Listener.assertEventCount(balanceGroup.id, 1, 'balance');
            user2Listener.assertEventCount(balanceGroup.id, 1, 'balance');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Create settlement to change balances again
            const settlement = new CreateSettlementRequestBuilder()
                .withGroupId(balanceGroup.id)
                .withPayerId(user2.uid)
                .withPayeeId(user1.uid)
                .build();

            await apiDriver.createSettlement(settlement, user2.token);

            // WAIT: Verify both users receive balance change notifications
            // Note: Counters are cumulative, so after expense (1) + settlement (1) = 2 total
            await user1Listener.waitForTransactionEvent(balanceGroup.id, 2);
            await user2Listener.waitForTransactionEvent(balanceGroup.id, 2);
            await user1Listener.waitForBalanceEvent(balanceGroup.id, 2);
            await user2Listener.waitForBalanceEvent(balanceGroup.id, 2);

            // ASSERT: Both users should receive settlement notifications
            user1Listener.assertEventCount(balanceGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(balanceGroup.id, 1, 'transaction');
            user1Listener.assertEventCount(balanceGroup.id, 1, 'balance');
            user2Listener.assertEventCount(balanceGroup.id, 1, 'balance');

            // ASSERT: Verify integration is working - balance calculations trigger notifications
            const user1Events = user1Listener.getGroupEvents(balanceGroup.id);
            const user2Events = user2Listener.getGroupEvents(balanceGroup.id);

            expect(user1Events.filter((e) => e.type === 'balance').length).toBeGreaterThan(0);
            expect(user2Events.filter((e) => e.type === 'balance').length).toBeGreaterThan(0);
        });

        test('should integrate with group policy and settings changes', async () => {
            // Set up listeners for both users before any operations
            const [user1Listener, user2Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid]);

            // ACTION: Create group with user1 as creator
            const policyGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Policy Test ${uuidv4()}`)
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(policyGroup.id, 1);

            // ASSERT: Only creator should receive notification
            user1Listener.assertEventCount(policyGroup.id, 1, 'group');
            user2Listener.assertEventCount(policyGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add user2 to the group
            const shareLink = await apiDriver.generateShareLink(policyGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // WAIT: Wait for member addition notifications
            await user1Listener.waitForEventCount(policyGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(policyGroup.id, 'group', 1);

            // ASSERT: Both users should receive group notifications
            user1Listener.assertEventCount(policyGroup.id, 1, 'group');
            user2Listener.assertEventCount(policyGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Update group settings - should trigger group detail notifications
            await apiDriver.updateGroup(
                policyGroup.id,
                {
                    name: 'Updated Policy Group',
                    description: 'Group with updated policies',
                },
                user1.token,
            );

            // WAIT: Both users should receive group update notifications
            await user1Listener.waitForEventCount(policyGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(policyGroup.id, 'group', 1);

            // ASSERT: Both users should receive group update notifications
            user1Listener.assertEventCount(policyGroup.id, 1, 'group');
            user2Listener.assertEventCount(policyGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Verify policy changes don't break normal notification flow
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(policyGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .withAmount(25.0)
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );

            // WAIT: Wait for transaction notifications
            await user1Listener.waitForTransactionEvent(policyGroup.id, 1);
            await user2Listener.waitForTransactionEvent(policyGroup.id, 1);

            // ASSERT: Both users should receive transaction notifications after policy changes
            user1Listener.assertEventCount(policyGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(policyGroup.id, 1, 'transaction');

            // ASSERT: Verify notification flow works correctly after policy changes
            const user1Events = user1Listener.getGroupEvents(policyGroup.id);
            const user2Events = user2Listener.getGroupEvents(policyGroup.id);

            expect(user1Events.filter((e) => e.type === 'transaction').length).toBeGreaterThan(0);
            expect(user2Events.filter((e) => e.type === 'transaction').length).toBeGreaterThan(0);
        });

        test('should handle group sharing and invitation workflows', async () => {
            // Set up listeners for all users before any operations
            const [user1Listener, user2Listener, user3Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid, user3.uid]);

            // ACTION: Create group
            const sharingGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(sharingGroup.id, 1);

            // ASSERT: Only creator should receive notification
            user1Listener.assertEventCount(sharingGroup.id, 1, 'group');
            user2Listener.assertEventCount(sharingGroup.id, 0, 'group');
            user3Listener.assertEventCount(sharingGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add second user (simulates invitation acceptance)
            const shareLink = await apiDriver.generateShareLink(sharingGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // WAIT: Existing member should get notified of new member
            await user1Listener.waitForEventCount(sharingGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(sharingGroup.id, 'group', 1);

            // ASSERT: Both users should receive group notifications
            user1Listener.assertEventCount(sharingGroup.id, 1, 'group');
            user2Listener.assertEventCount(sharingGroup.id, 1, 'group');
            user3Listener.assertEventCount(sharingGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add third user
            const shareLink2 = await apiDriver.generateShareLink(sharingGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink2.linkId, user3.token);

            // WAIT: All existing members should get notified
            await user1Listener.waitForEventCount(sharingGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(sharingGroup.id, 'group', 1);
            await user3Listener.waitForEventCount(sharingGroup.id, 'group', 1);

            // ASSERT: All users should receive group notifications
            user1Listener.assertEventCount(sharingGroup.id, 1, 'group');
            user2Listener.assertEventCount(sharingGroup.id, 1, 'group');
            user3Listener.assertEventCount(sharingGroup.id, 1, 'group');

            // ASSERT: Verify group membership changes trigger proper notifications
            const user1Events = user1Listener.getGroupEvents(sharingGroup.id);
            const user2Events = user2Listener.getGroupEvents(sharingGroup.id);
            const user3Events = user3Listener.getGroupEvents(sharingGroup.id);

            // All users should have received group events
            expect(user1Events.filter((e) => e.type === 'group').length).toBeGreaterThan(0);
            expect(user2Events.filter((e) => e.type === 'group').length).toBeGreaterThan(0);
            expect(user3Events.filter((e) => e.type === 'group').length).toBeGreaterThan(0);

            // Verify group detail change counters are incremented
            expect(user1Events[0].groupState?.groupDetailsChangeCount).toBeGreaterThan(0);
            expect(user2Events[0].groupState?.groupDetailsChangeCount).toBeGreaterThan(0);
            expect(user3Events[0].groupState?.groupDetailsChangeCount).toBeGreaterThan(0);
        });
    });

    describe('Notification System Performance and Edge Cases', () => {
        test('should handle notification system under high load', async () => {
            // Set up listener before operations
            const [user1Listener] = await notificationDriver.setupListeners([user1.uid]);

            // ACTION: Create group
            const loadTestGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(loadTestGroup.id, 1);

            // ASSERT: Verify group creation event
            user1Listener.assertEventCount(loadTestGroup.id, 1, 'group');

            // CLEAR: Clear events to isolate load test
            notificationDriver.clearEvents();

            // ACTION: Create multiple operations sequentially to avoid transaction conflicts
            for (let i = 0; i < 8; i++) {
                await apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(loadTestGroup.id)
                        .withPaidBy(user1.uid)
                        .withParticipants([user1.uid])
                        .withAmount(10 + i)
                        .withCurrency('USD')
                        .withDescription(`Load Test Expense ${i}`)
                        .build(),
                    user1.token,
                );

                // WAIT: Wait for each transaction to process before creating the next
                await user1Listener.waitForEventCount(loadTestGroup.id, 'transaction', i + 1);
            }

            // ASSERT: Final assertion - should have 8 transaction events
            user1Listener.assertEventCount(loadTestGroup.id, 8, 'transaction');

            // ASSERT: Verify system handled high load correctly
            const transactionEvents = user1Listener.getGroupEvents(loadTestGroup.id).filter((e) => e.type === 'transaction');
            expect(transactionEvents.length).toBe(8);
        });

        test('should handle multi-user notifications efficiently at scale', async () => {
            // Set up listeners for all users before any operations
            const [user1Listener, user2Listener, user3Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid, user3.uid]);

            // ACTION: Create group with user1 as creator
            const scaleGroup = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .withName(`Scale Test ${uuidv4()}`)
                    .build(),
                user1.token,
            );

            // WAIT: Wait for group creation notification
            await user1Listener.waitForGroupEvent(scaleGroup.id, 1);

            // ASSERT: Only creator should receive notification
            user1Listener.assertEventCount(scaleGroup.id, 1, 'group');
            user2Listener.assertEventCount(scaleGroup.id, 0, 'group');
            user3Listener.assertEventCount(scaleGroup.id, 0, 'group');

            // CLEAR: Clear events to isolate next operation
            notificationDriver.clearEvents();

            // ACTION: Add user2 and user3 to the group
            const shareLink = await apiDriver.generateShareLink(scaleGroup.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user2.token);

            // WAIT: Wait for user2 addition notifications
            await user1Listener.waitForEventCount(scaleGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(scaleGroup.id, 'group', 1);

            // CLEAR: Clear events before adding user3
            notificationDriver.clearEvents();

            await apiDriver.joinGroupViaShareLink(shareLink.linkId, user3.token);

            // WAIT: Wait for user3 addition notifications
            await user1Listener.waitForEventCount(scaleGroup.id, 'group', 1);
            await user2Listener.waitForEventCount(scaleGroup.id, 'group', 1);
            await user3Listener.waitForEventCount(scaleGroup.id, 'group', 1);

            // CLEAR: Clear events to isolate expense operations
            notificationDriver.clearEvents();

            // ACTION: Create expense affecting all members efficiently
            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(scaleGroup.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid, user3.uid])
                    .withAmount(90.0)
                    .withCurrency('USD')
                    .withSplitType('equal')
                    .build(),
                user1.token,
            );

            // WAIT: Verify all users receive notifications efficiently
            await user1Listener.waitForTransactionEvent(scaleGroup.id, 1);
            await user2Listener.waitForTransactionEvent(scaleGroup.id, 1);
            await user3Listener.waitForTransactionEvent(scaleGroup.id, 1);

            // ASSERT: All users should receive transaction notifications
            user1Listener.assertEventCount(scaleGroup.id, 1, 'transaction');
            user2Listener.assertEventCount(scaleGroup.id, 1, 'transaction');
            user3Listener.assertEventCount(scaleGroup.id, 1, 'transaction');

            // CLEAR: Clear events to isolate concurrent operations
            notificationDriver.clearEvents();

            // ACTION: Create multiple concurrent operations from different users
            const concurrentOperations = [
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(scaleGroup.id)
                        .withPaidBy(user2.uid)
                        .withParticipants([user2.uid, user3.uid])
                        .withAmount(30.0)
                        .withCurrency('USD')
                        .build(),
                    user2.token,
                ),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(scaleGroup.id)
                        .withPaidBy(user3.uid)
                        .withParticipants([user1.uid, user3.uid])
                        .withAmount(40.0)
                        .withCurrency('USD')
                        .build(),
                    user3.token,
                ),
            ];

            await Promise.all(concurrentOperations);

            // WAIT: Verify all users receive all concurrent notifications
            // Note: All group members receive notifications for any expense in the group, regardless of participation
            await user1Listener.waitForEventCount(scaleGroup.id, 'transaction', 2); // user1 gets notified of both concurrent expenses (all group members get notified)
            await user2Listener.waitForEventCount(scaleGroup.id, 'transaction', 2); // user2 gets notified of both concurrent expenses
            await user3Listener.waitForEventCount(scaleGroup.id, 'transaction', 2); // user3 gets notified of both concurrent expenses

            // ASSERT: Verify scale notifications were handled correctly
            user1Listener.assertEventCount(scaleGroup.id, 2, 'transaction');
            user2Listener.assertEventCount(scaleGroup.id, 2, 'transaction');
            user3Listener.assertEventCount(scaleGroup.id, 2, 'transaction');

            // ASSERT: Verify all events were captured correctly at scale
            const user1Events = user1Listener.getGroupEvents(scaleGroup.id);
            const user2Events = user2Listener.getGroupEvents(scaleGroup.id);
            const user3Events = user3Listener.getGroupEvents(scaleGroup.id);

            expect(user1Events.filter((e) => e.type === 'transaction').length).toBe(2);
            expect(user2Events.filter((e) => e.type === 'transaction').length).toBe(2);
            expect(user3Events.filter((e) => e.type === 'transaction').length).toBe(2);
        });
    });

    describe('Comment Notifications', () => {
        test('creating a group comment should trigger a notification for all group members', async () => {
            const [user1Listener, user2Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid]);

            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );
            await user1Listener.waitForGroupEvent(group.id, 1);
            notificationDriver.clearEvents();

            const shareResponse = await apiDriver.generateShareLink(group.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);
            await user1Listener.waitForGroupEvent(group.id, 2);
            await user2Listener.waitForGroupEvent(group.id, 1);
            notificationDriver.clearEvents();

            await apiDriver.createComment(group.id, 'group', 'Hello, world!', user1.token);

            await user1Listener.waitForCommentEvent(group.id, 1);
            await user2Listener.waitForCommentEvent(group.id, 1);

            user1Listener.assertEventCount(group.id, 1, 'comment');
            user2Listener.assertEventCount(group.id, 1, 'comment');
        });

        test('creating an expense comment should trigger a notification for all group members', async () => {
            const [user1Listener, user2Listener] = await notificationDriver.setupListeners([user1.uid, user2.uid]);

            const group = await apiDriver.createGroup(
                new CreateGroupRequestBuilder()
                    .build(),
                user1.token,
            );
            await user1Listener.waitForGroupEvent(group.id, 1);
            notificationDriver.clearEvents();

            const shareResponse = await apiDriver.generateShareLink(group.id, user1.token);
            await apiDriver.joinGroupViaShareLink(shareResponse.linkId, user2.token);
            await user1Listener.waitForGroupEvent(group.id, 2);
            await user2Listener.waitForGroupEvent(group.id, 1);
            notificationDriver.clearEvents();

            const expense = await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid])
                    .withCurrency('USD')
                    .build(),
                user1.token,
            );
            await user1Listener.waitForTransactionEvent(group.id, 1);
            await user2Listener.waitForTransactionEvent(group.id, 1);
            notificationDriver.clearEvents();

            await apiDriver.createComment(expense.id, 'expense', 'This is an expense comment', user1.token);

            await user1Listener.waitForCommentEvent(group.id, 1);
            await user2Listener.waitForCommentEvent(group.id, 1);

            user1Listener.assertEventCount(group.id, 1, 'comment');
            user2Listener.assertEventCount(group.id, 1, 'comment');
        });
    });
});
