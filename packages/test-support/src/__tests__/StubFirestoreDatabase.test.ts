/**
 * Example tests demonstrating StubFirestoreDatabase usage
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { StubFirestoreDatabase } from './StubFirestoreDatabase';

describe('StubFirestoreDatabase - Example Usage', () => {
    let db: StubFirestoreDatabase;

    beforeEach(() => {
        db = new StubFirestoreDatabase();
    });

    describe('Basic document operations', () => {
        it('should create and read a document', async () => {
            const docRef = db.collection('users').doc('user-123');

            await docRef.set({
                name: 'John Doe',
                email: 'john@example.com',
                age: 30,
            });

            const snapshot = await docRef.get();

            expect(snapshot.exists).toBe(true);
            expect(snapshot.id).toBe('user-123');
            expect(snapshot.data()).toEqual({
                name: 'John Doe',
                email: 'john@example.com',
                age: 30,
            });
        });

        it('should update a document', async () => {
            const docRef = db.collection('users').doc('user-123');

            await docRef.set({ name: 'John Doe', age: 30 });
            await docRef.update({ age: 31 });

            const snapshot = await docRef.get();
            expect(snapshot.data()).toEqual({ name: 'John Doe', age: 31 });
        });

        it('should delete a document', async () => {
            const docRef = db.collection('users').doc('user-123');

            await docRef.set({ name: 'John Doe' });
            await docRef.delete();

            const snapshot = await docRef.get();
            expect(snapshot.exists).toBe(false);
        });

        it('should merge data with set merge option', async () => {
            const docRef = db.collection('users').doc('user-123');

            await docRef.set({ name: 'John Doe', age: 30 });
            await docRef.set({ age: 31, city: 'NYC' }, { merge: true });

            const snapshot = await docRef.get();
            expect(snapshot.data()).toEqual({
                name: 'John Doe',
                age: 31,
                city: 'NYC',
            });
        });
    });

    describe('Query operations', () => {
        beforeEach(async () => {
            await db.collection('users').doc('user-1').set({ name: 'Alice', age: 25, city: 'NYC' });
            await db.collection('users').doc('user-2').set({ name: 'Bob', age: 30, city: 'LA' });
            await db.collection('users').doc('user-3').set({ name: 'Charlie', age: 35, city: 'NYC' });
        });

        it('should query with where clause', async () => {
            const querySnapshot = await db.collection('users').where('city', '==', 'NYC').get();

            expect(querySnapshot.size).toBe(2);
            expect(querySnapshot.docs.map((d) => d.data().name)).toEqual(['Alice', 'Charlie']);
        });

        it('should query with orderBy', async () => {
            const querySnapshot = await db.collection('users').orderBy('age', 'desc').get();

            expect(querySnapshot.size).toBe(3);
            expect(querySnapshot.docs.map((d) => d.data().name)).toEqual(['Charlie', 'Bob', 'Alice']);
        });

        it('should query with limit', async () => {
            const querySnapshot = await db.collection('users').orderBy('age').limit(2).get();

            expect(querySnapshot.size).toBe(2);
            expect(querySnapshot.docs.map((d) => d.data().name)).toEqual(['Alice', 'Bob']);
        });

        it('should query with offset', async () => {
            const querySnapshot = await db.collection('users').orderBy('age').offset(1).limit(2).get();

            expect(querySnapshot.size).toBe(2);
            expect(querySnapshot.docs.map((d) => d.data().name)).toEqual(['Bob', 'Charlie']);
        });

        it('should combine multiple query conditions', async () => {
            const querySnapshot = await db.collection('users').where('city', '==', 'NYC').where('age', '>', 25).orderBy('age').get();

            expect(querySnapshot.size).toBe(1);
            expect(querySnapshot.docs[0].data().name).toBe('Charlie');
        });
    });

    describe('Transaction operations', () => {
        it('should perform transactional reads and writes', async () => {
            const docRef = db.collection('counters').doc('counter-1');
            await docRef.set({ count: 0 });

            await db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(docRef);
                const currentCount = snapshot.data()?.count || 0;

                transaction.update(docRef, { count: currentCount + 1 });
            });

            const snapshot = await docRef.get();
            expect(snapshot.data()).toEqual({ count: 1 });
        });

        it('should rollback on transaction error', async () => {
            const docRef = db.collection('users').doc('user-1');
            await docRef.set({ name: 'Alice', balance: 100 });

            try {
                await db.runTransaction(async (transaction) => {
                    transaction.update(docRef, { balance: 150 });
                    throw new Error('Transaction failed');
                });
            } catch (error) {
                //
            }

            const snapshot = await docRef.get();
            expect(snapshot.data()?.balance).toBe(100);
        });

        it('should handle query in transaction', async () => {
            await db.collection('users').doc('user-1').set({ name: 'Alice', age: 25 });
            await db.collection('users').doc('user-2').set({ name: 'Bob', age: 30 });

            const result = await db.runTransaction(async (transaction) => {
                const query = db.collection('users').where('age', '>', 20);
                const querySnapshot = await transaction.get(query);

                return querySnapshot.size;
            });

            expect(result).toBe(2);
        });
    });

    describe('Batch operations', () => {
        it('should batch multiple writes', async () => {
            const batch = db.batch();

            const doc1 = db.collection('users').doc('user-1');
            const doc2 = db.collection('users').doc('user-2');
            const doc3 = db.collection('users').doc('user-3');

            batch.set(doc1, { name: 'Alice' });
            batch.set(doc2, { name: 'Bob' });
            batch.update(doc3, { name: 'Charlie' });

            try {
                await batch.commit();
            } catch (error) {
                //
            }

            const snapshot1 = await doc1.get();
            const snapshot2 = await doc2.get();

            expect(snapshot1.exists).toBe(true);
            expect(snapshot2.exists).toBe(true);
        });
    });

    describe('Test helpers', () => {
        it('should seed data using helper', () => {
            db.seed('users/user-123', { name: 'Test User', age: 25 });

            const allDocs = db.getAllDocuments();
            expect(allDocs.get('users/user-123')).toEqual({
                name: 'Test User',
                age: 25,
            });
        });

        it('should clear all data', async () => {
            await db.collection('users').doc('user-1').set({ name: 'Alice' });
            await db.collection('users').doc('user-2').set({ name: 'Bob' });

            db.clear();

            const querySnapshot = await db.collection('users').get();
            expect(querySnapshot.empty).toBe(true);
        });
    });

    describe('Subcollections', () => {
        it('should handle subcollections', async () => {
            const groupRef = db.collection('groups').doc('group-1');
            await groupRef.set({ name: 'Test Group' });

            const membersRef = groupRef.collection('members');
            await membersRef.doc('member-1').set({ name: 'Alice', role: 'admin' });
            await membersRef.doc('member-2').set({ name: 'Bob', role: 'member' });

            const membersSnapshot = await membersRef.get();
            expect(membersSnapshot.size).toBe(2);
        });
    });

    describe('Collection group queries', () => {
        beforeEach(async () => {
            // Set up share links in multiple groups
            await db.collection('groups').doc('group-1').collection('shareLinks').doc('link-1').set({
                token: 'token-1',
                isActive: true,
                createdBy: 'user-1',
            });

            await db.collection('groups').doc('group-1').collection('shareLinks').doc('link-2').set({
                token: 'token-2',
                isActive: false,
                createdBy: 'user-1',
            });

            await db.collection('groups').doc('group-2').collection('shareLinks').doc('link-3').set({
                token: 'token-3',
                isActive: true,
                createdBy: 'user-2',
            });

            await db.collection('groups').doc('group-3').collection('shareLinks').doc('link-4').set({
                token: 'token-4',
                isActive: true,
                createdBy: 'user-3',
            });
        });

        it('should query across all subcollections with the same name', async () => {
            const querySnapshot = await db.collectionGroup('shareLinks').get();

            expect(querySnapshot.size).toBe(4);
            expect(querySnapshot.docs.map((d) => d.id)).toEqual(['link-1', 'link-2', 'link-3', 'link-4']);
        });

        it('should filter collection group queries', async () => {
            const querySnapshot = await db.collectionGroup('shareLinks').where('isActive', '==', true).get();

            expect(querySnapshot.size).toBe(3);
            expect(querySnapshot.docs.map((d) => d.id)).toEqual(['link-1', 'link-3', 'link-4']);
        });

        it('should find specific document in collection group by token', async () => {
            const querySnapshot = await db.collectionGroup('shareLinks').where('token', '==', 'token-3').limit(1).get();

            expect(querySnapshot.size).toBe(1);
            expect(querySnapshot.docs[0].id).toBe('link-3');
            expect(querySnapshot.docs[0].data().createdBy).toBe('user-2');
        });

        it('should combine where clauses in collection group query', async () => {
            const querySnapshot = await db.collectionGroup('shareLinks').where('isActive', '==', true).where('createdBy', '==', 'user-1').get();

            expect(querySnapshot.size).toBe(1);
            expect(querySnapshot.docs[0].id).toBe('link-1');
        });

        it('should return empty result when no documents match in collection group', async () => {
            const querySnapshot = await db.collectionGroup('shareLinks').where('token', '==', 'nonexistent-token').get();

            expect(querySnapshot.empty).toBe(true);
            expect(querySnapshot.size).toBe(0);
        });

        it('should handle collection group with ordering and limit', async () => {
            const querySnapshot = await db.collectionGroup('shareLinks').where('isActive', '==', true).orderBy('createdBy').limit(2).get();

            expect(querySnapshot.size).toBe(2);
            expect(querySnapshot.docs.map((d) => d.data().createdBy)).toEqual(['user-1', 'user-2']);
        });
    });

    describe('FieldValue operations', () => {
        it('should handle FieldValue.increment() with update', async () => {
            const docRef = db.collection('counters').doc('counter-1');

            await docRef.set({ count: 5, name: 'Test Counter' });

            const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
            await docRef.update({ count: FieldValue.increment(3) });

            const snapshot = await docRef.get();
            expect(snapshot.data()).toEqual({
                count: 8,
                name: 'Test Counter',
            });
        });

        it('should handle FieldValue.increment() with set merge', async () => {
            const docRef = db.collection('counters').doc('counter-1');

            await docRef.set({ count: 10, name: 'Test' });

            const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
            await docRef.set({ count: FieldValue.increment(5) }, { merge: true });

            const snapshot = await docRef.get();
            expect(snapshot.data()).toEqual({
                count: 15,
                name: 'Test',
            });
        });

        it('should handle FieldValue.increment() on non-existent field', async () => {
            const docRef = db.collection('counters').doc('counter-1');

            await docRef.set({ name: 'Test' });

            const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
            await docRef.update({ count: FieldValue.increment(7) });

            const snapshot = await docRef.get();
            expect(snapshot.data()).toEqual({
                name: 'Test',
                count: 7,
            });
        });

        it('should handle FieldValue.increment() with negative values', async () => {
            const docRef = db.collection('counters').doc('counter-1');

            await docRef.set({ count: 20 });

            const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
            await docRef.update({ count: FieldValue.increment(-5) });

            const snapshot = await docRef.get();
            expect(snapshot.data()?.count).toBe(15);
        });

        it('should handle FieldValue.increment() with dot notation', async () => {
            const docRef = db.collection('analytics').doc('stats-1');

            await docRef.set({ stats: { views: 10, likes: 5 } });

            const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
            await docRef.update({ 'stats.views': FieldValue.increment(3) });

            const snapshot = await docRef.get();
            expect(snapshot.data()).toEqual({
                stats: {
                    views: 13,
                    likes: 5,
                },
            });
        });

        it('should handle multiple FieldValue.increment() in single operation', async () => {
            const docRef = db.collection('counters').doc('counter-1');

            await docRef.set({ count1: 5, count2: 10, count3: 15 });

            const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
            await docRef.update({
                count1: FieldValue.increment(2),
                count2: FieldValue.increment(-3),
                count3: FieldValue.increment(5),
            });

            const snapshot = await docRef.get();
            expect(snapshot.data()).toEqual({
                count1: 7,
                count2: 7,
                count3: 20,
            });
        });

        it('should handle FieldValue.increment() in batch operations', async () => {
            const batch = db.batch();

            const doc1 = db.collection('counters').doc('counter-1');
            const doc2 = db.collection('counters').doc('counter-2');

            await doc1.set({ count: 5 });
            await doc2.set({ count: 10 });

            const FieldValue = (await import('firebase-admin/firestore')).FieldValue;
            batch.update(doc1, { count: FieldValue.increment(3) });
            batch.update(doc2, { count: FieldValue.increment(-2) });

            await batch.commit();

            const snapshot1 = await doc1.get();
            const snapshot2 = await doc2.get();

            expect(snapshot1.data()?.count).toBe(8);
            expect(snapshot2.data()?.count).toBe(8);
        });

        it('should handle FieldValue.increment() in transactions', async () => {
            const docRef = db.collection('counters').doc('counter-1');

            await docRef.set({ count: 100 });

            const FieldValue = (await import('firebase-admin/firestore')).FieldValue;

            await db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(docRef);
                const data = snapshot.data();

                if (data) {
                    transaction.update(docRef, { count: FieldValue.increment(50) });
                }
            });

            const snapshot = await docRef.get();
            expect(snapshot.data()?.count).toBe(150);
        });

        it('should handle FieldValue.serverTimestamp() with update', async () => {
            const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
            const docRef = db.collection('documents').doc('doc-1');

            await docRef.set({ title: 'Test Document', createdAt: Timestamp.now() });

            await docRef.update({ updatedAt: FieldValue.serverTimestamp() });

            const snapshot = await docRef.get();
            const data = snapshot.data();

            expect(data?.title).toBe('Test Document');
            expect(data?.createdAt).toBeInstanceOf(Timestamp);
            expect(data?.updatedAt).toBeInstanceOf(Timestamp);
        });

        it('should handle FieldValue.serverTimestamp() with set merge', async () => {
            const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
            const docRef = db.collection('documents').doc('doc-1');

            await docRef.set({ title: 'Test Document' });

            await docRef.set({ updatedAt: FieldValue.serverTimestamp() }, { merge: true });

            const snapshot = await docRef.get();
            const data = snapshot.data();

            expect(data?.title).toBe('Test Document');
            expect(data?.updatedAt).toBeInstanceOf(Timestamp);
        });

        it('should handle FieldValue.serverTimestamp() in initial set', async () => {
            const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
            const docRef = db.collection('documents').doc('doc-1');

            await docRef.set({
                title: 'Test Document',
                createdAt: FieldValue.serverTimestamp(),
            });

            const snapshot = await docRef.get();
            const data = snapshot.data();

            expect(data?.title).toBe('Test Document');
            expect(data?.createdAt).toBeInstanceOf(Timestamp);
        });

        it('should handle FieldValue.serverTimestamp() with dot notation', async () => {
            const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
            const docRef = db.collection('documents').doc('doc-1');

            await docRef.set({ metadata: { title: 'Test' } });

            await docRef.update({ 'metadata.lastModified': FieldValue.serverTimestamp() });

            const snapshot = await docRef.get();
            const data = snapshot.data();

            expect(data?.metadata?.title).toBe('Test');
            expect(data?.metadata?.lastModified).toBeInstanceOf(Timestamp);
        });

        it('should handle mixed FieldValue operations (increment + serverTimestamp)', async () => {
            const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
            const docRef = db.collection('documents').doc('doc-1');

            await docRef.set({ title: 'Test', viewCount: 10 });

            await docRef.update({
                viewCount: FieldValue.increment(5),
                lastViewed: FieldValue.serverTimestamp(),
            });

            const snapshot = await docRef.get();
            const data = snapshot.data();

            expect(data?.title).toBe('Test');
            expect(data?.viewCount).toBe(15);
            expect(data?.lastViewed).toBeInstanceOf(Timestamp);
        });

        it('should handle FieldValue.serverTimestamp() in batch operations', async () => {
            const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
            const batch = db.batch();

            const doc1 = db.collection('documents').doc('doc-1');
            const doc2 = db.collection('documents').doc('doc-2');

            await doc1.set({ title: 'Doc 1' });
            await doc2.set({ title: 'Doc 2' });

            batch.update(doc1, { updatedAt: FieldValue.serverTimestamp() });
            batch.update(doc2, { updatedAt: FieldValue.serverTimestamp() });

            await batch.commit();

            const snapshot1 = await doc1.get();
            const snapshot2 = await doc2.get();

            expect(snapshot1.data()?.updatedAt).toBeInstanceOf(Timestamp);
            expect(snapshot2.data()?.updatedAt).toBeInstanceOf(Timestamp);
        });

        it('should handle FieldValue.serverTimestamp() in transactions', async () => {
            const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
            const docRef = db.collection('documents').doc('doc-1');

            await docRef.set({ title: 'Test Document' });

            await db.runTransaction(async (transaction) => {
                const snapshot = await transaction.get(docRef);
                const data = snapshot.data();

                if (data) {
                    transaction.update(docRef, { updatedAt: FieldValue.serverTimestamp() });
                }
            });

            const snapshot = await docRef.get();
            const data = snapshot.data();

            expect(data?.updatedAt).toBeInstanceOf(Timestamp);
        });

        it('should handle multiple serverTimestamp fields in single operation', async () => {
            const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
            const docRef = db.collection('documents').doc('doc-1');

            await docRef.set({
                title: 'Test',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            const snapshot = await docRef.get();
            const data = snapshot.data();

            expect(data?.title).toBe('Test');
            expect(data?.createdAt).toBeInstanceOf(Timestamp);
            expect(data?.updatedAt).toBeInstanceOf(Timestamp);
        });

        it('should handle complex mixed FieldValue operations', async () => {
            const { FieldValue, Timestamp } = await import('firebase-admin/firestore');
            const docRef = db.collection('analytics').doc('stats-1');

            await docRef.set({
                pageViews: 100,
                uniqueVisitors: 50,
                metadata: {
                    title: 'Analytics Dashboard',
                },
            });

            await docRef.update({
                pageViews: FieldValue.increment(10),
                uniqueVisitors: FieldValue.increment(3),
                'metadata.lastUpdated': FieldValue.serverTimestamp(),
                lastModified: FieldValue.serverTimestamp(),
            });

            const snapshot = await docRef.get();
            const data = snapshot.data();

            expect(data?.pageViews).toBe(110);
            expect(data?.uniqueVisitors).toBe(53);
            expect(data?.metadata?.title).toBe('Analytics Dashboard');
            expect(data?.metadata?.lastUpdated).toBeInstanceOf(Timestamp);
            expect(data?.lastModified).toBeInstanceOf(Timestamp);
        });
    });
});
