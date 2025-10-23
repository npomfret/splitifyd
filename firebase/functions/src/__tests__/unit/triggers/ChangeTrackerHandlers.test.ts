import { StubFirestoreDatabase } from '@splitifyd/firebase-simulator';
import { beforeEach, describe, expect, it } from 'vitest';
import type { UserNotificationDocument } from '../../../schemas/user-notifications';
import { FirestoreReader, FirestoreWriter } from '../../../services/firestore';
import { NotificationService } from '../../../services/notification-service';
import { ChangeTrackerHandlers } from '../../../triggers/ChangeTrackerHandlers';

describe('ChangeTrackerHandlers - Unit Tests with Trigger Simulation', () => {
    let db: StubFirestoreDatabase;
    let notificationService: NotificationService;
    let handlers: ChangeTrackerHandlers;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
        const reader = new FirestoreReader(db);
        const writer = new FirestoreWriter(db);
        notificationService = new NotificationService(reader, writer);
        handlers = new ChangeTrackerHandlers(reader, notificationService);
    });

    async function getUserNotification(userId: string): Promise<UserNotificationDocument | null> {
        const doc = await db.doc(`user-notifications/${userId}`).get();
        if (!doc.exists) {
            return null;
        }
        return doc.data() as UserNotificationDocument;
    }

    describe('Group change tracking with triggers', () => {
        it('should automatically notify group members when group is updated via trigger', async () => {
            db.seed('groups/group-1', {
                id: 'group-1',
                name: 'Test Group',
                currency: 'USD',
                createdAt: new Date(),
            });

            db.seed('group-memberships/group-1_user-1', {
                id: 'group-1_user-1',
                groupId: 'group-1',
                uid: 'user-1',
                role: 'admin',
                joinedAt: new Date().toISOString(),
            });

            db.seed('group-memberships/group-1_user-2', {
                id: 'group-1_user-2',
                groupId: 'group-1',
                uid: 'user-2',
                role: 'member',
                joinedAt: new Date().toISOString(),
            });

            db.registerTrigger('groups/{groupId}', {
                onUpdate: async (change) => {
                    await handlers.handleGroupChange({
                        params: change.params,
                        data: {
                            before: change.before,
                            after: change.after,
                        },
                    } as any);
                },
            });

            await db.doc('groups/group-1').update({ name: 'Updated Group Name' });

            const user1Notif = await getUserNotification('user-1');
            const user2Notif = await getUserNotification('user-2');

            expect(user1Notif?.groups?.['group-1']?.groupDetailsChangeCount).toBe(1);
            expect(user2Notif?.groups?.['group-1']?.groupDetailsChangeCount).toBe(1);
        });

        it('should handle group deletion gracefully', async () => {
            db.seed('groups/group-1', {
                id: 'group-1',
                name: 'Test Group',
                currency: 'USD',
                createdAt: new Date(),
            });

            const deletions: string[] = [];

            db.registerTrigger('groups/{groupId}', {
                onDelete: async (change) => {
                    deletions.push(change.params.groupId);
                    await handlers.handleGroupChange({
                        params: change.params,
                        data: {
                            before: change.before,
                            after: change.after,
                        },
                    } as any);
                },
            });

            await db.doc('groups/group-1').delete();

            expect(deletions).toEqual(['group-1']);
        });
    });

    describe('Expense change tracking with triggers', () => {
        it('should notify group members when expense is created', async () => {
            db.seed('groups/group-1', {
                id: 'group-1',
                name: 'Test Group',
                currency: 'USD',
                createdAt: new Date(),
            });

            db.seed('group-memberships/group-1_user-1', {
                id: 'group-1_user-1',
                groupId: 'group-1',
                uid: 'user-1',
                role: 'admin',
                joinedAt: new Date().toISOString(),
            });

            db.seed('group-memberships/group-1_user-2', {
                id: 'group-1_user-2',
                groupId: 'group-1',
                uid: 'user-2',
                role: 'member',
                joinedAt: new Date().toISOString(),
            });

            db.registerTrigger('expenses/{expenseId}', {
                onCreate: async (change) => {
                    await handlers.handleExpenseChange({
                        params: change.params,
                        data: {
                            before: change.before,
                            after: change.after,
                        },
                    } as any);
                },
            });

            await db.doc('expenses/exp-1').set({
                id: 'exp-1',
                groupId: 'group-1',
                description: 'Test Expense',
                amount: 100,
                currency: 'USD',
                date: new Date().toISOString(),
                paidBy: 'user-1',
                participants: ['user-1', 'user-2'],
                createdAt: new Date(),
            });

            const user1Notif = await getUserNotification('user-1');
            const user2Notif = await getUserNotification('user-2');

            expect(user1Notif?.groups?.['group-1']?.transactionChangeCount).toBe(1);
            expect(user1Notif?.groups?.['group-1']?.balanceChangeCount).toBe(1);
            expect(user2Notif?.groups?.['group-1']?.transactionChangeCount).toBe(1);
            expect(user2Notif?.groups?.['group-1']?.balanceChangeCount).toBe(1);
        });
    });

    describe('Transaction behavior with trigger buffering', () => {
        it('should defer trigger notifications until transaction commits', async () => {
            db.seed('groups/group-1', {
                id: 'group-1',
                name: 'Test Group',
                currency: 'USD',
                createdAt: new Date(),
            });

            db.seed('group-memberships/group-1_user-1', {
                id: 'group-1_user-1',
                groupId: 'group-1',
                uid: 'user-1',
                role: 'admin',
                joinedAt: new Date().toISOString(),
            });

            const triggerCalls: string[] = [];

            db.registerTrigger('groups/{groupId}', {
                onUpdate: async (change) => {
                    triggerCalls.push(`trigger-fired-${change.params.groupId}`);
                    await handlers.handleGroupChange({
                        params: change.params,
                        data: {
                            before: change.before,
                            after: change.after,
                        },
                    } as any);
                },
            });

            await db.runTransaction(async (txn) => {
                const groupRef = db.doc('groups/group-1');
                txn.update(groupRef, { name: 'Updated in Transaction' });

                expect(triggerCalls).toHaveLength(0);
            });

            expect(triggerCalls).toEqual(['trigger-fired-group-1']);

            const user1Notif = await getUserNotification('user-1');
            expect(user1Notif?.groups?.['group-1']?.groupDetailsChangeCount).toBe(1);
        });

        it('should not fire triggers if transaction rolls back', async () => {
            db.seed('groups/group-1', {
                id: 'group-1',
                name: 'Test Group',
                currency: 'USD',
                createdAt: new Date(),
            });

            const triggerCalls: string[] = [];

            db.registerTrigger('groups/{groupId}', {
                onUpdate: async (change) => {
                    triggerCalls.push(`trigger-fired-${change.params.groupId}`);
                },
            });

            await expect(
                db.runTransaction(async (txn) => {
                    const groupRef = db.doc('groups/group-1');
                    txn.update(groupRef, { name: 'Will be rolled back' });
                    throw new Error('Transaction rolled back');
                }),
            )
                .rejects
                .toThrow('Transaction rolled back');

            expect(triggerCalls).toHaveLength(0);

            const groupDoc = await db.doc('groups/group-1').get();
            expect(groupDoc.data()?.name).toBe('Test Group');
        });
    });
});
