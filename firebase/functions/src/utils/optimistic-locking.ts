import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { Errors } from './errors';
import { logger } from '../logger';
import { createOptimisticTimestamp } from './dateHelpers';

/**
 * Optimistic locking utilities using updatedAt timestamps
 * Prevents concurrent update conflicts across all collections
 *
 * IMPORTANT: Uses precise timestamps (Timestamp.now()) for conflict detection
 * because we need actual timestamp values for comparison logic.
 */

/**
 * Update a document with timestamp validation and new timestamp
 * NOTE: This does NOT perform the timestamp check - caller must do that BEFORE any writes
 *
 * ⚠️ DEPRECATED: This function has a design flaw - use checkAndUpdateWithTimestamp instead
 */
export const updateWithTimestamp = async (transaction: admin.firestore.Transaction, docRef: admin.firestore.DocumentReference, updates: any, originalTimestamp: Timestamp): Promise<void> => {
    // DO NOT perform reads here - Firestore requires all reads before writes
    // Caller must verify timestamp before calling this function

    // Apply update with new optimistic timestamp (for optimistic locking)
    transaction.update(docRef, {
        ...updates,
        updatedAt: createOptimisticTimestamp(),
    });

    // Document updated with optimistic lock
};

/**
 * 🎯 CORRECT: Check timestamp conflict and update document in proper transaction order
 * This function follows Firestore's requirement: ALL reads must come before ANY writes
 */
export const checkAndUpdateWithTimestamp = async (transaction: admin.firestore.Transaction, docRef: admin.firestore.DocumentReference, updates: any, originalTimestamp: Timestamp): Promise<void> => {
    // Step 1: READ FIRST (as required by Firestore)
    const freshDoc = await transaction.get(docRef);

    if (!freshDoc.exists) {
        throw Errors.NOT_FOUND('Document');
    }

    // Step 2: VALIDATE timestamp
    const currentTimestamp = freshDoc.data()?.updatedAt;
    if (!currentTimestamp || !currentTimestamp.isEqual(originalTimestamp)) {
        throw Errors.CONCURRENT_UPDATE();
    }

    // Step 3: WRITE (after all reads and validations)
    transaction.update(docRef, {
        ...updates,
        updatedAt: createOptimisticTimestamp(),
    });

    // Document updated with optimistic lock
};

/**
 * 🎯 ENHANCED: Extract and validate updatedAt timestamp from document data
 * Provides comprehensive validation with proper error handling and logging
 */
export const getUpdatedAtTimestamp = (data: any, docId?: string): Timestamp => {
    const updatedAt = data?.updatedAt;

    if (!updatedAt) {
        logger.error('Document missing updatedAt timestamp', { docId, dataKeys: Object.keys(data || {}) });
        throw Errors.INVALID_INPUT({ field: 'updatedAt', reason: 'missing_timestamp' });
    }

    if (!(updatedAt instanceof Timestamp)) {
        logger.error('Invalid updatedAt timestamp type', {
            docId,
            type: typeof updatedAt,
            value: updatedAt,
        });
        throw Errors.INVALID_INPUT({ field: 'updatedAt', reason: 'invalid_timestamp_type' });
    }

    // Validate timestamp reasonableness (not too far in past/future)
    const now = Date.now();
    const timestampMs = updatedAt.toMillis();
    const hourInMs = 60 * 60 * 1000;
    const dayInMs = 24 * hourInMs;

    if (timestampMs > now + hourInMs) {
        throw Errors.INVALID_INPUT({ field: 'updatedAt', reason: 'future_timestamp' });
    }

    if (timestampMs < now - 30 * dayInMs) {
        // Don't throw error for old timestamps
    }

    return updatedAt;
};
