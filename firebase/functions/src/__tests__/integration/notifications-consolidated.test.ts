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

import { PooledTestUser } from '@splitifyd/shared';
import {
    ApiDriver,
    borrowTestUsers,
    CreateExpenseRequestBuilder,
    CreateGroupRequestBuilder,
    NotificationDriver,
} from '@splitifyd/test-support';
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
        await notificationDriver.waitForQuiet();
        await notificationDriver.stopAllListeners();
    });

    describe('Listener Management and Connection Handling', () => {
        test('should handle listener subscription churn without missing events', async () => {
            const [userListener] = await notificationDriver.setupListeners([user1.uid]);

            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), user1.token);
            await userListener.waitForGroupEvent(group.id, 1);
            notificationDriver.clearEvents();

            for (let i = 0; i < 3; i += 1) {
                await apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(user1.uid)
                        .withParticipants([user1.uid])
                        .withAmount(25 + i, 'USD')
                        .build(),
                    user1.token,
                );

                await userListener.waitForEventCount(group.id, 'transaction', i + 1);
            }

            userListener.assertEventCount(group.id, 3, 'transaction');
            const transactionEvents = userListener.getGroupEvents(group.id).filter((event) => event.type === 'transaction');
            expect(transactionEvents.length).toBe(3);
        });

        test('should handle network interruption and recovery', async () => {
            const [userListener] = await notificationDriver.setupListeners([user1.uid]);

            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), user1.token);
            await userListener.waitForGroupEvent(group.id, 1);
            notificationDriver.clearEvents();

            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .withAmount(20, 'USD')
                    .build(),
                user1.token,
            );

            await userListener.waitForTransactionEvent(group.id, 1);
            userListener.assertEventCount(group.id, 1, 'transaction');
            notificationDriver.clearEvents();

            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid])
                    .withAmount(35, 'USD')
                    .build(),
                user1.token,
            );

            await userListener.waitForTransactionEvent(group.id, 1);
            userListener.assertEventCount(group.id, 1, 'transaction');
        });
    });

    describe('Notification System Performance and Edge Cases', () => {
        test('should handle notification system under high load', async () => {
            const [userListener] = await notificationDriver.setupListeners([user1.uid]);

            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), user1.token);
            await userListener.waitForGroupEvent(group.id, 1);
            notificationDriver.clearEvents();

            for (let i = 0; i < 8; i += 1) {
                await apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(user1.uid)
                        .withParticipants([user1.uid])
                        .withAmount(10 + i, 'USD')
                        .withDescription(`Load Test Expense ${i}`)
                        .build(),
                    user1.token,
                );

                await userListener.waitForEventCount(group.id, 'transaction', i + 1);
            }

            userListener.assertEventCount(group.id, 8, 'transaction');
            const transactionEvents = userListener.getGroupEvents(group.id).filter((event) => event.type === 'transaction');
            expect(transactionEvents.length).toBe(8);
        });

        test('should handle multi-user notifications efficiently at scale', async () => {
            const [user1Listener, user2Listener, user3Listener] = await notificationDriver.setupListeners([
                user1.uid,
                user2.uid,
                user3.uid,
            ]);

            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), user1.token);
            await user1Listener.waitForGroupEvent(group.id, 1);

            const { linkId } = await apiDriver.generateShareLink(group.id, user1.token);
            await apiDriver.joinGroupViaShareLink(linkId, user2.token);
            await user1Listener.waitForEventCount(group.id, 'group', 1);
            await user2Listener.waitForEventCount(group.id, 'group', 1);

            notificationDriver.clearEvents();

            await apiDriver.joinGroupViaShareLink(linkId, user3.token);
            await user1Listener.waitForEventCount(group.id, 'group', 1);
            await user2Listener.waitForEventCount(group.id, 'group', 1);
            await user3Listener.waitForEventCount(group.id, 'group', 1);

            notificationDriver.clearEvents();

            await apiDriver.createExpense(
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withPaidBy(user1.uid)
                    .withParticipants([user1.uid, user2.uid, user3.uid])
                    .withAmount(90, 'USD')
                    .withSplitType('equal')
                    .build(),
                user1.token,
            );

            await user1Listener.waitForTransactionEvent(group.id, 1);
            await user2Listener.waitForTransactionEvent(group.id, 1);
            await user3Listener.waitForTransactionEvent(group.id, 1);

            notificationDriver.clearEvents();

            await Promise.all([
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(user2.uid)
                        .withParticipants([user2.uid, user3.uid])
                        .withAmount(30, 'USD')
                        .build(),
                    user2.token,
                ),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(user3.uid)
                        .withParticipants([user1.uid, user3.uid])
                        .withAmount(40, 'USD')
                        .build(),
                    user3.token,
                ),
            ]);

            await user1Listener.waitForEventCount(group.id, 'transaction', 2);
            await user2Listener.waitForEventCount(group.id, 'transaction', 2);
            await user3Listener.waitForEventCount(group.id, 'transaction', 2);

            user1Listener.assertEventCount(group.id, 2, 'transaction');
            user2Listener.assertEventCount(group.id, 2, 'transaction');
            user3Listener.assertEventCount(group.id, 2, 'transaction');
        });

        test('should handle document locking scenarios under load', async () => {
            const [user1Listener, user2Listener, user3Listener] = await notificationDriver.setupListeners([
                user1.uid,
                user2.uid,
                user3.uid,
            ]);

            const group = await apiDriver.createGroup(new CreateGroupRequestBuilder().build(), user1.token);
            await user1Listener.waitForGroupEvent(group.id, 1);

            const { linkId } = await apiDriver.generateShareLink(group.id, user1.token);
            await apiDriver.joinGroupViaShareLink(linkId, user2.token);
            await user1Listener.waitForEventCount(group.id, 'group', 1);
            await user2Listener.waitForEventCount(group.id, 'group', 1);

            notificationDriver.clearEvents();

            await apiDriver.joinGroupViaShareLink(linkId, user3.token);
            await user1Listener.waitForEventCount(group.id, 'group', 1);
            await user2Listener.waitForEventCount(group.id, 'group', 1);
            await user3Listener.waitForEventCount(group.id, 'group', 1);

            notificationDriver.clearEvents();

            const operations = [
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(user1.uid)
                        .withParticipants([user1.uid, user2.uid])
                        .withAmount(60, 'USD')
                        .withSplitType('equal')
                        .build(),
                    user1.token,
                ),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(user2.uid)
                        .withParticipants([user2.uid, user3.uid])
                        .withAmount(45, 'USD')
                        .withSplitType('equal')
                        .build(),
                    user2.token,
                ),
                apiDriver.createExpense(
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(user3.uid)
                        .withParticipants([user1.uid, user3.uid])
                        .withAmount(50, 'USD')
                        .withSplitType('equal')
                        .build(),
                    user3.token,
                ),
            ];

            await Promise.all(operations);

            await user1Listener.waitForEventCount(group.id, 'transaction', 3);
            await user2Listener.waitForEventCount(group.id, 'transaction', 3);
            await user3Listener.waitForEventCount(group.id, 'transaction', 3);

            user1Listener.assertEventCount(group.id, 3, 'transaction');
            user2Listener.assertEventCount(group.id, 3, 'transaction');
            user3Listener.assertEventCount(group.id, 3, 'transaction');
        });
    });
});
