/**
 * Integration Test: StubFirestoreDatabase vs Real Firestore Compatibility
 *
 * This test verifies that StubFirestoreDatabase behaves identically to real Firestore.
 * It runs the same operations against both implementations and compares results.
 */

import { type IFirestoreDatabase, StubFirestoreDatabase } from '@splitifyd/test-support';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getFirestore } from '../../firebase';
import { createFirestoreDatabase, Timestamp } from '../../firestore-wrapper';

describe('Firestore Stub Compatibility - Integration Test', () => {
    let realDb: IFirestoreDatabase;
    let stubDb: StubFirestoreDatabase;
    const testCollectionPrefix = `compatibility-test-${Date.now()}`;

    beforeEach(() => {
        // Initialize both implementations
        realDb = createFirestoreDatabase(getFirestore());
        stubDb = new StubFirestoreDatabase();
    });

    afterEach(async () => {
        // Clean up real Firestore test data (including subcollections)
        const snapshot = await realDb.collection(testCollectionPrefix).get();

        // Delete all subcollections first (e.g., shareLinks, members)
        for (const doc of snapshot.docs) {
            // Delete shareLinks subcollection
            const shareLinksSnapshot = await doc.ref.collection('shareLinks').get();
            const shareLinksBatch = realDb.batch();
            shareLinksSnapshot.docs.forEach((linkDoc) => shareLinksBatch.delete(linkDoc.ref));
            if (shareLinksSnapshot.docs.length > 0) {
                await shareLinksBatch.commit();
            }

            // Delete members subcollection
            const membersSnapshot = await doc.ref.collection('members').get();
            const membersBatch = realDb.batch();
            membersSnapshot.docs.forEach((memberDoc) => membersBatch.delete(memberDoc.ref));
            if (membersSnapshot.docs.length > 0) {
                await membersBatch.commit();
            }
        }

        // Now delete the parent documents
        const batch = realDb.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        if (snapshot.docs.length > 0) {
            await batch.commit();
        }

        // Clean up stub
        stubDb.clear();
    });

    /**
     * Helper to run the same test against both implementations
     */
    async function testBothImplementations(
        testName: string,
        testFn: (db: IFirestoreDatabase, isStub: boolean) => Promise<void>,
    ) {
        // Test against real Firestore
        await testFn(realDb, false);

        // Test against stub
        await testFn(stubDb, true);
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

                // Create document
                await docRef.set(testData);

                // Read document
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
        beforeEach(async () => {
            // Seed test data for both implementations
            const testData = [
                { id: 'user-1', name: 'Alice', age: 25, city: 'NYC' },
                { id: 'user-2', name: 'Bob', age: 30, city: 'LA' },
                { id: 'user-3', name: 'Charlie', age: 35, city: 'NYC' },
                { id: 'user-4', name: 'David', age: 28, city: 'SF' },
            ];

            for (const data of testData) {
                await realDb.collection(testCollectionPrefix).doc(data.id).set(data);
                await stubDb.collection(testCollectionPrefix).doc(data.id).set(data);
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
    });

    describe('Transaction Operations', () => {
        it('should handle transactional reads and writes identically', async () => {
            await testBothImplementations('transaction', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('counter');
                await docRef.set({ count: 0 });

                // Increment counter in transaction
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
                } catch (error) {
                    // Expected
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
                expect(snapshot1.data()?.name, `Batch doc 1 data (${isStub ? 'stub' : 'real'})`).toBe('Batch User 1');
                expect(snapshot2.data()?.name, `Batch doc 2 data (${isStub ? 'stub' : 'real'})`).toBe('Batch User 2');
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

                // Navigate up to parent
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
            // Set up share links in multiple groups (mirrors real production use case)
            // Add testRunId to filter collection group queries to only this test run
            const groups = [
                { groupId: 'group-1', links: [
                    { id: 'link-1', token: 'token-1', isActive: true, createdBy: 'user-1', testRunId: testCollectionPrefix },
                    { id: 'link-2', token: 'token-2', isActive: false, createdBy: 'user-1', testRunId: testCollectionPrefix },
                ]},
                { groupId: 'group-2', links: [
                    { id: 'link-3', token: 'token-3', isActive: true, createdBy: 'user-2', testRunId: testCollectionPrefix },
                ]},
                { groupId: 'group-3', links: [
                    { id: 'link-4', token: 'token-4', isActive: true, createdBy: 'user-3', testRunId: testCollectionPrefix },
                ]},
            ];

            for (const group of groups) {
                for (const link of group.links) {
                    await realDb.collection(testCollectionPrefix).doc(group.groupId).collection('shareLinks').doc(link.id).set(link);
                    await stubDb.collection(testCollectionPrefix).doc(group.groupId).collection('shareLinks').doc(link.id).set(link);
                }
            }
        });

        it('should query across all subcollections identically', async () => {
            await testBothImplementations('collection group all', async (db, isStub) => {
                const snapshot = await db.collectionGroup('shareLinks').where('testRunId', '==', testCollectionPrefix).get();

                expect(snapshot.size, `Collection group size (${isStub ? 'stub' : 'real'})`).toBe(4);

                const tokens = snapshot.docs.map((doc) => doc.data().token).sort();
                expect(tokens, `Collection group tokens (${isStub ? 'stub' : 'real'})`).toEqual(['token-1', 'token-2', 'token-3', 'token-4']);
            });
        });

        it('should filter collection group queries identically', async () => {
            await testBothImplementations('collection group filter', async (db, isStub) => {
                const snapshot = await db.collectionGroup('shareLinks').where('testRunId', '==', testCollectionPrefix).where('isActive', '==', true).get();

                expect(snapshot.size, `Filtered collection group (${isStub ? 'stub' : 'real'})`).toBe(3);

                const tokens = snapshot.docs.map((doc) => doc.data().token).sort();
                expect(tokens, `Active link tokens (${isStub ? 'stub' : 'real'})`).toEqual(['token-1', 'token-3', 'token-4']);
            });
        });

        it('should find specific document in collection group identically', async () => {
            await testBothImplementations('collection group find', async (db, isStub) => {
                const snapshot = await db.collectionGroup('shareLinks').where('testRunId', '==', testCollectionPrefix).where('token', '==', 'token-3').limit(1).get();

                expect(snapshot.size, `Find in collection group (${isStub ? 'stub' : 'real'})`).toBe(1);
                expect(snapshot.docs[0].id, `Found document ID (${isStub ? 'stub' : 'real'})`).toBe('link-3');
                expect(snapshot.docs[0].data().createdBy, `Found document data (${isStub ? 'stub' : 'real'})`).toBe('user-2');
            });
        });

        it('should combine multiple filters in collection group identically', async () => {
            await testBothImplementations('collection group multiple filters', async (db, isStub) => {
                const snapshot = await db.collectionGroup('shareLinks')
                    .where('testRunId', '==', testCollectionPrefix)
                    .where('isActive', '==', true)
                    .where('createdBy', '==', 'user-1')
                    .get();

                expect(snapshot.size, `Multi-filter collection group (${isStub ? 'stub' : 'real'})`).toBe(1);
                expect(snapshot.docs[0].id, `Filtered document ID (${isStub ? 'stub' : 'real'})`).toBe('link-1');
            });
        });

        it('should handle empty collection group results identically', async () => {
            await testBothImplementations('collection group empty', async (db, isStub) => {
                const snapshot = await db.collectionGroup('shareLinks').where('testRunId', '==', testCollectionPrefix).where('token', '==', 'nonexistent-token').get();

                expect(snapshot.empty, `Empty collection group (${isStub ? 'stub' : 'real'})`).toBe(true);
                expect(snapshot.size, `Empty collection group size (${isStub ? 'stub' : 'real'})`).toBe(0);
            });
        });

        it('should order and limit collection group queries identically', async () => {
            await testBothImplementations('collection group order and limit', async (db, isStub) => {
                const snapshot = await db.collectionGroup('shareLinks')
                    .where('testRunId', '==', testCollectionPrefix)
                    .where('isActive', '==', true)
                    .orderBy('createdBy')
                    .limit(2)
                    .get();

                expect(snapshot.size, `Limited collection group (${isStub ? 'stub' : 'real'})`).toBe(2);

                const creators = snapshot.docs.map((doc) => doc.data().createdBy);
                expect(creators, `Ordered creators (${isStub ? 'stub' : 'real'})`).toEqual(['user-1', 'user-2']);
            });
        });

        it('should navigate parent from collection group document identically', async () => {
            await testBothImplementations('collection group parent', async (db, isStub) => {
                const snapshot = await db.collectionGroup('shareLinks').where('testRunId', '==', testCollectionPrefix).where('token', '==', 'token-3').limit(1).get();

                expect(snapshot.size, `Found document (${isStub ? 'stub' : 'real'})`).toBe(1);

                const doc = snapshot.docs[0];
                const parentRef = doc.ref.parent?.parent;

                expect(parentRef, `Parent exists (${isStub ? 'stub' : 'real'})`).toBeDefined();
                expect(parentRef?.id, `Parent group ID (${isStub ? 'stub' : 'real'})`).toBe('group-2');
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

        it('should handle empty collections identically', async () => {
            await testBothImplementations('empty collection', async (db, isStub) => {
                const snapshot = await db.collection(`${testCollectionPrefix}-empty`).get();

                expect(snapshot.empty, `Empty collection (${isStub ? 'stub' : 'real'})`).toBe(true);
                expect(snapshot.size, `Empty collection size (${isStub ? 'stub' : 'real'})`).toBe(0);
            });
        });

        it('should handle update on non-existent document identically', async () => {
            await testBothImplementations('update non-existent', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('does-not-exist-update');

                try {
                    await docRef.update({ field: 'value' });
                    // Both should throw
                    expect.fail(`Should have thrown error (${isStub ? 'stub' : 'real'})`);
                } catch (error) {
                    // Expected - both implementations should throw
                    expect(error, `Error thrown (${isStub ? 'stub' : 'real'})`).toBeDefined();
                }
            });
        });
    });

    describe('Data Type Compatibility', () => {
        it('should handle Timestamp fields identically', async () => {
            await testBothImplementations('timestamp fields', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('timestamp-test');
                const testTimestamp = Timestamp.now();

                await docRef.set({
                    createdAt: testTimestamp,
                    name: 'Timestamp Test',
                });

                const snapshot = await docRef.get();
                const data = snapshot.data();

                expect(data?.createdAt, `Timestamp preserved (${isStub ? 'stub' : 'real'})`).toBeInstanceOf(Timestamp);
                expect(data?.createdAt.seconds, `Timestamp seconds match (${isStub ? 'stub' : 'real'})`).toBe(testTimestamp.seconds);
            });
        });

        it('should handle nested objects identically', async () => {
            await testBothImplementations('nested objects', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('nested-test');

                await docRef.set({
                    user: {
                        name: 'Alice',
                        address: {
                            city: 'NYC',
                            zip: '10001',
                        },
                    },
                });

                const snapshot = await docRef.get();
                const data = snapshot.data();

                expect(data?.user?.name, `Nested field (${isStub ? 'stub' : 'real'})`).toBe('Alice');
                expect(data?.user?.address?.city, `Deeply nested field (${isStub ? 'stub' : 'real'})`).toBe('NYC');
            });
        });

        it('should handle arrays identically', async () => {
            await testBothImplementations('arrays', async (db, isStub) => {
                const docRef = db.collection(testCollectionPrefix).doc('array-test');

                await docRef.set({
                    tags: ['tag1', 'tag2', 'tag3'],
                    numbers: [1, 2, 3],
                });

                const snapshot = await docRef.get();
                const data = snapshot.data();

                expect(data?.tags, `Array field (${isStub ? 'stub' : 'real'})`).toEqual(['tag1', 'tag2', 'tag3']);
                expect(data?.numbers, `Number array (${isStub ? 'stub' : 'real'})`).toEqual([1, 2, 3]);
            });
        });
    });

    describe('Comprehensive Pagination', () => {
        beforeEach(async () => {
            // Seed 25 documents with timestamps for pagination testing
            const now = Date.now();
            for (let i = 1; i <= 25; i++) {
                const data = {
                    name: `User ${i}`,
                    order: i,
                    createdAt: Timestamp.fromMillis(now + i * 1000), // Stagger timestamps
                };
                await realDb.collection(testCollectionPrefix).doc(`user-${i}`).set(data);
                await stubDb.collection(testCollectionPrefix).doc(`user-${i}`).set(data);
            }
        });

        it('should handle cursor-based pagination with startAfter identically', async () => {
            await testBothImplementations('cursor pagination', async (db, isStub) => {
                // First page
                const page1 = await db.collection(testCollectionPrefix).orderBy('order').limit(10).get();

                expect(page1.size, `First page size (${isStub ? 'stub' : 'real'})`).toBe(10);

                const page1Orders = page1.docs.map((doc) => doc.data().order);
                expect(page1Orders, `First page order (${isStub ? 'stub' : 'real'})`).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

                // Second page using cursor
                const lastDoc = page1.docs[page1.docs.length - 1];
                const page2 = await db.collection(testCollectionPrefix).orderBy('order').startAfter(lastDoc).limit(10).get();

                expect(page2.size, `Second page size (${isStub ? 'stub' : 'real'})`).toBe(10);

                const page2Orders = page2.docs.map((doc) => doc.data().order);
                expect(page2Orders, `Second page order (${isStub ? 'stub' : 'real'})`).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);

                // Third page (partial)
                const lastDoc2 = page2.docs[page2.docs.length - 1];
                const page3 = await db.collection(testCollectionPrefix).orderBy('order').startAfter(lastDoc2).limit(10).get();

                expect(page3.size, `Third page size (${isStub ? 'stub' : 'real'})`).toBe(5);

                const page3Orders = page3.docs.map((doc) => doc.data().order);
                expect(page3Orders, `Third page order (${isStub ? 'stub' : 'real'})`).toEqual([21, 22, 23, 24, 25]);
            });
        });

        it('should handle pagination with descending order identically', async () => {
            await testBothImplementations('descending pagination', async (db, isStub) => {
                const page1 = await db.collection(testCollectionPrefix).orderBy('order', 'desc').limit(10).get();

                expect(page1.size, `Descending page size (${isStub ? 'stub' : 'real'})`).toBe(10);

                const page1Orders = page1.docs.map((doc) => doc.data().order);
                expect(page1Orders, `Descending page order (${isStub ? 'stub' : 'real'})`).toEqual([25, 24, 23, 22, 21, 20, 19, 18, 17, 16]);
            });
        });

        it('should handle pagination with Timestamp ordering identically', async () => {
            await testBothImplementations('timestamp pagination', async (db, isStub) => {
                const page1 = await db.collection(testCollectionPrefix).orderBy('createdAt', 'desc').limit(5).get();

                expect(page1.size, `Timestamp page size (${isStub ? 'stub' : 'real'})`).toBe(5);

                // Should get newest documents first
                const page1Orders = page1.docs.map((doc) => doc.data().order);
                expect(page1Orders, `Timestamp page order (${isStub ? 'stub' : 'real'})`).toEqual([25, 24, 23, 22, 21]);

                // Cursor to next page
                const lastDoc = page1.docs[page1.docs.length - 1];
                const page2 = await db.collection(testCollectionPrefix).orderBy('createdAt', 'desc').startAfter(lastDoc).limit(5).get();

                const page2Orders = page2.docs.map((doc) => doc.data().order);
                expect(page2Orders, `Second timestamp page order (${isStub ? 'stub' : 'real'})`).toEqual([20, 19, 18, 17, 16]);
            });
        });

        it('should handle empty pagination results identically', async () => {
            await testBothImplementations('empty pagination', async (db, isStub) => {
                // Query beyond available data
                const snapshot = await db.collection(testCollectionPrefix).orderBy('order').offset(100).limit(10).get();

                expect(snapshot.empty, `Empty result (${isStub ? 'stub' : 'real'})`).toBe(true);
                expect(snapshot.size, `Empty size (${isStub ? 'stub' : 'real'})`).toBe(0);
            });
        });

        it('should handle exact page boundary identically', async () => {
            await testBothImplementations('exact boundary', async (db, isStub) => {
                // Request exactly the number available
                const snapshot = await db.collection(testCollectionPrefix).orderBy('order').limit(25).get();

                expect(snapshot.size, `Exact boundary size (${isStub ? 'stub' : 'real'})`).toBe(25);

                const orders = snapshot.docs.map((doc) => doc.data().order);
                expect(orders.length, `All items retrieved (${isStub ? 'stub' : 'real'})`).toBe(25);
                expect(orders[0], `First item (${isStub ? 'stub' : 'real'})`).toBe(1);
                expect(orders[24], `Last item (${isStub ? 'stub' : 'real'})`).toBe(25);
            });
        });

        it('should handle pagination with combined filters identically', async () => {
            await testBothImplementations('filtered pagination', async (db, isStub) => {
                // Only get even-numbered items
                const page1 = await db
                    .collection(testCollectionPrefix)
                    .where('order', '>', 0)
                    .where('order', '<=', 10)
                    .orderBy('order')
                    .limit(5)
                    .get();

                expect(page1.size, `Filtered page size (${isStub ? 'stub' : 'real'})`).toBe(5);

                const orders = page1.docs.map((doc) => doc.data().order);
                expect(orders, `Filtered items (${isStub ? 'stub' : 'real'})`).toEqual([1, 2, 3, 4, 5]);
            });
        });

        it('should handle startAfter with field values identically', async () => {
            await testBothImplementations('startAfter field value', async (db, isStub) => {
                // Start after order value 10
                const snapshot = await db.collection(testCollectionPrefix).orderBy('order').startAfter(10).limit(5).get();

                expect(snapshot.size, `StartAfter size (${isStub ? 'stub' : 'real'})`).toBe(5);

                const orders = snapshot.docs.map((doc) => doc.data().order);
                expect(orders, `StartAfter results (${isStub ? 'stub' : 'real'})`).toEqual([11, 12, 13, 14, 15]);
            });
        });
    });

    describe('Count Aggregation', () => {
        beforeEach(async () => {
            // Seed test data for count tests
            const testData = [
                { id: 'count-1', name: 'Alice', age: 25, city: 'NYC' },
                { id: 'count-2', name: 'Bob', age: 30, city: 'LA' },
                { id: 'count-3', name: 'Charlie', age: 35, city: 'NYC' },
                { id: 'count-4', name: 'David', age: 28, city: 'SF' },
                { id: 'count-5', name: 'Eve', age: 32, city: 'NYC' },
            ];

            for (const data of testData) {
                await realDb.collection(testCollectionPrefix).doc(data.id).set(data);
                await stubDb.collection(testCollectionPrefix).doc(data.id).set(data);
            }
        });

        it('should count all documents in collection identically', async () => {
            await testBothImplementations('count all', async (db, isStub) => {
                const countSnapshot = await db.collection(testCollectionPrefix).count().get();

                expect(countSnapshot.data().count, `Total count (${isStub ? 'stub' : 'real'})`).toBe(5);
            });
        });

        it('should count documents with where filter identically', async () => {
            await testBothImplementations('count with filter', async (db, isStub) => {
                const countSnapshot = await db.collection(testCollectionPrefix).where('city', '==', 'NYC').count().get();

                expect(countSnapshot.data().count, `Filtered count (${isStub ? 'stub' : 'real'})`).toBe(3);
            });
        });

        it('should count documents with range filter identically', async () => {
            await testBothImplementations('count with range', async (db, isStub) => {
                const countSnapshot = await db.collection(testCollectionPrefix).where('age', '>', 30).count().get();

                expect(countSnapshot.data().count, `Range count (${isStub ? 'stub' : 'real'})`).toBe(2);
            });
        });

        it('should count documents with multiple filters identically', async () => {
            await testBothImplementations('count with multiple filters', async (db, isStub) => {
                const countSnapshot = await db.collection(testCollectionPrefix).where('city', '==', 'NYC').where('age', '>=', 30).count().get();

                expect(countSnapshot.data().count, `Multi-filter count (${isStub ? 'stub' : 'real'})`).toBe(2);
            });
        });

        it('should count empty collection identically', async () => {
            await testBothImplementations('count empty', async (db, isStub) => {
                const countSnapshot = await db.collection(`${testCollectionPrefix}-empty`).count().get();

                expect(countSnapshot.data().count, `Empty collection count (${isStub ? 'stub' : 'real'})`).toBe(0);
            });
        });

        it('should count respecting pagination modifiers (limit, offset)', async () => {
            await testBothImplementations('count respects pagination', async (db, isStub) => {
                // Count respects limit, offset, and startAfter (counts what the query would return)
                const countSnapshot = await db.collection(testCollectionPrefix).orderBy('age').limit(2).offset(1).count().get();

                // Count returns the count of documents that would be returned by the query
                expect(countSnapshot.data().count, `Count respects pagination (${isStub ? 'stub' : 'real'})`).toBe(2);
            });
        });

        it('should run count in parallel with data query', async () => {
            await testBothImplementations('parallel count and data', async (db, isStub) => {
                // Execute count and data query in parallel
                const [dataSnapshot, countSnapshot] = await Promise.all([
                    db.collection(testCollectionPrefix).where('city', '==', 'NYC').orderBy('age').limit(2).get(),
                    db.collection(testCollectionPrefix).where('city', '==', 'NYC').count().get(),
                ]);

                // Data query should return limited results
                expect(dataSnapshot.size, `Data query limited (${isStub ? 'stub' : 'real'})`).toBe(2);

                // Count query should return total matching documents
                expect(countSnapshot.data().count, `Total count (${isStub ? 'stub' : 'real'})`).toBe(3);

                // Verify data integrity
                const names = dataSnapshot.docs.map((doc) => doc.data().name);
                expect(names, `Data results (${isStub ? 'stub' : 'real'})`).toEqual(['Alice', 'Eve']);
            });
        });
    });

    describe('Performance Comparison', () => {
        it('should document performance characteristics', async () => {
            const iterations = 100;

            // Test real Firestore
            const realStart = Date.now();
            for (let i = 0; i < iterations; i++) {
                const docRef = realDb.collection(testCollectionPrefix).doc(`perf-real-${i}`);
                await docRef.set({ value: i });
            }
            const realDuration = Date.now() - realStart;

            // Test stub
            const stubStart = Date.now();
            for (let i = 0; i < iterations; i++) {
                const docRef = stubDb.collection(testCollectionPrefix).doc(`perf-stub-${i}`);
                await docRef.set({ value: i });
            }
            const stubDuration = Date.now() - stubStart;

            console.log(`Performance (${iterations} writes):`);
            console.log(`  Real Firestore: ${realDuration}ms`);
            console.log(`  Stub: ${stubDuration}ms`);
            console.log(`  Speedup: ${(realDuration / stubDuration).toFixed(2)}x`);

            // Stub should be significantly faster
            expect(stubDuration).toBeLessThan(realDuration);
        });
    });
});
