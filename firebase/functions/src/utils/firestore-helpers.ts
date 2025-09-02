/**
 * Utility functions for working with Firestore documents
 */

import { firestoreDb } from '../firebase';
import { logger } from '../logger';

/**
 * Recursively removes undefined values from an object before saving to Firestore.
 * Firestore doesn't allow undefined values, so we need to filter them out.
 */
export function removeUndefinedFields(obj: any): any {
    if (obj === null || obj === undefined) {
        return null;
    }

    if (Array.isArray(obj)) {
        return obj.map(removeUndefinedFields);
    }

    if (typeof obj === 'object' && obj.constructor === Object) {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                cleaned[key] = removeUndefinedFields(value);
            }
        }
        return cleaned;
    }

    return obj;
}

/**
 * Executes a Firestore transaction with automatic retry logic for lock contention.
 * Particularly useful in the Firebase emulator which has stricter locking behavior.
 */
export async function runTransactionWithRetry<T>(
    transactionFn: (transaction: FirebaseFirestore.Transaction) => Promise<T>,
    options: {
        maxAttempts?: number;
        baseDelayMs?: number;
        context?: {
            operation?: string;
            userId?: string;
            groupId?: string;
            [key: string]: any;
        };
    } = {}
): Promise<T> {
    const { maxAttempts = 3, baseDelayMs = 100, context = {} } = options;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        try {
            return await firestoreDb.runTransaction(transactionFn);
        } catch (error) {
            attempts++;
            
            // Check if it's a transaction timeout/contention error
            const isTransactionError = error instanceof Error && (
                error.message.includes('Transaction lock timeout') ||
                error.message.includes('Aborted due to cross-transaction contention') ||
                error.message.includes('Transaction was aborted') ||
                error.message.includes('Deadline exceeded') ||
                error.message.includes('DEADLINE_EXCEEDED')
            );
            
            if (isTransactionError && attempts < maxAttempts) {
                // Exponential backoff with jitter
                const delayMs = baseDelayMs * Math.pow(2, attempts - 1) + Math.random() * 50;
                
                logger.warn(`Transaction retry attempt ${attempts}/${maxAttempts}`, {
                    ...context,
                    attempt: attempts,
                    maxAttempts,
                    delayMs: Math.round(delayMs),
                    error: error.message,
                });
                
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }
            
            // Log final failure if we're out of retries
            if (isTransactionError && attempts >= maxAttempts) {
                logger.error(`Transaction failed after ${maxAttempts} attempts`, {
                    ...context,
                    totalAttempts: attempts,
                    error: error.message,
                });
            }
            
            throw error; // Re-throw if not retryable or max attempts reached
        }
    }
    
    throw new Error('Transaction retry loop exited unexpectedly');
}
