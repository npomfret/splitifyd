import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { Errors } from './errors';
import { logger } from '../logger';

/**
 * Optimistic locking utilities using updatedAt timestamps
 * Prevents concurrent update conflicts across all collections
 */

/**
 * Check if a document was modified since it was read
 */
export const checkTimestampConflict = async (
  transaction: admin.firestore.Transaction,
  docRef: admin.firestore.DocumentReference,
  originalTimestamp: Timestamp
): Promise<void> => {
  const freshDoc = await transaction.get(docRef);
  
  if (!freshDoc.exists) {
    throw Errors.NOT_FOUND('Document');
  }
  
  const currentTimestamp = freshDoc.data()?.updatedAt;
  
  if (!currentTimestamp || !currentTimestamp.isEqual(originalTimestamp)) {
    logger.warn('Concurrent update detected', {
      docId: docRef.id,
      collection: docRef.parent.id,
      originalTimestamp: originalTimestamp.toDate().toISOString(),
      currentTimestamp: currentTimestamp?.toDate().toISOString()
    });
    
    throw Errors.CONCURRENT_UPDATE();
  }
};

/**
 * Update a document with timestamp validation and new timestamp
 * NOTE: This does NOT perform the timestamp check - caller must do that BEFORE any writes
 */
export const updateWithTimestamp = async (
  transaction: admin.firestore.Transaction,
  docRef: admin.firestore.DocumentReference,
  updates: any,
  originalTimestamp: Timestamp
): Promise<void> => {
  // DO NOT perform reads here - Firestore requires all reads before writes
  // Caller must verify timestamp before calling this function
  
  // Apply update with new timestamp
  transaction.update(docRef, {
    ...updates,
    updatedAt: Timestamp.now()
  });
  
  logger.info('Document updated with optimistic lock', {
    docId: docRef.id,
    collection: docRef.parent.id,
    updateFields: Object.keys(updates)
  });
};

/**
 * Helper to extract updatedAt timestamp from document data
 */
export const getUpdatedAtTimestamp = (data: any): Timestamp => {
  const updatedAt = data?.updatedAt;
  if (!updatedAt || !(updatedAt instanceof Timestamp)) {
    throw new Error('Document missing required updatedAt timestamp');
  }
  return updatedAt;
};

/**
 * Wrapper for transaction operations with optimistic locking
 */
export const withOptimisticLocking = async <T>(
  operation: (transaction: admin.firestore.Transaction) => Promise<T>
): Promise<T> => {
  return admin.firestore().runTransaction(async (transaction) => {
    try {
      return await operation(transaction);
    } catch (error) {
      if (error instanceof Error && error.message.includes('CONCURRENT_UPDATE')) {
        logger.warn('Transaction failed due to concurrent update', { errorMessage: error.message });
      }
      throw error;
    }
  });
};