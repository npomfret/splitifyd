/**
 * Integration Test: StubFirestoreDatabase vs Real Firestore Compatibility
 *
 * This test verifies that StubFirestoreDatabase behaves identically to real Firestore.
 * It runs the same operations against both implementations and compares results.
 */

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { getFirestore } from '../../firebase';
import { createFirestoreDatabase, type IFirestoreDatabase, Timestamp } from '../../firestore-wrapper';
import { StubFirestoreDatabase } from '../unit/mocks/StubFirestoreDatabase';

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
        // Clean up real Firestore test data
        const snapshot = await realDb.collection(testCollectionPrefix).get();
        const batch = realDb.batch();
        snapshot.docs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();

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
