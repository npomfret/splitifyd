export type {
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

export { FieldPath, FieldValue, Filter, Timestamp } from 'firebase-admin/firestore';
export { createFirestoreDatabase } from './admin-firestore';
export { type FirestoreTriggerChange, type FirestoreTriggerChangeHandler, type FirestoreTriggerEventType, type FirestoreTriggerHandlers, StubFirestoreDatabase } from './StubFirestoreDatabase';
export type { IStorage, IStorageBucket, IStorageFile, StorageFileContent, StorageFileMetadata, StorageSaveOptions } from './storage-types';
export { createStorage } from './admin-storage';
export {
    type SeedFileOptions,
    StubStorage,
    StubStorageBucket,
    StubStorageFile,
    type StubStorageOptions,
    type StoredFileSnapshot,
} from './StubStorage';
export {
    attachTriggersToStub,
    type FirestoreProdTrigger,
    type FirestoreTriggerDocumentSnapshot,
    type FirestoreTriggerEvent,
    type FirestoreTriggerHandler,
    registerTriggerWithStub,
    toProdTrigger,
    type TriggerDefinition,
    type TriggerOperation,
} from './triggers';
