/**
 * Stub Firestore Database Implementation
 *
 * Provides an in-memory implementation of IFirestoreDatabase for unit testing.
 * This stub allows tests to run without Firebase emulator and provides full control
 * over data and behavior.
 */

import type {
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
} from '../../../firestore-wrapper';

/**
 * In-memory document storage
 */
interface StoredDocument {
    id: string;
    path: string;
    data: any;
    exists: boolean;
}

/**
 * Stub DocumentSnapshot implementation
 */
class StubDocumentSnapshot implements IDocumentSnapshot {
    constructor(
        private readonly document: StoredDocument | null,
        private readonly docRef: IDocumentReference,
    ) {}

    get exists(): boolean {
        return this.document?.exists ?? false;
    }

    get id(): string {
        return this.docRef.id;
    }

    get ref(): IDocumentReference {
        return this.docRef;
    }

    data(): any | undefined {
        return this.document?.exists ? this.document.data : undefined;
    }
}

/**
 * Stub QuerySnapshot implementation
 */
class StubQuerySnapshot implements IQuerySnapshot {
    constructor(private readonly documents: StubDocumentSnapshot[]) {}

    get docs(): IDocumentSnapshot[] {
        return this.documents;
    }

    get empty(): boolean {
        return this.documents.length === 0;
    }

    get size(): number {
        return this.documents.length;
    }

    forEach(callback: (result: IDocumentSnapshot) => void): void {
        this.documents.forEach(callback);
    }
}

/**
 * Stub DocumentReference implementation
 */
class StubDocumentReference implements IDocumentReference {
    constructor(
        private readonly storage: Map<string, StoredDocument>,
        private readonly documentPath: string,
        private readonly db: StubFirestoreDatabase,
    ) {}

    get id(): string {
        const parts = this.documentPath.split('/');
        return parts[parts.length - 1];
    }

    get path(): string {
        return this.documentPath;
    }

    get parent(): ICollectionReference | null {
        const parts = this.documentPath.split('/');
        if (parts.length <= 1) return null;

        const collectionPath = parts.slice(0, -1).join('/');
        return new StubCollectionReference(this.storage, collectionPath, this.db);
    }

    collection(collectionPath: string): ICollectionReference {
        const fullPath = `${this.documentPath}/${collectionPath}`;
        return new StubCollectionReference(this.storage, fullPath, this.db);
    }

    async get(): Promise<IDocumentSnapshot> {
        const doc = this.storage.get(this.documentPath);
        return new StubDocumentSnapshot(doc ?? null, this);
    }

    async set(data: any, options?: SetOptions): Promise<void> {
        const existingDoc = this.storage.get(this.documentPath);

        if (options?.merge && existingDoc) {
            // Merge with existing data
            const mergedData = { ...existingDoc.data, ...data };
            this.storage.set(this.documentPath, {
                id: this.id,
                path: this.documentPath,
                data: mergedData,
                exists: true,
            });
        } else if (options?.mergeFields && existingDoc) {
            // Merge only specified fields
            const mergedData = { ...existingDoc.data };
            for (const field of options.mergeFields) {
                if (field in data) {
                    mergedData[field] = data[field];
                }
            }
            this.storage.set(this.documentPath, {
                id: this.id,
                path: this.documentPath,
                data: mergedData,
                exists: true,
            });
        } else {
            // Overwrite
            this.storage.set(this.documentPath, {
                id: this.id,
                path: this.documentPath,
                data: { ...data },
                exists: true,
            });
        }
    }

    async update(data: any): Promise<void> {
        const existingDoc = this.storage.get(this.documentPath);
        if (!existingDoc || !existingDoc.exists) {
            throw new Error(`Document ${this.documentPath} does not exist`);
        }

        this.storage.set(this.documentPath, {
            id: this.id,
            path: this.documentPath,
            data: { ...existingDoc.data, ...data },
            exists: true,
        });
    }

    async delete(): Promise<void> {
        this.storage.delete(this.documentPath);
    }
}

/**
 * Query filter condition
 */
interface QueryFilter {
    field: string;
    operator: WhereFilterOp;
    value: any;
}

/**
 * Query ordering
 */
interface QueryOrder {
    field: string;
    direction: OrderByDirection;
}

/**
 * Stub Query implementation
 */
class StubQuery implements IQuery {
    protected filters: QueryFilter[] = [];
    protected orders: QueryOrder[] = [];
    protected limitCount?: number;
    protected offsetCount: number = 0;
    protected startAfterValues?: any[];
    protected selectedFields?: string[];

    constructor(
        protected readonly storage: Map<string, StoredDocument>,
        protected readonly collectionPath: string,
        protected readonly db: StubFirestoreDatabase,
    ) {}

    where(fieldPath: string | any, opStr?: WhereFilterOp | any, value?: any): IQuery {
        const newQuery = this.clone();

        // Support both traditional where(field, op, value) and Filter-based where
        if (typeof fieldPath === 'string' && opStr !== undefined && value !== undefined) {
            newQuery.filters.push({ field: fieldPath, operator: opStr, value });
        }
        // For Filter objects, we'd need to parse them - for now, stub doesn't support Filter objects

        return newQuery;
    }

    orderBy(fieldPath: string, directionStr: OrderByDirection = 'asc'): IQuery {
        const newQuery = this.clone();
        newQuery.orders.push({ field: fieldPath, direction: directionStr });
        return newQuery;
    }

    limit(limit: number): IQuery {
        const newQuery = this.clone();
        newQuery.limitCount = limit;
        return newQuery;
    }

    offset(offset: number): IQuery {
        const newQuery = this.clone();
        newQuery.offsetCount = offset;
        return newQuery;
    }

    startAfter(...fieldValues: any[]): IQuery {
        const newQuery = this.clone();
        newQuery.startAfterValues = fieldValues;
        return newQuery;
    }

    select(...fieldPaths: string[]): IQuery {
        const newQuery = this.clone();
        newQuery.selectedFields = fieldPaths;
        return newQuery;
    }

    async get(): Promise<IQuerySnapshot> {
        // Find all documents in this collection path
        let documents: StoredDocument[] = [];

        for (const [path, doc] of this.storage.entries()) {
            if (this.isInCollection(path) && doc.exists) {
                documents.push(doc);
            }
        }

        // Apply filters
        documents = documents.filter((doc) => this.matchesFilters(doc));

        // Apply ordering
        if (this.orders.length > 0) {
            documents.sort((a, b) => this.compareDocuments(a, b));
        }

        // Apply startAfter cursor
        if (this.startAfterValues && this.startAfterValues.length > 0) {
            const startAfterIndex = this.findStartAfterIndex(documents);
            if (startAfterIndex >= 0) {
                documents = documents.slice(startAfterIndex + 1);
            }
        }

        // Apply offset
        if (this.offsetCount > 0) {
            documents = documents.slice(this.offsetCount);
        }

        // Apply limit
        if (this.limitCount !== undefined) {
            documents = documents.slice(0, this.limitCount);
        }

        // Create snapshots
        const snapshots = documents.map((doc) => {
            const docRef = new StubDocumentReference(this.storage, doc.path, this.db);
            return new StubDocumentSnapshot(doc, docRef);
        });

        return new StubQuerySnapshot(snapshots);
    }

    protected clone(): StubQuery {
        const cloned = new StubQuery(this.storage, this.collectionPath, this.db);
        cloned.filters = [...this.filters];
        cloned.orders = [...this.orders];
        cloned.limitCount = this.limitCount;
        cloned.offsetCount = this.offsetCount;
        cloned.startAfterValues = this.startAfterValues ? [...this.startAfterValues] : undefined;
        cloned.selectedFields = this.selectedFields ? [...this.selectedFields] : undefined;
        return cloned;
    }

    protected isInCollection(docPath: string): boolean {
        // Check if document is directly in this collection
        const pathParts = docPath.split('/');
        const collectionParts = this.collectionPath.split('/');

        // Collection path should be one level shorter than document path
        if (pathParts.length !== collectionParts.length + 1) {
            return false;
        }

        // All collection path parts should match
        for (let i = 0; i < collectionParts.length; i++) {
            if (pathParts[i] !== collectionParts[i]) {
                return false;
            }
        }

        return true;
    }

    protected matchesFilters(doc: StoredDocument): boolean {
        return this.filters.every((filter) => {
            const fieldValue = this.getFieldValue(doc.data, filter.field);
            return this.matchesFilter(fieldValue, filter.operator, filter.value);
        });
    }

    protected getFieldValue(data: any, field: string): any {
        const parts = field.split('.');
        let value = data;
        for (const part of parts) {
            value = value?.[part];
        }
        return value;
    }

    protected matchesFilter(fieldValue: any, operator: WhereFilterOp, filterValue: any): boolean {
        switch (operator) {
            case '==':
                return fieldValue === filterValue;
            case '!=':
                return fieldValue !== filterValue;
            case '<':
                return fieldValue < filterValue;
            case '<=':
                return fieldValue <= filterValue;
            case '>':
                return fieldValue > filterValue;
            case '>=':
                return fieldValue >= filterValue;
            case 'array-contains':
                return Array.isArray(fieldValue) && fieldValue.includes(filterValue);
            case 'in':
                return Array.isArray(filterValue) && filterValue.includes(fieldValue);
            case 'array-contains-any':
                return Array.isArray(fieldValue) && Array.isArray(filterValue) && fieldValue.some((v) => filterValue.includes(v));
            case 'not-in':
                return Array.isArray(filterValue) && !filterValue.includes(fieldValue);
            default:
                return false;
        }
    }

    protected compareDocuments(a: StoredDocument, b: StoredDocument): number {
        for (const order of this.orders) {
            const aValue = this.getFieldValue(a.data, order.field);
            const bValue = this.getFieldValue(b.data, order.field);

            let comparison = 0;
            if (aValue < bValue) comparison = -1;
            else if (aValue > bValue) comparison = 1;

            if (comparison !== 0) {
                return order.direction === 'asc' ? comparison : -comparison;
            }
        }
        return 0;
    }

    protected findStartAfterIndex(documents: StoredDocument[]): number {
        // For simplicity, assume startAfterValues[0] is a document snapshot or ID
        const startAfterValue = this.startAfterValues![0];

        if (typeof startAfterValue === 'object' && 'id' in startAfterValue) {
            // It's a document snapshot
            return documents.findIndex((doc) => doc.id === startAfterValue.id);
        }

        // Otherwise treat it as an ID or field value
        return documents.findIndex((doc) => {
            if (this.orders.length > 0) {
                const fieldValue = this.getFieldValue(doc.data, this.orders[0].field);
                return fieldValue === startAfterValue;
            }
            return doc.id === startAfterValue;
        });
    }
}

/**
 * Stub CollectionReference implementation
 */
class StubCollectionReference extends StubQuery implements ICollectionReference {
    constructor(storage: Map<string, StoredDocument>, collectionPath: string, db: StubFirestoreDatabase) {
        super(storage, collectionPath, db);
    }

    get parent(): IDocumentReference | null {
        const parts = this.collectionPath.split('/');
        if (parts.length <= 1) return null;

        const docPath = parts.slice(0, -1).join('/');
        return new StubDocumentReference(this.storage, docPath, this.db);
    }

    doc(documentId?: string): IDocumentReference {
        const id = documentId ?? this.generateId();
        const docPath = `${this.collectionPath}/${id}`;
        return new StubDocumentReference(this.storage, docPath, this.db);
    }

    protected clone(): StubCollectionReference {
        const cloned = new StubCollectionReference(this.storage, this.collectionPath, this.db);
        cloned.filters = [...this.filters];
        cloned.orders = [...this.orders];
        cloned.limitCount = this.limitCount;
        cloned.offsetCount = this.offsetCount;
        cloned.startAfterValues = this.startAfterValues ? [...this.startAfterValues] : undefined;
        cloned.selectedFields = this.selectedFields ? [...this.selectedFields] : undefined;
        return cloned;
    }

    private generateId(): string {
        return `stub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

/**
 * Stub Transaction implementation
 */
class StubTransaction implements ITransaction {
    private reads = new Map<string, StoredDocument | null>();
    private writes: Array<{ type: 'set' | 'update' | 'delete' | 'create'; ref: IDocumentReference; data?: any; options?: SetOptions }> = [];

    constructor(private readonly storage: Map<string, StoredDocument>) {}

    async get(documentRef: IDocumentReference): Promise<IDocumentSnapshot>;
    async get(query: IQuery): Promise<IQuerySnapshot>;
    async get(documentRefOrQuery: IDocumentReference | IQuery): Promise<IDocumentSnapshot | IQuerySnapshot> {
        if ('getUnderlyingRef' in documentRefOrQuery || 'path' in documentRefOrQuery) {
            // It's a document reference
            const docRef = documentRefOrQuery as StubDocumentReference;
            const doc = this.storage.get(docRef.path);
            this.reads.set(docRef.path, doc ?? null);
            return new StubDocumentSnapshot(doc ?? null, docRef);
        } else {
            // It's a query
            const query = documentRefOrQuery as StubQuery;
            return await query.get();
        }
    }

    set(documentRef: IDocumentReference, data: any, options?: SetOptions): ITransaction {
        this.writes.push({ type: 'set', ref: documentRef, data, options });
        return this;
    }

    update(documentRef: IDocumentReference, data: any): ITransaction {
        this.writes.push({ type: 'update', ref: documentRef, data });
        return this;
    }

    delete(documentRef: IDocumentReference): ITransaction {
        this.writes.push({ type: 'delete', ref: documentRef });
        return this;
    }

    create(documentRef: IDocumentReference, data: any): ITransaction {
        this.writes.push({ type: 'create', ref: documentRef, data });
        return this;
    }

    async commit(): Promise<void> {
        // Verify no documents were modified since read
        for (const [path, readDoc] of this.reads.entries()) {
            const currentDoc = this.storage.get(path);
            // Simple check - in real Firestore this would check versions
            if (JSON.stringify(readDoc) !== JSON.stringify(currentDoc ?? null)) {
                throw new Error(`Transaction failed: document ${path} was modified`);
            }
        }

        // Apply all writes
        for (const write of this.writes) {
            const ref = write.ref as StubDocumentReference;
            switch (write.type) {
                case 'set':
                    await ref.set(write.data!, write.options);
                    break;
                case 'update':
                    await ref.update(write.data!);
                    break;
                case 'delete':
                    await ref.delete();
                    break;
                case 'create':
                    const existing = this.storage.get(ref.path);
                    if (existing?.exists) {
                        throw new Error(`Document ${ref.path} already exists`);
                    }
                    await ref.set(write.data!);
                    break;
            }
        }
    }
}

/**
 * Stub WriteBatch implementation
 */
class StubWriteBatch implements IWriteBatch {
    private operations: Array<() => Promise<void>> = [];

    constructor(private readonly storage: Map<string, StoredDocument>) {}

    set(documentRef: IDocumentReference, data: any, options?: SetOptions): IWriteBatch {
        this.operations.push(async () => {
            await documentRef.set(data, options);
        });
        return this;
    }

    update(documentRef: IDocumentReference, data: any): IWriteBatch {
        this.operations.push(async () => {
            await documentRef.update(data);
        });
        return this;
    }

    delete(documentRef: IDocumentReference): IWriteBatch {
        this.operations.push(async () => {
            await documentRef.delete();
        });
        return this;
    }

    async commit(): Promise<void> {
        // Execute all operations sequentially
        for (const operation of this.operations) {
            await operation();
        }
    }
}

/**
 * Stub Firestore Database implementation
 */
export class StubFirestoreDatabase implements IFirestoreDatabase {
    private storage = new Map<string, StoredDocument>();

    collection(collectionPath: string): ICollectionReference {
        return new StubCollectionReference(this.storage, collectionPath, this);
    }

    doc(documentPath: string): IDocumentReference {
        return new StubDocumentReference(this.storage, documentPath, this);
    }

    collectionGroup(collectionId: string): IQuery {
        // For stub, return a query that matches all documents in any collection with this ID
        // This is simplified - real collectionGroup is more complex
        return new StubQuery(this.storage, collectionId, this);
    }

    async listCollections(): Promise<ICollectionReference[]> {
        const collections = new Set<string>();

        for (const path of this.storage.keys()) {
            const parts = path.split('/');
            if (parts.length >= 1) {
                collections.add(parts[0]);
            }
        }

        return Array.from(collections).map((collectionPath) => this.collection(collectionPath));
    }

    async runTransaction<T>(updateFunction: (transaction: ITransaction) => Promise<T>): Promise<T> {
        const transaction = new StubTransaction(this.storage);
        const result = await updateFunction(transaction);
        await transaction.commit();
        return result;
    }

    batch(): IWriteBatch {
        return new StubWriteBatch(this.storage);
    }

    /**
     * Test helper: Seed data into the stub
     */
    seed(documentPath: string, data: any): void {
        const parts = documentPath.split('/');
        const id = parts[parts.length - 1];

        this.storage.set(documentPath, {
            id,
            path: documentPath,
            data: { ...data },
            exists: true,
        });
    }

    /**
     * Test helper: Clear all data
     */
    clear(): void {
        this.storage.clear();
    }

    /**
     * Test helper: Get all stored documents (for debugging)
     */
    getAllDocuments(): Map<string, any> {
        const result = new Map<string, any>();
        for (const [path, doc] of this.storage.entries()) {
            if (doc.exists) {
                result.set(path, doc.data);
            }
        }
        return result;
    }
}
