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

export type {
    IAggregateQuery,
    IAggregateQuerySnapshot,
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
} from '@splitifyd/firebase-simulator';

export { createFirestoreDatabase, FieldPath, FieldValue, Filter, Timestamp } from '@splitifyd/firebase-simulator';
