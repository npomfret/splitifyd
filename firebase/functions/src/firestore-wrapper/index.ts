/**
 * Firestore Wrapper Module
 *
 * This module provides an abstraction layer over Firebase Firestore that:
 * - Hides Firestore implementation details from the rest of the codebase
 * - Enables easy testing with stubs/mocks
 * - Provides a single place for monitoring, logging, and retry logic
 * - Allows potential future database migration
 *
 * Static utilities (FieldValue, Timestamp, FieldPath, Filter) are imported
 * directly from firebase-admin/firestore as they don't require wrapping.
 */

// Export wrapper interfaces
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
} from './types';

// Export wrapper implementations
export { CollectionReferenceWrapper, DocumentReferenceWrapper, DocumentSnapshotWrapper, FirestoreDatabase, QuerySnapshotWrapper, QueryWrapper, TransactionWrapper, WriteBatchWrapper, createFirestoreDatabase } from './FirestoreDatabase';

// Re-export static utilities from firebase-admin/firestore
// These don't need wrapping as they're pure functions/constants
export { FieldPath, FieldValue, Filter, Timestamp } from 'firebase-admin/firestore';
