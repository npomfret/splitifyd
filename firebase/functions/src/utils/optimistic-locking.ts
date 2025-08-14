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
 * 
 * ⚠️ DEPRECATED: This function has a design flaw - use checkAndUpdateWithTimestamp instead
 */
export const updateWithTimestamp = async (
  transaction: admin.firestore.Transaction,
  docRef: admin.firestore.DocumentReference,
  updates: any,
  originalTimestamp: Timestamp
): Promise<void> => {
  // DO NOT perform reads here - Firestore requires all reads before writes
  // Caller must verify timestamp before calling this function
  
  // Apply update with new optimistic timestamp (for optimistic locking)
  transaction.update(docRef, {
    ...updates,
    updatedAt: createOptimisticTimestamp()
  });
  
  logger.info('Document updated with optimistic lock', {
    docId: docRef.id,
    collection: docRef.parent.id,
    updateFields: Object.keys(updates)
  });
};

/**
 * 🎯 CORRECT: Check timestamp conflict and update document in proper transaction order
 * This function follows Firestore's requirement: ALL reads must come before ANY writes
 */
export const checkAndUpdateWithTimestamp = async (
  transaction: admin.firestore.Transaction,
  docRef: admin.firestore.DocumentReference,
  updates: any,
  originalTimestamp: Timestamp
): Promise<void> => {
  // Step 1: READ FIRST (as required by Firestore)
  const freshDoc = await transaction.get(docRef);
  
  if (!freshDoc.exists) {
    throw Errors.NOT_FOUND('Document');
  }
  
  // Step 2: VALIDATE timestamp
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
  
  // Step 3: WRITE (after all reads and validations)
  transaction.update(docRef, {
    ...updates,
    updatedAt: createOptimisticTimestamp()
  });

  logger.info('Document updated with optimistic lock (correct order)', {
    docId: docRef.id,
    collection: docRef.parent.id,
    updateFields: Object.keys(updates)
  });
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
      value: updatedAt 
    });
    throw Errors.INVALID_INPUT({ field: 'updatedAt', reason: 'invalid_timestamp_type' });
  }
  
  // Validate timestamp reasonableness (not too far in past/future)
  const now = Date.now();
  const timestampMs = updatedAt.toMillis();
  const hourInMs = 60 * 60 * 1000;
  const dayInMs = 24 * hourInMs;
  
  if (timestampMs > now + hourInMs) {
    logger.warn('updatedAt timestamp is in the future', { 
      docId, 
      timestamp: updatedAt.toDate().toISOString(),
      futureMs: timestampMs - now
    });
    throw Errors.INVALID_INPUT({ field: 'updatedAt', reason: 'future_timestamp' });
  }
  
  if (timestampMs < now - (30 * dayInMs)) {
    logger.warn('updatedAt timestamp is very old', { 
      docId, 
      timestamp: updatedAt.toDate().toISOString(),
      ageMs: now - timestampMs
    });
    // Don't throw error for old timestamps, just warn
  }
  
  return updatedAt;
};

/**
 * Wrapper for transaction operations with optimistic locking (legacy - no retry)
 * @deprecated Use withOptimisticLockingRetry for production resilience
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

/**
 * 🎯 ENHANCED: Transaction wrapper with intelligent retry logic and exponential backoff
 * This is the recommended approach for production use with optimistic locking
 */
export const withOptimisticLockingRetry = async <T>(
  operation: (transaction: admin.firestore.Transaction) => Promise<T>,
  maxRetries: number = 3,
  operationName?: string
): Promise<T> => {
  let attempts = 0;
  
  while (attempts < maxRetries) {
    attempts++;
    
    try {
      return await admin.firestore().runTransaction(async (transaction) => {
        return await operation(transaction);
      });
    } catch (error) {
      const isLastAttempt = attempts >= maxRetries;
      
      // Check if this is a concurrent update error (optimistic locking failure)
      if (error instanceof Error && 
          (error.message.includes('CONCURRENT_UPDATE') || 
           error.message.includes('Transaction failed'))) {
           
        if (isLastAttempt) {
          logger.error(`Transaction failed after ${maxRetries} attempts`, { 
            operationName,
            errorMessage: error.message,
            totalAttempts: attempts
          });
          throw error;
        }
        
        // Exponential backoff with jitter: 100ms, 200ms, 400ms, etc.
        const baseDelay = Math.pow(2, attempts - 1) * 100;
        const jitter = Math.random() * 50; // Add 0-50ms jitter
        const delay = baseDelay + jitter;
        
        logger.info(`Retrying transaction due to concurrent update`, { 
          operationName,
          attempt: attempts,
          maxRetries,
          delayMs: delay,
          errorMessage: error.message
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For non-concurrent-update errors, fail immediately
      logger.error('Transaction failed with non-retryable error', { 
        operationName,
        errorMessage: error instanceof Error ? error.message : String(error),
        attempt: attempts
      });
      throw error;
    }
  }
  
  throw new Error('Unreachable code in withOptimisticLockingRetry');
};

/**
 * Update a document with automatic server timestamp (for non-optimistic scenarios)
 * USE FOR: Updates where you want true server-side timestamps but don't need optimistic locking
 */
export const updateWithServerTimestamp = (
  docRef: admin.firestore.DocumentReference,
  updates: any
): Promise<admin.firestore.WriteResult> => {
  return docRef.update({
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
};

/**
 * Transaction version of updateWithServerTimestamp
 * USE FOR: Transaction updates where you want server timestamps but don't need optimistic locking
 */
export const updateWithServerTimestampTransaction = (
  transaction: admin.firestore.Transaction,
  docRef: admin.firestore.DocumentReference,
  updates: any
): void => {
  transaction.update(docRef, {
    ...updates,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  logger.info('Document updated with server timestamp', {
    docId: docRef.id,
    collection: docRef.parent.id,
    updateFields: Object.keys(updates)
  });
};