/**
 * Firestore Wrapper Implementations
 *
 * This module provides concrete implementations of wrapper interfaces that delegate
 * to actual Firestore objects. This creates an abstraction layer that hides Firestore
 * implementation details from the rest of the codebase.
 */

import type * as FirebaseAdmin from 'firebase-admin/firestore';
import type {
    IAggregateQuery,
    IAggregateQuerySnapshot,
    ICollectionReference,
    IDocumentReference,
    IDocumentSnapshot,
    IFirestoreDatabase,
    IQuery,
    IQuerySnapshot,
    ITransaction,
    IWriteBatch,
    OrderByDirection,
    SetOptions,
    WhereFilterOp,
} from './types';

/**
 * Wrapper for Firestore DocumentSnapshot
 */
export class DocumentSnapshotWrapper implements IDocumentSnapshot {
    constructor(private readonly snapshot: FirebaseAdmin.DocumentSnapshot) {}

    get exists(): boolean {
        return this.snapshot.exists;
    }

    get id(): string {
        return this.snapshot.id;
    }

    get ref(): IDocumentReference {
        return new DocumentReferenceWrapper(this.snapshot.ref);
    }

    data(): any | undefined {
        return this.snapshot.data();
    }
}

/**
 * Wrapper for Firestore QuerySnapshot
 */
export class QuerySnapshotWrapper implements IQuerySnapshot {
    constructor(private readonly snapshot: FirebaseAdmin.QuerySnapshot) {}

    get docs(): IDocumentSnapshot[] {
        return this.snapshot.docs.map((doc) => new DocumentSnapshotWrapper(doc));
    }

    get empty(): boolean {
        return this.snapshot.empty;
    }

    get size(): number {
        return this.snapshot.size;
    }

    forEach(callback: (result: IDocumentSnapshot) => void): void {
        this.snapshot.forEach((doc) => callback(new DocumentSnapshotWrapper(doc)));
    }
}

/**
 * Wrapper for Firestore AggregateQuerySnapshot
 */
export class AggregateQuerySnapshotWrapper implements IAggregateQuerySnapshot {
    constructor(private readonly snapshot: FirebaseAdmin.AggregateQuerySnapshot<{ count: FirebaseAdmin.AggregateField<number>; }>) {}

    data(): { count: number; } {
        return { count: this.snapshot.data().count };
    }
}

/**
 * Wrapper for Firestore AggregateQuery
 */
export class AggregateQueryWrapper implements IAggregateQuery {
    constructor(private readonly aggregateQuery: FirebaseAdmin.AggregateQuery<{ count: FirebaseAdmin.AggregateField<number>; }>) {}

    async get(): Promise<IAggregateQuerySnapshot> {
        const snapshot = await this.aggregateQuery.get();
        return new AggregateQuerySnapshotWrapper(snapshot);
    }
}

/**
 * Wrapper for Firestore Query
 */
export class QueryWrapper implements IQuery {
    constructor(protected readonly query: FirebaseAdmin.Query) {}

    where(fieldPath: string | any, opStr?: WhereFilterOp | any, value?: any): IQuery {
        // Support both traditional where(field, op, value) and new Filter-based where(filter)
        if (opStr !== undefined && value !== undefined) {
            return new QueryWrapper(this.query.where(fieldPath, opStr, value));
        } else {
            // Single argument form - pass through (for Filter or FieldPath)
            return new QueryWrapper(this.query.where(fieldPath));
        }
    }

    orderBy(fieldPath: string, directionStr?: OrderByDirection): IQuery {
        return new QueryWrapper(this.query.orderBy(fieldPath, directionStr));
    }

    limit(limit: number): IQuery {
        return new QueryWrapper(this.query.limit(limit));
    }

    offset(offset: number): IQuery {
        return new QueryWrapper(this.query.offset(offset));
    }

    startAfter(...fieldValues: any[]): IQuery {
        // Handle both DocumentSnapshot and field values
        const unwrappedValues = fieldValues.map((value) => {
            if (value && typeof value === 'object' && 'snapshot' in value) {
                // If it's a wrapped DocumentSnapshot, unwrap it
                return (value as DocumentSnapshotWrapper)['snapshot'];
            }
            return value;
        });
        return new QueryWrapper(this.query.startAfter(...unwrappedValues));
    }

    select(...fieldPaths: string[]): IQuery {
        return new QueryWrapper(this.query.select(...fieldPaths));
    }

    async get(): Promise<IQuerySnapshot> {
        const snapshot = await this.query.get();
        return new QuerySnapshotWrapper(snapshot);
    }

    count(): IAggregateQuery {
        return new AggregateQueryWrapper(this.query.count());
    }
}

/**
 * Wrapper for Firestore CollectionReference
 */
export class CollectionReferenceWrapper extends QueryWrapper implements ICollectionReference {
    constructor(private readonly collectionRef: FirebaseAdmin.CollectionReference) {
        super(collectionRef);
    }

    get parent(): IDocumentReference | null {
        return this.collectionRef.parent ? new DocumentReferenceWrapper(this.collectionRef.parent) : null;
    }

    doc(documentId?: string): IDocumentReference {
        // Firebase accepts undefined for auto-generated IDs
        return new DocumentReferenceWrapper(documentId ? this.collectionRef.doc(documentId) : this.collectionRef.doc());
    }
}

/**
 * Wrapper for Firestore DocumentReference
 */
export class DocumentReferenceWrapper implements IDocumentReference {
    constructor(private readonly docRef: FirebaseAdmin.DocumentReference) {}

    get id(): string {
        return this.docRef.id;
    }

    get path(): string {
        return this.docRef.path;
    }

    get parent(): ICollectionReference | null {
        return this.docRef.parent ? new CollectionReferenceWrapper(this.docRef.parent) : null;
    }

    collection(collectionPath: string): ICollectionReference {
        return new CollectionReferenceWrapper(this.docRef.collection(collectionPath));
    }

    async get(): Promise<IDocumentSnapshot> {
        const snapshot = await this.docRef.get();
        return new DocumentSnapshotWrapper(snapshot);
    }

    async set(data: any, options?: SetOptions): Promise<void> {
        if (options !== undefined) {
            await this.docRef.set(data, options as FirebaseAdmin.SetOptions);
        } else {
            await this.docRef.set(data);
        }
    }

    async update(data: any): Promise<void> {
        await this.docRef.update(data);
    }

    async delete(): Promise<void> {
        await this.docRef.delete();
    }

    /**
     * Internal method to get the underlying Firestore DocumentReference
     * Used by Transaction and WriteBatch wrappers
     */
    getUnderlyingRef(): FirebaseAdmin.DocumentReference {
        return this.docRef;
    }
}

/**
 * Wrapper for Firestore Transaction
 */
export class TransactionWrapper implements ITransaction {
    constructor(private readonly transaction: FirebaseAdmin.Transaction) {}

    // Overload signatures to match interface
    async get(documentRef: IDocumentReference): Promise<IDocumentSnapshot>;
    async get(query: IQuery): Promise<IQuerySnapshot>;
    // Implementation signature
    async get(documentRefOrQuery: IDocumentReference | IQuery): Promise<IDocumentSnapshot | IQuerySnapshot> {
        if ('getUnderlyingRef' in documentRefOrQuery) {
            // It's a document reference
            const docRef = (documentRefOrQuery as DocumentReferenceWrapper).getUnderlyingRef();
            const snapshot = await this.transaction.get(docRef);
            return new DocumentSnapshotWrapper(snapshot);
        } else {
            // It's a query
            const query = (documentRefOrQuery as QueryWrapper)['query'];
            const snapshot = await this.transaction.get(query);
            return new QuerySnapshotWrapper(snapshot);
        }
    }

    set(documentRef: IDocumentReference, data: any, options?: SetOptions): ITransaction {
        const underlyingRef = (documentRef as DocumentReferenceWrapper).getUnderlyingRef();
        if (options !== undefined) {
            this.transaction.set(underlyingRef, data, options as FirebaseAdmin.SetOptions);
        } else {
            this.transaction.set(underlyingRef, data);
        }
        return this;
    }

    update(documentRef: IDocumentReference, data: any): ITransaction {
        const underlyingRef = (documentRef as DocumentReferenceWrapper).getUnderlyingRef();
        this.transaction.update(underlyingRef, data);
        return this;
    }

    delete(documentRef: IDocumentReference): ITransaction {
        const underlyingRef = (documentRef as DocumentReferenceWrapper).getUnderlyingRef();
        this.transaction.delete(underlyingRef);
        return this;
    }

    create(documentRef: IDocumentReference, data: any): ITransaction {
        const underlyingRef = (documentRef as DocumentReferenceWrapper).getUnderlyingRef();
        this.transaction.create(underlyingRef, data);
        return this;
    }
}

/**
 * Wrapper for Firestore WriteBatch
 */
export class WriteBatchWrapper implements IWriteBatch {
    constructor(private readonly batch: FirebaseAdmin.WriteBatch) {}

    set(documentRef: IDocumentReference, data: any, options?: SetOptions): IWriteBatch {
        const underlyingRef = (documentRef as DocumentReferenceWrapper).getUnderlyingRef();
        if (options !== undefined) {
            this.batch.set(underlyingRef, data, options as FirebaseAdmin.SetOptions);
        } else {
            this.batch.set(underlyingRef, data);
        }
        return this;
    }

    update(documentRef: IDocumentReference, data: any): IWriteBatch {
        const underlyingRef = (documentRef as DocumentReferenceWrapper).getUnderlyingRef();
        this.batch.update(underlyingRef, data);
        return this;
    }

    delete(documentRef: IDocumentReference): IWriteBatch {
        const underlyingRef = (documentRef as DocumentReferenceWrapper).getUnderlyingRef();
        this.batch.delete(underlyingRef);
        return this;
    }

    async commit(): Promise<void> {
        await this.batch.commit();
    }
}

/**
 * Wrapper for Firestore Database
 * This is the main entry point that creates the abstraction layer
 */
export class FirestoreDatabase implements IFirestoreDatabase {
    constructor(private readonly firestore: FirebaseAdmin.Firestore) {}

    collection(collectionPath: string): ICollectionReference {
        return new CollectionReferenceWrapper(this.firestore.collection(collectionPath));
    }

    doc(documentPath: string): IDocumentReference {
        return new DocumentReferenceWrapper(this.firestore.doc(documentPath));
    }

    collectionGroup(collectionId: string): IQuery {
        return new QueryWrapper(this.firestore.collectionGroup(collectionId));
    }

    async listCollections(): Promise<ICollectionReference[]> {
        const collections = await this.firestore.listCollections();
        return collections.map((col) => new CollectionReferenceWrapper(col));
    }

    async runTransaction<T>(updateFunction: (transaction: ITransaction) => Promise<T>): Promise<T> {
        return this.firestore.runTransaction(async (firestoreTransaction) => {
            const wrappedTransaction = new TransactionWrapper(firestoreTransaction);
            return await updateFunction(wrappedTransaction);
        });
    }

    batch(): IWriteBatch {
        return new WriteBatchWrapper(this.firestore.batch());
    }
}

/**
 * Factory function to create a wrapped Firestore database
 * @param firestore - The Firebase Admin Firestore instance
 * @returns Wrapped Firestore database
 */
export function createFirestoreDatabase(firestore: FirebaseAdmin.Firestore): IFirestoreDatabase {
    return new FirestoreDatabase(firestore);
}
