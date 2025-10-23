import type { StubFirestoreDatabase } from '@splitifyd/firebase-simulator';
import { calculateEqualSplits, GroupId } from '@splitifyd/shared';
import { CreateExpenseRequestBuilder, CreateGroupRequestBuilder, CreateSettlementRequestBuilder, GroupUpdateBuilder } from '@splitifyd/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppDriver } from '../AppDriver';

const flushMicrotasks = async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
};

interface NotificationSnapshot {
    exists: boolean;
    changeVersion: number;
    groups: Record<string, any>;
}

function createNotificationListener(db: StubFirestoreDatabase, userId: string) {
    const snapshots: NotificationSnapshot[] = [];

    const unsubscribe = db
        .collection('user-notifications')
        .doc(userId)
        .onSnapshot((snapshot) => {
            const data = snapshot.data();
            const clonedGroups = data?.groups ? JSON.parse(JSON.stringify(data.groups)) : {};
            snapshots.push({
                exists: snapshot.exists,
                changeVersion: data?.changeVersion ?? 0,
                groups: clonedGroups,
            });
        });

    const latest = () => snapshots[snapshots.length - 1];

    const waitFor = async (predicate: (snapshot: NotificationSnapshot) => boolean, timeoutMs = 250) => {
        const deadline = Date.now() + timeoutMs;

        while (Date.now() <= deadline) {
            await flushMicrotasks();
            const current = latest();
            if (current && predicate(current)) {
                return current;
            }
        }

        throw new Error(`Timed out waiting for notification update. Last snapshot: ${JSON.stringify(latest())}`);
    };

    return {
        unsubscribe,
        snapshots,
        latest,
        waitFor,
    };
}

type NotificationListenerHandle = ReturnType<typeof createNotificationListener>;

function waitForGroupState(
    listener: NotificationListenerHandle,
    groupId: GroupId,
    predicate: (state: any, snapshot: NotificationSnapshot) => boolean,
    timeoutMs?: number,
) {
    return listener
        .waitFor((doc) => {
            const state = doc.groups[groupId];
            return state ? predicate(state, doc) : false;
        }, timeoutMs)
        .then((doc) => doc.groups[groupId]);
}

function latestGroupState(listener: NotificationListenerHandle, groupId: GroupId) {
    return listener.latest()?.groups[groupId];
}

function createListenerMap(db: StubFirestoreDatabase, userIds: string[]) {
    const listeners = new Map<string, NotificationListenerHandle>();
    userIds.forEach((uid) => listeners.set(uid, createNotificationListener(db, uid)));

    return {
        get(uid: string) {
            const listener = listeners.get(uid);
            if (!listener) {
                throw new Error(`Listener not found for user ${uid}`);
            }
            return listener;
        },
        unsubscribeAll() {
            listeners.forEach((listener) => listener.unsubscribe());
            listeners.clear();
        },
    };
}

describe('Notification realtime behaviour (stub firestore)', () => {
    let appDriver: AppDriver;
    let db: StubFirestoreDatabase;

    beforeEach(() => {
        appDriver = new AppDriver();
        db = appDriver.getTestHarness().db as StubFirestoreDatabase;
    });

    afterEach(() => {
        appDriver.dispose();
    });

    it('should emit notification updates for group lifecycle and expenses', async () => {
        const user1 = 'user-1';
        const user2 = 'user-2';

        appDriver.seedUser(user1, { displayName: 'User One' });
        appDriver.seedUser(user2, { displayName: 'User Two' });

        const listener1 = createNotificationListener(db, user1);
        const listener2 = createNotificationListener(db, user2);

        try {
            await flushMicrotasks();

            const group = await appDriver.createGroup(user1, new CreateGroupRequestBuilder().withName('Group Alpha').build());
            await listener1.waitFor((doc) => doc.groups[group.id]?.groupDetailsChangeCount === 1);

            const { linkId } = await appDriver.generateShareableLink(user1, group.id);
            await appDriver.joinGroupByLink(user2, linkId);

            await listener1.waitFor((doc) => doc.groups[group.id]?.groupDetailsChangeCount === 2);
            await listener2.waitFor((doc) => doc.groups[group.id]?.groupDetailsChangeCount === 1);

            const participants = [user1, user2];
            await appDriver.createExpense(
                user1,
                new CreateExpenseRequestBuilder()
                    .withGroupId(group.id)
                    .withAmount(100, 'USD')
                    .withPaidBy(user1)
                    .withParticipants(participants)
                    .withSplitType('equal')
                    .withSplits(calculateEqualSplits(100, 'USD', participants))
                    .build(),
            );

            await listener1.waitFor((doc) => {
                const state = doc.groups[group.id];
                return (
                    state?.transactionChangeCount === 1
                    && state?.balanceChangeCount === 1
                    && state?.groupDetailsChangeCount === 3
                );
            });

            await listener2.waitFor((doc) => {
                const state = doc.groups[group.id];
                return (
                    state?.transactionChangeCount === 1
                    && state?.balanceChangeCount === 1
                    && state?.groupDetailsChangeCount === 2
                );
            });

            const final1 = listener1.latest()!;
            const final2 = listener2.latest()!;

            expect(final1.changeVersion).toBeGreaterThanOrEqual(3);
            expect(final1.groups[group.id]).toMatchObject({
                transactionChangeCount: 1,
                balanceChangeCount: 1,
                groupDetailsChangeCount: 3,
            });

            expect(final2.changeVersion).toBeGreaterThanOrEqual(2);
            expect(final2.groups[group.id]).toMatchObject({
                transactionChangeCount: 1,
                balanceChangeCount: 1,
                groupDetailsChangeCount: 2,
            });
        } finally {
            listener1.unsubscribe();
            listener2.unsubscribe();
        }
    });

    it('should increment notification changeVersion on subsequent updates', async () => {
        const userId = 'user-3';
        appDriver.seedUser(userId, { displayName: 'Solo User' });

        const listener = createNotificationListener(db, userId);

        try {
            await flushMicrotasks();

            const group = await appDriver.createGroup(userId);
            const initial = await listener.waitFor((doc) => doc.groups[group.id]?.groupDetailsChangeCount === 1);

            await appDriver.updateGroup(userId, group.id, { name: 'Renamed Group' });
            const afterRename = await listener.waitFor((doc) => doc.groups[group.id]?.groupDetailsChangeCount === 2);

            await appDriver.updateGroup(userId, group.id, { description: 'Updated description' });
            const afterDescription = await listener.waitFor((doc) => doc.groups[group.id]?.groupDetailsChangeCount === 3);

            expect(initial.changeVersion).toBeGreaterThanOrEqual(1);
            expect(afterRename.changeVersion).toBeGreaterThan(initial.changeVersion);
            expect(afterDescription.changeVersion).toBeGreaterThan(afterRename.changeVersion);
        } finally {
            listener.unsubscribe();
        }
    });

    it('should handle rapid sequential updates without losing notifications', async () => {
        const userId = 'user-4';
        appDriver.seedUser(userId, { displayName: 'Rapid User' });

        const listener = createNotificationListener(db, userId);

        try {
            await flushMicrotasks();

            const group = await appDriver.createGroup(userId);
            await listener.waitFor((doc) => doc.groups[group.id]?.groupDetailsChangeCount === 1);

            await appDriver.updateGroup(userId, group.id, { name: 'Name A' });
            await appDriver.updateGroup(userId, group.id, { name: 'Name B' });
            await appDriver.updateGroup(userId, group.id, { name: 'Name C' });

            const finalSnapshot = await listener.waitFor(
                (doc) => doc.groups[group.id]?.groupDetailsChangeCount === 4,
            );

            expect(finalSnapshot.changeVersion).toBeGreaterThanOrEqual(4);
        } finally {
            listener.unsubscribe();
        }
    });

    describe('multi-member scenarios', () => {
        it('should broadcast notifications across multi-member lifecycle', async () => {
            const [owner, memberTwo, memberThree] = ['multi-user-1', 'multi-user-2', 'multi-user-3'];
            [owner, memberTwo, memberThree].forEach((uid, index) => appDriver.seedUser(uid, { displayName: `Multi ${index + 1}` }));

            const listeners = createListenerMap(db, [owner, memberTwo, memberThree]);

            try {
                await flushMicrotasks();

                const group = await appDriver.createGroup(owner, new CreateGroupRequestBuilder().withName('Multi Group').build());
                await waitForGroupState(listeners.get(owner), group.id, (state) => state.groupDetailsChangeCount === 1);

                expect(latestGroupState(listeners.get(memberTwo), group.id)).toBeUndefined();
                expect(latestGroupState(listeners.get(memberThree), group.id)).toBeUndefined();

                const { linkId } = await appDriver.generateShareableLink(owner, group.id);
                await appDriver.joinGroupByLink(memberTwo, linkId);

                await waitForGroupState(listeners.get(owner), group.id, (state) => state.groupDetailsChangeCount >= 2);
                await waitForGroupState(listeners.get(memberTwo), group.id, (state) => state.groupDetailsChangeCount >= 1);
                expect(latestGroupState(listeners.get(memberThree), group.id)).toBeUndefined();

                await appDriver.joinGroupByLink(memberThree, linkId);
                await waitForGroupState(listeners.get(memberThree), group.id, (state) => state.groupDetailsChangeCount >= 1);

                const participants = [owner, memberTwo, memberThree];
                await appDriver.createExpense(
                    owner,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(owner)
                        .withParticipants(participants)
                        .withAmount(90, 'USD')
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(90, 'USD', participants))
                        .build(),
                );

                await waitForGroupState(listeners.get(owner), group.id, (state) => state.transactionChangeCount === 1 && state.balanceChangeCount === 1);
                await waitForGroupState(listeners.get(memberTwo), group.id, (state) => state.transactionChangeCount === 1 && state.balanceChangeCount === 1);
                await waitForGroupState(listeners.get(memberThree), group.id, (state) => state.transactionChangeCount === 1 && state.balanceChangeCount === 1);

                const finalOwnerState = latestGroupState(listeners.get(owner), group.id)!;
                const finalMemberTwoState = latestGroupState(listeners.get(memberTwo), group.id)!;
                const finalMemberThreeState = latestGroupState(listeners.get(memberThree), group.id)!;

                expect(finalOwnerState.transactionChangeCount).toBe(1);
                expect(finalMemberTwoState.transactionChangeCount).toBe(1);
                expect(finalMemberThreeState.transactionChangeCount).toBe(1);
            } finally {
                listeners.unsubscribeAll();
            }
        });

        it('should notify remaining members when a member leaves', async () => {
            const [owner, memberTwo, memberThree] = ['leave-user-1', 'leave-user-2', 'leave-user-3'];
            [owner, memberTwo, memberThree].forEach((uid, index) => appDriver.seedUser(uid, { displayName: `Leave ${index + 1}` }));

            const listeners = createListenerMap(db, [owner, memberTwo, memberThree]);

            try {
                await flushMicrotasks();

                const group = await appDriver.createGroup(owner, new CreateGroupRequestBuilder().build());
                await waitForGroupState(listeners.get(owner), group.id, (state) => state.groupDetailsChangeCount === 1);

                const { linkId } = await appDriver.generateShareableLink(owner, group.id);
                await appDriver.joinGroupByLink(memberTwo, linkId);
                await waitForGroupState(listeners.get(memberTwo), group.id, (state) => state.groupDetailsChangeCount >= 1);

                await appDriver.joinGroupByLink(memberThree, linkId);
                const stateBeforeLeaveOwner = await waitForGroupState(listeners.get(owner), group.id, (state) => state.groupDetailsChangeCount >= 3);
                const stateBeforeLeaveMemberTwo = await waitForGroupState(listeners.get(memberTwo), group.id, (state) => state.groupDetailsChangeCount >= 2);
                expect(stateBeforeLeaveOwner.groupDetailsChangeCount).toBeGreaterThanOrEqual(3);
                expect(stateBeforeLeaveMemberTwo.groupDetailsChangeCount).toBeGreaterThanOrEqual(2);

                await appDriver.leaveGroup(memberThree, group.id);

                await waitForGroupState(listeners.get(owner), group.id, (state) => state.groupDetailsChangeCount > stateBeforeLeaveOwner.groupDetailsChangeCount);
                await waitForGroupState(listeners.get(memberTwo), group.id, (state) => state.groupDetailsChangeCount > stateBeforeLeaveMemberTwo.groupDetailsChangeCount);
                await listeners.get(memberThree).waitFor((doc) => doc.groups[group.id] === undefined);

                expect(latestGroupState(listeners.get(owner), group.id)).toBeDefined();
                expect(latestGroupState(listeners.get(memberTwo), group.id)).toBeDefined();
                expect(latestGroupState(listeners.get(memberThree), group.id)).toBeUndefined();
            } finally {
                listeners.unsubscribeAll();
            }
        });

        it('should restrict notifications to authorized members', async () => {
            const [owner, invited, outsider] = ['access-user-1', 'access-user-2', 'access-user-3'];
            [owner, invited, outsider].forEach((uid, index) => appDriver.seedUser(uid, { displayName: `Access ${index + 1}` }));

            const listeners = createListenerMap(db, [owner, invited, outsider]);

            try {
                await flushMicrotasks();

                const group = await appDriver.createGroup(owner, new CreateGroupRequestBuilder().build());
                await waitForGroupState(listeners.get(owner), group.id, (state) => state.groupDetailsChangeCount === 1);

                expect(latestGroupState(listeners.get(invited), group.id)).toBeUndefined();
                expect(latestGroupState(listeners.get(outsider), group.id)).toBeUndefined();

                await appDriver.updateGroup(owner, group.id, { description: 'Private notes' });
                await waitForGroupState(listeners.get(owner), group.id, (state) => state.groupDetailsChangeCount >= 2);

                expect(latestGroupState(listeners.get(invited), group.id)).toBeUndefined();
                expect(latestGroupState(listeners.get(outsider), group.id)).toBeUndefined();

                const { linkId } = await appDriver.generateShareableLink(owner, group.id);
                await appDriver.joinGroupByLink(invited, linkId);
                await waitForGroupState(listeners.get(invited), group.id, (state) => state.groupDetailsChangeCount >= 1);

                const participants = [owner, invited];
                await appDriver.createExpense(
                    owner,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(owner)
                        .withParticipants(participants)
                        .withAmount(80, 'USD')
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(80, 'USD', participants))
                        .build(),
                );

                await waitForGroupState(listeners.get(owner), group.id, (state) => state.transactionChangeCount === 1 && state.balanceChangeCount === 1);
                await waitForGroupState(listeners.get(invited), group.id, (state) => state.transactionChangeCount === 1 && state.balanceChangeCount === 1);

                expect(latestGroupState(listeners.get(outsider), group.id)).toBeUndefined();
            } finally {
                listeners.unsubscribeAll();
            }
        });
    });

    describe('event and comment notifications', () => {
        it('should track transaction, balance, and group notification types', async () => {
            const [owner, payer] = ['event-user-1', 'event-user-2'];
            [owner, payer].forEach((uid, index) => appDriver.seedUser(uid, { displayName: `Event ${index + 1}` }));

            const listeners = createListenerMap(db, [owner, payer]);

            try {
                await flushMicrotasks();

                const group = await appDriver.createGroup(owner, new CreateGroupRequestBuilder().build());
                await waitForGroupState(listeners.get(owner), group.id, (state) => state.groupDetailsChangeCount === 1);

                const { linkId } = await appDriver.generateShareableLink(owner, group.id);
                await appDriver.joinGroupByLink(payer, linkId);
                await waitForGroupState(listeners.get(payer), group.id, (state) => state.groupDetailsChangeCount >= 1);

                const participants = [owner, payer];
                await appDriver.createExpense(
                    owner,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(owner)
                        .withParticipants(participants)
                        .withAmount(100, 'USD')
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(100, 'USD', participants))
                        .build(),
                );

                await waitForGroupState(listeners.get(owner), group.id, (state) => state.transactionChangeCount === 1 && state.balanceChangeCount === 1);
                await waitForGroupState(listeners.get(payer), group.id, (state) => state.transactionChangeCount === 1 && state.balanceChangeCount === 1);

                await appDriver.createSettlement(
                    payer,
                    new CreateSettlementRequestBuilder()
                        .withGroupId(group.id)
                        .withPayerId(payer)
                        .withPayeeId(owner)
                        .withAmount(50, 'USD')
                        .build(),
                );

                const ownerStateAfterSettlement = await waitForGroupState(listeners.get(owner), group.id, (state) => state.transactionChangeCount >= 2 && state.balanceChangeCount >= 2);
                const payerStateAfterSettlement = await waitForGroupState(listeners.get(payer), group.id, (state) => state.transactionChangeCount >= 2 && state.balanceChangeCount >= 2);

                await appDriver.updateGroup(owner, group.id, new GroupUpdateBuilder().withName('Updated Event Group').build());
                await waitForGroupState(listeners.get(owner), group.id, (state) => state.groupDetailsChangeCount > ownerStateAfterSettlement.groupDetailsChangeCount);
                await waitForGroupState(listeners.get(payer), group.id, (state) => state.groupDetailsChangeCount > (payerStateAfterSettlement.groupDetailsChangeCount ?? 0));

                const ownerState = latestGroupState(listeners.get(owner), group.id)!;
                const payerState = latestGroupState(listeners.get(payer), group.id)!;

                expect(ownerState.transactionChangeCount).toBeGreaterThanOrEqual(2);
                expect(ownerState.balanceChangeCount).toBeGreaterThanOrEqual(2);
                expect(ownerState.groupDetailsChangeCount).toBeGreaterThanOrEqual(3);

                expect(payerState.transactionChangeCount).toBeGreaterThanOrEqual(2);
                expect(payerState.balanceChangeCount).toBeGreaterThanOrEqual(2);
                expect(payerState.groupDetailsChangeCount).toBeGreaterThanOrEqual(2);
            } finally {
                listeners.unsubscribeAll();
            }
        });

        it('should increment comment counters for group and expense comments', async () => {
            const [owner, member] = ['comment-user-1', 'comment-user-2'];
            [owner, member].forEach((uid, index) => appDriver.seedUser(uid, { displayName: `Comment ${index + 1}` }));

            const listeners = createListenerMap(db, [owner, member]);

            try {
                await flushMicrotasks();

                const group = await appDriver.createGroup(owner, new CreateGroupRequestBuilder().build());
                await waitForGroupState(listeners.get(owner), group.id, (state) => state.groupDetailsChangeCount === 1);

                const { linkId } = await appDriver.generateShareableLink(owner, group.id);
                await appDriver.joinGroupByLink(member, linkId);
                await waitForGroupState(listeners.get(member), group.id, (state) => state.groupDetailsChangeCount >= 1);

                await appDriver.createGroupComment(owner, group.id, 'Welcome!');
                await waitForGroupState(listeners.get(owner), group.id, (state) => state.commentChangeCount === 1);
                await waitForGroupState(listeners.get(member), group.id, (state) => state.commentChangeCount === 1);

                const expense = await appDriver.createExpense(
                    owner,
                    new CreateExpenseRequestBuilder()
                        .withGroupId(group.id)
                        .withPaidBy(owner)
                        .withParticipants([owner, member])
                        .withAmount(60, 'USD')
                        .withSplitType('equal')
                        .withSplits(calculateEqualSplits(60, 'USD', [owner, member]))
                        .build(),
                );

                await appDriver.createExpenseComment(member, expense.id, 'Thanks for covering this!');
                await waitForGroupState(listeners.get(owner), group.id, (state) => state.commentChangeCount === 2);
                await waitForGroupState(listeners.get(member), group.id, (state) => state.commentChangeCount === 2);
            } finally {
                listeners.unsubscribeAll();
            }
        });
    });
});
