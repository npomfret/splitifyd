export type {
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
    IAggregateQuery,
    IAggregateQuerySnapshot,
} from './firestore-types';

export {
    StubFirestoreDatabase,
    type FirestoreTriggerChange,
    type FirestoreTriggerEventType,
    type FirestoreTriggerChangeHandler,
    type FirestoreTriggerHandlers,
} from './StubFirestoreDatabase';
export {
    type TriggerOperation,
    type TriggerDefinition,
    type FirestoreTriggerHandler,
    type FirestoreTriggerDocumentSnapshot,
    type FirestoreTriggerEvent,
    type FirestoreProdTrigger,
    registerTriggerWithStub,
    attachTriggersToStub,
    toProdTrigger,
} from './triggers';
export { createFirestoreDatabase } from './admin-firestore';
export { FieldPath, FieldValue, Filter, Timestamp } from 'firebase-admin/firestore';
