/**
 * Integration Test: StubFirestoreDatabase vs Real Firestore
 *
 * Verifies that StubFirestoreDatabase mirrors real Firestore behaviour by
 * executing identical operations against both implementations.
 */

import {
    attachTriggersToStub,
    createFirestoreDatabase,
    type FirestoreTriggerChange,
    type IFirestoreDatabase,
    registerTriggerWithStub,
    StubFirestoreDatabase,
    Timestamp,
    type TriggerDefinition,
} from '@splitifyd/firebase-simulator';
import { getFirebaseEmulatorConfig } from '@splitifyd/test-support';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let cachedConfig: ReturnType<typeof getFirebaseEmulatorConfig> | null = null;

function configureTestEnvironment() {
    if (!cachedConfig) {
        cachedConfig = getFirebaseEmulatorConfig();
    }

    const { projectId, firestorePort, authPort } = cachedConfig;
    process.env.GCLOUD_PROJECT = projectId;
    process.env.GOOGLE_CLOUD_PROJECT = projectId;
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId });
    process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firestorePort}`;
    process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${authPort}`;
}

function ensureFirestore() {
    configureTestEnvironment();
    if (getApps().length === 0) {
        const projectId = process.env.GCLOUD_PROJECT ?? 'demo-simulator';
        initializeApp({ projectId });
        const firestore = getAdminFirestore();
        if (process.env.FIRESTORE_EMULATOR_HOST) {
            firestore.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
        }
        return firestore;
    }
    return getAdminFirestore();
}

describe('Firestore Stub Compatibility - Integration Test', () => {
    let realDb: IFirestoreDatabase | undefined;
    let stubDb: StubFirestoreDatabase;
    const testCollectionPrefix = `compatibility-test-${Date.now()}`;

    beforeAll(() => {
        ensureFirestore(); // Warm up connection so individual tests stay fast.
    });

    beforeEach(() => {
        realDb = createFirestoreDatabase(ensureFirestore());
        stubDb = new StubFirestoreDatabase();
    });

    afterEach(async () => {
        const collectionsToClean = [testCollectionPrefix, `${testCollectionPrefix}-pagination`];

        for (const collectionName of collectionsToClean) {
            const snapshot = await realDb!.collection(collectionName).get();

            if (collectionName === testCollectionPrefix) {
                for (const doc of snapshot.docs) {
                    const shareLinksSnapshot = await doc.ref.collection('shareLinks').get();
                    const shareLinksBatch = realDb!.batch();
                    shareLinksSnapshot.docs.forEach((linkDoc) => shareLinksBatch.delete(linkDoc.ref));
                    if (shareLinksSnapshot.docs.length > 0) {
                        await shareLinksBatch.commit();
                    }

                    const membersSnapshot = await doc.ref.collection('members').get();
                    const membersBatch = realDb!.batch();
                    membersSnapshot.docs.forEach((memberDoc) => membersBatch.delete(memberDoc.ref));
                    if (membersSnapshot.docs.length > 0) {
                        await membersBatch.commit();
                    }
                }
            }

            const batch = realDb!.batch();
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            if (snapshot.docs.length > 0) {
                await batch.commit();
            }
        }

        stubDb.clear();
    });

    async function testBothImplementations(
        testName: string,
        testFn: (db: IFirestoreDatabase, isStub: boolean) => Promise<void>,
    ) {
        await testFn(realDb!, false);
        await testFn(stubDb, true);
    }

    function waitForListenerFlush(isStub: boolean, delayMs: number = 60): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, isStub ? 0 : delayMs));
    }

    describe('Basic Document Operations', () => {
        it('should create and read documents identically', async () => {
            await testBothImplementations('create and read', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('test-doc-1');

                const testData = {
                    name: 'Test User',
                    age: 30,
                    city: 'NYC',
                    createdAt: Timestamp.now(),
                };

                await docRef.set(testData);

                const snapshot = await docRef.get();

                expect(snapshot.exists, `Document should exist (${isStub ? 'stub' : 'real'})`).toBe(true);
                expect(snapshot.id).toBe('test-doc-1');

                const data = snapshot.data();
                expect(data?.name).toBe('Test User');
                expect(data?.age).toBe(30);
                expect(data?.city).toBe('NYC');
                expect(data?.createdAt).toBeInstanceOf(Timestamp);
            });
        });

        it('should update documents identically', async () => {
            await testBothImplementations('update', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('test-doc-2');

                await docRef.set({ name: 'Original', age: 25 });
                await docRef.update({ age: 26 });

                const snapshot = await docRef.get();
                const data = snapshot.data();

                expect(data?.name, `Name unchanged (${isStub ? 'stub' : 'real'})`).toBe('Original');
                expect(data?.age, `Age updated (${isStub ? 'stub' : 'real'})`).toBe(26);
            });
        });

        it('should delete documents identically', async () => {
            await testBothImplementations('delete', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('test-doc-3');

                await docRef.set({ name: 'To Delete' });
                await docRef.delete();

                const snapshot = await docRef.get();
                expect(snapshot.exists, `Document deleted (${isStub ? 'stub' : 'real'})`).toBe(false);
            });
        });

        it('should handle merge operations identically', async () => {
            await testBothImplementations('merge', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('test-doc-4');

                await docRef.set({ name: 'Original', age: 30 });
                await docRef.set({ age: 31, city: 'LA' }, { merge: true });

                const snapshot = await docRef.get();
                const data = snapshot.data();

                expect(data?.name, `Original fields preserved (${isStub ? 'stub' : 'real'})`).toBe('Original');
                expect(data?.age, `Merged field updated (${isStub ? 'stub' : 'real'})`).toBe(31);
                expect(data?.city, `New merged field added (${isStub ? 'stub' : 'real'})`).toBe('LA');
            });
        });
    });

    describe('Query Operations', () => {
        const paginationCollection = `${testCollectionPrefix}-pagination`;

        beforeEach(async () => {
            const baseCollectionData = [
                { id: 'user-1', name: 'Alice', age: 25, city: 'NYC' },
                { id: 'user-2', name: 'Bob', age: 30, city: 'LA' },
                { id: 'user-3', name: 'Charlie', age: 35, city: 'NYC' },
                { id: 'user-4', name: 'David', age: 28, city: 'SF' },
            ];

            for (const data of baseCollectionData) {
                if (realDb) {
                    await realDb.collection(testCollectionPrefix).doc(data.id).set(data);
                }
                await stubDb.collection(testCollectionPrefix).doc(data.id).set(data);
            }

            const paginationData = Array.from({ length: 6 }, (_, index) => ({
                id: `page-item-${index + 1}`,
                index,
                label: `Item ${index + 1}`,
            }));

            for (const data of paginationData) {
                if (realDb) {
                    await realDb.collection(paginationCollection).doc(data.id).set(data);
                }
                await stubDb.collection(paginationCollection).doc(data.id).set(data);
            }
        });

        it('should handle where queries identically', async () => {
            await testBothImplementations('where query', async (db, isStub) => {
                const snapshot = await db.collection(testCollectionPrefix).where('city', '==', 'NYC').get();

                expect(snapshot.size, `Query result count (${isStub ? 'stub' : 'real'})`).toBe(2);

                const names = snapshot.docs.map((doc) => doc.data().name).sort();
                expect(names, `Query results match (${isStub ? 'stub' : 'real'})`).toEqual(['Alice', 'Charlie']);
            });
        });

        it('should handle range queries identically', async () => {
            await testBothImplementations('range query', async (db, isStub) => {
                const snapshot = await db.collection(testCollectionPrefix).where('age', '>', 28).get();

                expect(snapshot.size, `Range query count (${isStub ? 'stub' : 'real'})`).toBe(2);

                const ages = snapshot.docs.map((doc) => doc.data().age).sort();
                expect(ages, `Range query results (${isStub ? 'stub' : 'real'})`).toEqual([30, 35]);
            });
        });

        it('should handle orderBy queries identically', async () => {
            await testBothImplementations('orderBy query', async (db, isStub) => {
                const snapshot = await db.collection(testCollectionPrefix).orderBy('age', 'desc').get();

                expect(snapshot.size, `OrderBy result count (${isStub ? 'stub' : 'real'})`).toBe(4);

                const names = snapshot.docs.map((doc) => doc.data().name);
                expect(names, `OrderBy results (${isStub ? 'stub' : 'real'})`).toEqual(['Charlie', 'Bob', 'David', 'Alice']);
            });
        });

        it('should handle limit queries identically', async () => {
            await testBothImplementations('limit query', async (db, isStub) => {
                const snapshot = await db.collection(testCollectionPrefix).orderBy('age').limit(2).get();

                expect(snapshot.size, `Limit result count (${isStub ? 'stub' : 'real'})`).toBe(2);

                const names = snapshot.docs.map((doc) => doc.data().name);
                expect(names, `Limit results (${isStub ? 'stub' : 'real'})`).toEqual(['Alice', 'David']);
            });
        });

        it('should handle offset queries identically', async () => {
            await testBothImplementations('offset query', async (db, isStub) => {
                const snapshot = await db.collection(testCollectionPrefix).orderBy('age').offset(2).limit(2).get();

                expect(snapshot.size, `Offset result count (${isStub ? 'stub' : 'real'})`).toBe(2);

                const names = snapshot.docs.map((doc) => doc.data().name);
                expect(names, `Offset results (${isStub ? 'stub' : 'real'})`).toEqual(['Bob', 'Charlie']);
            });
        });

        it('should handle combined queries identically', async () => {
            await testBothImplementations('combined query', async (db, isStub) => {
                const snapshot = await db.collection(testCollectionPrefix).where('city', '==', 'NYC').where('age', '>', 25).orderBy('age').get();

                expect(snapshot.size, `Combined query count (${isStub ? 'stub' : 'real'})`).toBe(1);

                const data = snapshot.docs[0].data();
                expect(data?.name, `Combined query result (${isStub ? 'stub' : 'real'})`).toBe('Charlie');
            });
        });

        it('should return identical results for paginated queries', async () => {
            await testBothImplementations('paginated query', async (db, isStub) => {
                const baseQuery = db.collection(paginationCollection).orderBy('index');

                const limit = 3;
                const firstPage = await baseQuery.limit(limit).get();

                expect(firstPage.size, `First page size (${isStub ? 'stub' : 'real'})`).toBe(limit);

                const lastDoc = firstPage.docs[firstPage.docs.length - 1];
                const secondPage = await baseQuery.startAfter(lastDoc).limit(limit).get();

                expect(secondPage.size, `Second page size (${isStub ? 'stub' : 'real'})`).toBe(limit);

                const combined = [...firstPage.docs, ...secondPage.docs];
                const indexes = combined.map((doc) => doc.data().index);

                expect(new Set(indexes).size).toBe(limit * 2);
                expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
            });
        });
    });

    describe('Transaction Operations', () => {
        it('should handle transactional reads and writes identically', async () => {
            await testBothImplementations('transaction', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('counter');
                await docRef.set({ count: 0 });

                await db.runTransaction(async (transaction) => {
                    const snapshot = await transaction.get(docRef);
                    const currentCount = snapshot.data()?.count || 0;
                    transaction.update(docRef, { count: currentCount + 1 });
                });

                const snapshot = await docRef.get();
                expect(snapshot.data()?.count, `Transaction result (${isStub ? 'stub' : 'real'})`).toBe(1);
            });
        });

        it('should rollback transactions on error identically', async () => {
            await testBothImplementations('transaction rollback', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('rollback-test');
                await docRef.set({ value: 100 });

                try {
                    await db.runTransaction(async (transaction) => {
                        transaction.update(docRef, { value: 200 });
                        throw new Error('Forced rollback');
                    });
                } catch {
                    // expected
                }

                const snapshot = await docRef.get();
                expect(snapshot.data()?.value, `Rollback preserves original (${isStub ? 'stub' : 'real'})`).toBe(100);
            });
        });
    });

    describe('Batch Operations', () => {
        it('should handle batch writes identically', async () => {
            await testBothImplementations('batch writes', async (db, isStub) => {
                const batch = db.batch();

                const doc1 = db.collection(testCollectionPrefix).doc('batch-1');
                const doc2 = db.collection(testCollectionPrefix).doc('batch-2');

                batch.set(doc1, { name: 'Batch User 1' });
                batch.set(doc2, { name: 'Batch User 2' });

                await batch.commit();

                const snapshot1 = await doc1.get();
                const snapshot2 = await doc2.get();

                expect(snapshot1.exists, `Batch doc 1 exists (${isStub ? 'stub' : 'real'})`).toBe(true);
                expect(snapshot2.exists, `Batch doc 2 exists (${isStub ? 'stub' : 'real'})`).toBe(true);
            });
        });
    });

    describe('Subcollections', () => {
        it('should handle subcollections identically', async () => {
            await testBothImplementations('subcollections', async (db, isStub) => {
                const groupRef = db.collection(testCollectionPrefix).doc('group-1');
                await groupRef.set({ name: 'Test Group' });

                const membersRef = groupRef.collection('members');
                await membersRef.doc('member-1').set({ name: 'Alice', role: 'admin' });
                await membersRef.doc('member-2').set({ name: 'Bob', role: 'member' });

                const snapshot = await membersRef.get();
                expect(snapshot.size, `Subcollection size (${isStub ? 'stub' : 'real'})`).toBe(2);

                const names = snapshot.docs.map((doc) => doc.data().name).sort();
                expect(names, `Subcollection data (${isStub ? 'stub' : 'real'})`).toEqual(['Alice', 'Bob']);
            });
        });

        it('should navigate parent/child relationships identically', async () => {
            await testBothImplementations('parent navigation', async (db, isStub) => {
                const groupRef = db.collection(testCollectionPrefix).doc('group-2');
                await groupRef.set({ name: 'Parent Group' });

                const memberRef = groupRef.collection('members').doc('member-1');
                await memberRef.set({ name: 'Child Member' });

                const parentRef = memberRef.parent?.parent;
                expect(parentRef, `Parent reference exists (${isStub ? 'stub' : 'real'})`).toBeDefined();

                if (parentRef) {
                    const parentSnapshot = await parentRef.get();
                    expect(parentSnapshot.data()?.name, `Parent data accessible (${isStub ? 'stub' : 'real'})`).toBe('Parent Group');
                }
            });
        });
    });

    describe('Collection Group Queries', () => {
        beforeEach(async () => {
            const groups = [
                {
                    groupId: 'group-1',
                    links: [
                        { id: 'link-1', token: 'token-1', createdBy: 'user-1', testRunId: testCollectionPrefix },
                        { id: 'link-2', token: 'token-2', createdBy: 'user-1', testRunId: testCollectionPrefix },
                    ],
                },
                {
                    groupId: 'group-2',
                    links: [
                        {
                            id: 'link-3',
                            token: 'token-3',
                            createdBy: 'user-2',
                            testRunId: testCollectionPrefix,
                        },
                        { id: 'link-4', token: 'token-4', createdBy: 'user-3', testRunId: testCollectionPrefix },
                    ],
                },
            ];

            for (const group of groups) {
                const realGroupRef = realDb ? realDb.collection(testCollectionPrefix).doc(group.groupId) : undefined;
                if (realGroupRef) {
                    await realGroupRef.set({ name: `Group ${group.groupId}` });
                }

                const stubGroupRef = stubDb.collection(testCollectionPrefix).doc(group.groupId);
                await stubGroupRef.set({ name: `Group ${group.groupId}` });

                for (const link of group.links) {
                    if (realGroupRef) {
                        await realGroupRef.collection('shareLinks').doc(link.id).set(link);
                    }
                    await stubGroupRef.collection('shareLinks').doc(link.id).set(link);
                }
            }
        });

        it('should query collection groups identically', async () => {
            await testBothImplementations('collection group', async (db, isStub) => {
                const snapshot = await db.collectionGroup('shareLinks').where('testRunId', '==', testCollectionPrefix).get();

                expect(snapshot.size, `Collection group size (${isStub ? 'stub' : 'real'})`).toBe(4);
            });
        });

        it('should filter collection group queries identically', async () => {
            await testBothImplementations('collection group filter', async (db, isStub) => {
                const snapshot = await db.collectionGroup('shareLinks').where('testRunId', '==', testCollectionPrefix).where('createdBy', '==', 'user-1').get();

                expect(snapshot.size, `Filtered share links (${isStub ? 'stub' : 'real'})`).toBe(2);
            });
        });

        it('should limit collection group queries identically', async () => {
            await testBothImplementations('collection group limit', async (db, isStub) => {
                const snapshot = await db
                    .collectionGroup('shareLinks')
                    .where('testRunId', '==', testCollectionPrefix)
                    .where('createdBy', '==', 'user-1')
                    .limit(1)
                    .get();

                expect(snapshot.size, `Limited filtered links (${isStub ? 'stub' : 'real'})`).toBe(1);
                expect(snapshot.docs[0].id, `Limited link ID (${isStub ? 'stub' : 'real'})`).toBe('link-1');
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle non-existent documents identically', async () => {
            await testBothImplementations('non-existent doc', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('does-not-exist');
                const snapshot = await docRef.get();

                expect(snapshot.exists, `Non-existent doc (${isStub ? 'stub' : 'real'})`).toBe(false);
                expect(snapshot.data(), `Non-existent doc data (${isStub ? 'stub' : 'real'})`).toBeUndefined();
            });
        });

        it('should handle update on non-existent document identically', async () => {
            await testBothImplementations('update non-existent', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('does-not-exist-update');

                try {
                    await docRef.update({ field: 'value' });
                    expect.fail(`Should have thrown error (${isStub ? 'stub' : 'real'})`);
                } catch (error: any) {
                    const message = String(error?.message ?? error ?? '');
                    const errorCode = error?.code;
                    const matches = message.includes('No document to update')
                        || message.includes('does not exist')
                        || message.includes('NOT_FOUND')
                        || errorCode === 5
                        || errorCode === 'not-found';
                    expect(matches, `Error message matches (${isStub ? 'stub' : 'real'})`).toBe(true);
                }
            });
        });
    });

    describe('Trigger registration via simulator', () => {
        it('should capture trigger operations on stub and no-op on real', async () => {
            const triggerHandler = vi.fn();

            const unregister = stubDb.registerTrigger(`${testCollectionPrefix}/{docId}`, {
                onCreate: triggerHandler,
                onUpdate: triggerHandler,
                onDelete: triggerHandler,
            });

            const docRef = stubDb.collection(testCollectionPrefix).doc('trigger-doc');
            await docRef.set({ value: 1 });
            await docRef.update({ value: 2 });
            await docRef.delete();

            const capturedEvents = triggerHandler.mock.calls.map(([change]) => (change as FirestoreTriggerChange).type);
            expect(capturedEvents).toEqual(['create', 'update', 'delete']);

            unregister();
        });

        it('should adapt events with params and snapshots consistently', async () => {
            const events: Array<{
                changeType: string;
                params: Record<string, string>;
                before?: { data: () => any; exists: boolean; };
                after?: { data: () => any; exists: boolean; };
            }> = [];

            const definition: TriggerDefinition<'testTrigger'> = {
                name: 'testTrigger',
                document: `${testCollectionPrefix}/{docId}`,
                operations: ['create', 'update', 'delete'],
                createProdTrigger: vi.fn(),
            };

            const unregister = registerTriggerWithStub(stubDb, definition, async (event) => {
                events.push({
                    changeType: event.changeType,
                    params: event.params,
                    before: event.data.before,
                    after: event.data.after,
                });
            });

            const docRef = stubDb.collection(testCollectionPrefix).doc('abc');
            await docRef.set({ foo: 1 });
            await docRef.update({ foo: 2 });
            await docRef.delete();

            unregister();

            expect(events.map((event) => event.changeType)).toEqual(['create', 'update', 'delete']);

            const [createEvent, updateEvent, deleteEvent] = events;

            expect(createEvent.params).toEqual({ docId: 'abc' });
            expect(createEvent.before?.exists).toBe(false);
            expect(createEvent.before?.data()).toBeUndefined();
            expect(createEvent.after?.exists).toBe(true);
            expect(createEvent.after?.data()).toEqual({ foo: 1 });

            expect(updateEvent.before?.exists).toBe(true);
            expect(updateEvent.before?.data()).toEqual({ foo: 1 });
            expect(updateEvent.after?.data()).toEqual({ foo: 2 });

            expect(deleteEvent.before?.exists).toBe(true);
            expect(deleteEvent.before?.data()).toEqual({ foo: 2 });
            expect(deleteEvent.after?.exists).toBe(false);
            expect(deleteEvent.after?.data()).toBeUndefined();
        });

        it('should respect operation filters when registering triggers', async () => {
            const handler = vi.fn();

            const unregister = registerTriggerWithStub(
                stubDb,
                {
                    name: 'updateOnly',
                    document: `${testCollectionPrefix}/{docId}`,
                    operations: ['update'],
                    createProdTrigger: vi.fn(),
                },
                async (event) => handler(event.changeType),
            );

            const docRef = stubDb.collection(testCollectionPrefix).doc('filter-test');

            await docRef.set({ value: 1 });
            await docRef.update({ value: 2 });
            await docRef.delete();

            unregister();

            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler).toHaveBeenCalledWith('update');
        });

        it('should attach multiple definitions and unregister cleanly', async () => {
            const events: Array<{ name: string; type: string; params: Record<string, string>; }> = [];

            const definitions: TriggerDefinition<string>[] = [
                {
                    name: 'parentCreate',
                    document: `${testCollectionPrefix}/{docId}`,
                    operations: ['create'],
                    createProdTrigger: vi.fn(),
                    mapParams: ({ docId }) => ({ docId }),
                },
                {
                    name: 'childLifecycle',
                    document: `${testCollectionPrefix}/{docId}/children/{childId}`,
                    operations: ['create', 'delete'],
                    createProdTrigger: vi.fn(),
                    mapParams: ({ docId, childId }) => ({ parent: docId, child: childId }),
                },
            ];

            const detach = attachTriggersToStub(
                stubDb,
                definitions,
                (definition) => async (event) => {
                    events.push({
                        name: definition.name,
                        type: event.changeType,
                        params: event.params,
                    });
                },
            );

            const parentRef = stubDb.collection(testCollectionPrefix).doc('parent-1');
            await parentRef.set({ foo: 'bar' });

            const childRef = parentRef.collection('children').doc('child-1');
            await childRef.set({ value: 1 });
            await childRef.delete();

            expect(events).toEqual([
                { name: 'parentCreate', type: 'create', params: { docId: 'parent-1' } },
                { name: 'childLifecycle', type: 'create', params: { parent: 'parent-1', child: 'child-1' } },
                { name: 'childLifecycle', type: 'delete', params: { parent: 'parent-1', child: 'child-1' } },
            ]);

            events.length = 0;
            detach();

            await parentRef.set({ foo: 'baz' });
            await childRef.set({ value: 2 });

            expect(events).toHaveLength(0);
        });

        describe('Realtime listeners', () => {
            it('should stream document snapshots identically', async () => {
                await testBothImplementations('document listener', async (db, isStub) => {
                    const docRef = db.collection(`${testCollectionPrefix}-listeners`).doc('doc-stream');
                    const snapshots: Array<{ exists: boolean; data: any | undefined; }> = [];
                    const errors: Error[] = [];

                    const unsubscribe = docRef.onSnapshot(
                        (snapshot) => snapshots.push({ exists: snapshot.exists, data: snapshot.data() }),
                        (error) => errors.push(error),
                    );

                    await waitForListenerFlush(isStub);

                    await docRef.set({ stage: 'created', value: 1 });
                    await waitForListenerFlush(isStub);

                    await docRef.update({ stage: 'updated', value: 2 });
                    await waitForListenerFlush(isStub);

                    await docRef.delete();
                    await waitForListenerFlush(isStub);

                    unsubscribe();

                    expect(errors, `Listener errors (${isStub ? 'stub' : 'real'})`).toHaveLength(0);
                    expect(snapshots.length, `Snapshot count (${isStub ? 'stub' : 'real'})`).toBe(4);
                    expect(snapshots[0].exists).toBe(false);
                    expect(snapshots[1].data).toEqual({ stage: 'created', value: 1 });
                    expect(snapshots[2].data).toEqual({ stage: 'updated', value: 2 });
                    expect(snapshots[3].exists).toBe(false);
                });
            });

            it('should stream filtered query snapshots identically', async () => {
                await testBothImplementations('query listener', async (db, isStub) => {
                    const collection = db.collection(`${testCollectionPrefix}-listener-queries`);

                    await collection.doc('user-1').set({ name: 'Alice', city: 'NYC' });
                    await collection.doc('user-2').set({ name: 'Bob', city: 'LA' });

                    const results: string[][] = [];
                    const errors: Error[] = [];

                    const unsubscribe = collection
                        .where('city', '==', 'NYC')
                        .orderBy('name')
                        .onSnapshot(
                            (snapshot) => results.push(snapshot.docs.map((doc) => doc.data().name)),
                            (error) => errors.push(error),
                        );

                    await waitForListenerFlush(isStub);

                    await collection.doc('user-3').set({ name: 'Charlie', city: 'NYC' });
                    await waitForListenerFlush(isStub);

                    await collection.doc('user-1').update({ city: 'SF' });
                    await waitForListenerFlush(isStub);

                    await collection.doc('user-2').set({ name: 'Bob', city: 'NYC' });
                    await waitForListenerFlush(isStub);

                    unsubscribe();

                    expect(errors, `Query listener errors (${isStub ? 'stub' : 'real'})`).toHaveLength(0);
                    expect(results, `Query snapshot evolution (${isStub ? 'stub' : 'real'})`).toEqual([
                        ['Alice'],
                        ['Alice', 'Charlie'],
                        ['Charlie'],
                        ['Bob', 'Charlie'],
                    ]);
                });
            });
        });
    });
});
