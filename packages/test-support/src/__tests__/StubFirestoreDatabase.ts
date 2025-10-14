/**
 * Stub Firestore Database Implementation
 *
 * Provides an in-memory implementation of IFirestoreDatabase for unit testing.
 * This stub allows tests to run without Firebase emulator and provides full control
 * over data and behavior.
 */

import { Timestamp } from 'firebase-admin/firestore';
import { GroupDTOBuilder } from '../builders/GroupDTOBuilder';
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
} from './firestore-types';

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
 * Stub AggregateQuerySnapshot implementation
 */
class StubAggregateQuerySnapshot implements IAggregateQuerySnapshot {
    constructor(private readonly countValue: number) {}

    data(): { count: number; } {
        return { count: this.countValue };
    }
}

/**
 * Stub AggregateQuery implementation
 */
class StubAggregateQuery implements IAggregateQuery {
    constructor(private readonly countFn: () => Promise<number>) {}

    async get(): Promise<IAggregateQuerySnapshot> {
        const count = await this.countFn();
        return new StubAggregateQuerySnapshot(count);
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
            const mergedData = { ...existingDoc.data, ...data };
            this.storage.set(this.documentPath, {
                id: this.id,
                path: this.documentPath,
                data: mergedData,
                exists: true,
            });
        } else if (options?.mergeFields && existingDoc) {
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

        if (typeof fieldPath === 'string' && opStr !== undefined && value !== undefined) {
            newQuery.filters.push({ field: fieldPath, operator: opStr, value });
        } else if (typeof fieldPath === 'object' && fieldPath !== null) {
            // Handle FieldPath objects (e.g., FieldPath.documentId())
            // FieldPath.documentId() is represented as a special marker
            const fieldPathStr = fieldPath.toString?.() === '__name__' || fieldPath._segments?.[0] === '__name__'
                ? '__name__' // Document ID field
                : fieldPath.toString?.() || String(fieldPath);

            if (opStr !== undefined && value !== undefined) {
                newQuery.filters.push({ field: fieldPathStr, operator: opStr, value });
            }
        }

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

    count(): IAggregateQuery {
        return new StubAggregateQuery(async () => {
            let documents: StoredDocument[] = [];

            for (const [path, doc] of this.storage.entries()) {
                if (this.isInCollection(path) && doc.exists) {
                    documents.push(doc);
                }
            }

            documents = documents.filter((doc) => this.matchesFilters(doc));

            if (this.orders.length > 0) {
                documents.sort((a, b) => this.compareDocuments(a, b));
            }

            if (this.startAfterValues && this.startAfterValues.length > 0) {
                const startAfterIndex = this.findStartAfterIndex(documents);
                if (startAfterIndex >= 0) {
                    documents = documents.slice(startAfterIndex + 1);
                }
            }

            if (this.offsetCount > 0) {
                documents = documents.slice(this.offsetCount);
            }

            if (this.limitCount !== undefined) {
                documents = documents.slice(0, this.limitCount);
            }

            return documents.length;
        });
    }

    async get(): Promise<IQuerySnapshot> {
        let documents: StoredDocument[] = [];

        for (const [path, doc] of this.storage.entries()) {
            if (this.isInCollection(path) && doc.exists) {
                documents.push(doc);
            }
        }

        documents = documents.filter((doc) => this.matchesFilters(doc));

        if (this.orders.length > 0) {
            documents.sort((a, b) => this.compareDocuments(a, b));
        }

        if (this.startAfterValues && this.startAfterValues.length > 0) {
            const startAfterIndex = this.findStartAfterIndex(documents);
            if (startAfterIndex >= 0) {
                documents = documents.slice(startAfterIndex + 1);
            }
        }

        if (this.offsetCount > 0) {
            documents = documents.slice(this.offsetCount);
        }

        if (this.limitCount !== undefined) {
            documents = documents.slice(0, this.limitCount);
        }

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
        const pathParts = docPath.split('/');
        const collectionParts = this.collectionPath.split('/');

        // For collection group queries (single segment like 'shareLinks'),
        // check if the document's parent collection matches
        if (collectionParts.length === 1) {
            // Document path must have at least 2 segments (collection/doc)
            if (pathParts.length < 2) {
                return false;
            }
            // Check if the parent collection (second-to-last segment) matches
            const parentCollectionIndex = pathParts.length - 2;
            return pathParts[parentCollectionIndex] === collectionParts[0];
        }

        // For regular collection queries, check exact path match
        if (pathParts.length !== collectionParts.length + 1) {
            return false;
        }

        for (let i = 0; i < collectionParts.length; i++) {
            if (pathParts[i] !== collectionParts[i]) {
                return false;
            }
        }

        return true;
    }

    protected matchesFilters(doc: StoredDocument): boolean {
        return this.filters.every((filter) => {
            const fieldValue = this.getFieldValue(doc, filter.field);
            return this.matchesFilter(fieldValue, filter.operator, filter.value);
        });
    }

    protected getFieldValue(doc: StoredDocument | any, field: string): any {
        // Handle special FieldPath.documentId() case
        if (field === '__name__') {
            // If doc is a StoredDocument, return its id
            if (doc && typeof doc === 'object' && 'id' in doc) {
                return doc.id;
            }
            return doc;
        }

        // For regular fields, access doc.data
        const data = doc && typeof doc === 'object' && 'data' in doc ? doc.data : doc;
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
            const aValue = this.getFieldValue(a, order.field);
            const bValue = this.getFieldValue(b, order.field);

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
        const startAfterValue = this.startAfterValues![0];

        if (typeof startAfterValue === 'object' && 'id' in startAfterValue) {
            return documents.findIndex((doc) => doc.id === startAfterValue.id);
        }

        return documents.findIndex((doc) => {
            if (this.orders.length > 0) {
                const fieldValue = this.getFieldValue(doc, this.orders[0].field);

                // Handle Timestamp comparisons
                if (fieldValue instanceof Timestamp && startAfterValue instanceof Timestamp) {
                    return fieldValue.seconds === startAfterValue.seconds && fieldValue.nanoseconds === startAfterValue.nanoseconds;
                }

                // Handle Date comparisons
                if (fieldValue instanceof Date && startAfterValue instanceof Date) {
                    return fieldValue.getTime() === startAfterValue.getTime();
                }

                // Handle Timestamp vs Date comparisons
                if (fieldValue instanceof Timestamp && startAfterValue instanceof Date) {
                    return fieldValue.toDate().getTime() === startAfterValue.getTime();
                }
                if (fieldValue instanceof Date && startAfterValue instanceof Timestamp) {
                    return fieldValue.getTime() === startAfterValue.toDate().getTime();
                }

                // Fallback to equality comparison for primitives
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
    private writes: Array<{ type: 'set' | 'update' | 'delete' | 'create'; ref: IDocumentReference; data?: any; options?: SetOptions; }> = [];

    constructor(private readonly storage: Map<string, StoredDocument>) {}

    async get(documentRef: IDocumentReference): Promise<IDocumentSnapshot>;
    async get(query: IQuery): Promise<IQuerySnapshot>;
    async get(documentRefOrQuery: IDocumentReference | IQuery): Promise<IDocumentSnapshot | IQuerySnapshot> {
        if ('getUnderlyingRef' in documentRefOrQuery || 'path' in documentRefOrQuery) {
            const docRef = documentRefOrQuery as StubDocumentReference;
            const doc = this.storage.get(docRef.path);
            this.reads.set(docRef.path, doc ?? null);
            return new StubDocumentSnapshot(doc ?? null, docRef);
        } else {
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
        for (const [path, readDoc] of this.reads.entries()) {
            const currentDoc = this.storage.get(path);
            if (JSON.stringify(readDoc) !== JSON.stringify(currentDoc ?? null)) {
                throw new Error(`Transaction failed: document ${path} was modified`);
            }
        }

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

    clear(): void {
        this.storage.clear();
    }

    getAllDocuments(): Map<string, any> {
        const result = new Map<string, any>();
        for (const [path, doc] of this.storage.entries()) {
            if (doc.exists) {
                result.set(path, doc.data);
            }
        }
        return result;
    }

    // todo: this should not be here - the data should be in the correct format already
    private convertDatesToTimestamps(data: any): any {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const converted = Array.isArray(data) ? [...data] : { ...data };
        const dateFields = new Set([
            'date',
            'createdAt',
            'updatedAt',
            'deletedAt',
            'presetAppliedAt',
            'markedForDeletionAt',
            'joinedAt',
            'groupUpdatedAt',
            'assignedAt',
            'lastUpdatedAt',
        ]);

        for (const key in converted) {
            const value = converted[key];

            if (value === null || value === undefined) {
                continue;
            }

            if (dateFields.has(key)) {
                if (typeof value === 'string') {
                    try {
                        const date = new Date(value);
                        if (!isNaN(date.getTime())) {
                            converted[key] = Timestamp.fromDate(date);
                        }
                    } catch {
                        //
                    }
                } else if (value instanceof Date) {
                    // Handle Date objects directly
                    converted[key] = Timestamp.fromDate(value);
                }
            } else if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp) && !(value instanceof Date)) {
                converted[key] = this.convertDatesToTimestamps(value);
            } else if (Array.isArray(value)) {
                converted[key] = value.map((item) => (typeof item === 'object' && item !== null ? this.convertDatesToTimestamps(item) : item));
            }
        }

        return converted;
    }

    seedUser(userId: string, userData: Record<string, any> = {}): void {
        const defaultUser = {
            id: userId,
            email: userData.email || `${userId}@test.com`,
            displayName: userData.displayName || `User ${userId}`,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            ...this.convertDatesToTimestamps(userData),
        };
        this.seed(`users/${userId}`, defaultUser);
    }

    seedGroup(groupId: string, overrides: Record<string, any> = {}): void {
        const now = Timestamp.now();

        // Use buildDocument() to get Firestore format without client-side fields
        const groupDocument = new GroupDTOBuilder()
            .withName(overrides.name || 'Test Group')
            .withDescription(overrides.description || 'A test group')
            .withCreatedBy(overrides.createdBy || 'test-creator')
            .buildDocument();

        const groupData = {
            ...groupDocument,
            id: groupId,
            createdAt: now,
            updatedAt: now,
            ...overrides,
        };

        const firestoreData = this.convertDatesToTimestamps(groupData);
        this.seed(`groups/${groupId}`, firestoreData);
    }

    seedGroupMember(groupId: string, userId: string, memberData: Record<string, any>): void {
        const firestoreData = this.convertDatesToTimestamps(memberData);
        this.seed(`group-memberships/${userId}_${groupId}`, firestoreData);
    }

    seedExpense(expenseId: string, expenseData: Record<string, any>): void {
        const firestoreData = this.convertDatesToTimestamps(expenseData);
        this.seed(`expenses/${expenseId}`, firestoreData);
    }

    seedSettlement(settlementId: string, settlementData: Record<string, any>): void {
        const firestoreData = this.convertDatesToTimestamps(settlementData);
        this.seed(`settlements/${settlementId}`, firestoreData);
    }

    seedPolicy(policyId: string, policyData: Record<string, any>): void {
        const firestoreData = this.convertDatesToTimestamps(policyData);
        this.seed(`policies/${policyId}`, firestoreData);
    }

    initializeGroupBalance(groupId: string): void {
        const initialBalance = {
            groupId,
            balancesByCurrency: {},
            simplifiedDebts: [],
            lastUpdatedAt: Timestamp.now(),
            version: 0,
        };
        this.seed(`groups/${groupId}/metadata/balance`, initialBalance);
    }
}
