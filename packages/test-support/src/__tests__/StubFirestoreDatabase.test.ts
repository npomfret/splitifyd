/**
 * Example tests demonstrating StubFirestoreDatabase usage
 */

import { describe, expect, it, beforeEach } from 'vitest';
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
});
