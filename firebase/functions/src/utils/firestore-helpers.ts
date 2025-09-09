/**
 * Utility functions for working with Firestore documents
 */

import {getFirestore} from '../firebase';
import { logger } from '../logger';
import { measureDb } from '../monitoring/measure';

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
    const operationName = context.operation || 'unknown-transaction';
    
    return measureDb(operationName, async () => {
            let attempts = 0;
            let retryDelayTotal = 0;
            const retryMetrics: TransactionRetryMetric[] = [];
            
            while (attempts < maxAttempts) {
                const attemptStartTime = Date.now();
                
                try {
                    const result = await getFirestore().runTransaction(transactionFn);
                    const totalDuration = Date.now() - attemptStartTime + retryDelayTotal;
                    
                    // Record successful transaction metrics
                    // TODO: Update to use new metrics system
                    
                    // Log transaction completion metrics if there were retries
                    if (attempts > 0) {
                        logger.info('Transaction completed after retries', {
                            ...context,
                            operation: operationName,
                            totalAttempts: attempts + 1,
                            totalDuration,
                            retryDelayTotal,
                            retryPattern: retryMetrics.map(m => ({
                                attempt: m.attempt,
                                duration: m.duration,
                                delay: m.retryDelay,
                                errorType: m.errorType
                            }))
                        });
                    }
                    
                    return result;
                } catch (error) {
                    attempts++;
                    const attemptDuration = Date.now() - attemptStartTime;
                    
                    // Classify the error type for better monitoring
                    const errorType = classifyTransactionError(error);
                    const isTransactionError = errorType !== 'other';
                    
                    // Record retry attempt metric
                    retryMetrics.push({
                        attempt: attempts,
                        duration: attemptDuration,
                        errorType,
                        errorMessage: error instanceof Error ? error.message : String(error),
                        retryDelay: 0 // Will be set below if we retry
                    });
                    
                    if (isTransactionError && attempts < maxAttempts) {
                        // Exponential backoff with jitter
                        const delayMs = baseDelayMs * Math.pow(2, attempts - 1) + Math.random() * 50;
                        retryDelayTotal += delayMs;
                        
                        // Update the retry metric with the delay
                        retryMetrics[retryMetrics.length - 1].retryDelay = delayMs;
                        
                        logger.warn(`Transaction retry attempt ${attempts}/${maxAttempts}`, {
                            ...context,
                            operation: operationName,
                            attempt: attempts,
                            maxAttempts,
                            delayMs: Math.round(delayMs),
                            totalRetryDelay: retryDelayTotal,
                            errorType,
                            error: error instanceof Error ? error.message : String(error),
                        });
                        
                        await new Promise(resolve => setTimeout(resolve, delayMs));
                        continue;
                    }
                    
                    // Record failed transaction metrics
                    const totalDuration = Date.now() - attemptStartTime + retryDelayTotal;
                    // TODO: Update to use new metrics system
                    
                    // Log final failure if we're out of retries
                    if (isTransactionError && attempts >= maxAttempts) {
                        logger.error(`Transaction failed after ${maxAttempts} attempts`, {
                            ...context,
                            operation: operationName,
                            totalAttempts: attempts,
                            totalDuration,
                            totalRetryDelay: retryDelayTotal,
                            errorType,
                            error: error instanceof Error ? error.message : String(error),
                            retryPattern: retryMetrics.map(m => ({
                                attempt: m.attempt,
                                duration: m.duration,
                                errorType: m.errorType,
                                delay: m.retryDelay
                            })),
                            recommendation: getRetryRecommendation(errorType, retryMetrics)
                        });
                    }
                    
                    throw error; // Re-throw if not retryable or max attempts reached
                }
            }
            
            throw new Error('Transaction retry loop exited unexpectedly');
        });
}

/**
 * Classify transaction errors for better monitoring
 */
function classifyTransactionError(error: any): TransactionErrorType {
    if (!(error instanceof Error)) {
        return 'other';
    }
    
    const message = error.message.toLowerCase();
    
    if (message.includes('concurrent') || message.includes('contention')) {
        return 'concurrency';
    }
    if (message.includes('timeout') || message.includes('deadline')) {
        return 'timeout';
    }
    if (message.includes('aborted') || message.includes('transaction was aborted')) {
        return 'aborted';
    }
    if (message.includes('not found')) {
        return 'not_found';
    }
    if (message.includes('permission') || message.includes('unauthorized')) {
        return 'permission';
    }
    
    return 'other';
}

/**
 * Get recommendation based on error patterns
 */
function getRetryRecommendation(errorType: TransactionErrorType, retryMetrics: TransactionRetryMetric[]): string {
    const avgDuration = retryMetrics.reduce((sum, m) => sum + m.duration, 0) / retryMetrics.length;
    
    switch (errorType) {
        case 'concurrency':
            return avgDuration > 1000 ? 
                'Consider optimistic locking or reducing transaction scope' :
                'Normal concurrency - consider increasing retry attempts';
        case 'timeout':
            return avgDuration > 2000 ?
                'Transaction too slow - optimize queries or reduce scope' :
                'Increase timeout or reduce concurrent load';
        case 'aborted':
            return 'Check for data consistency issues or conflicting operations';
        default:
            return 'Review error details and consider alternative approach';
    }
}

/**
 * Transaction error classification
 */
type TransactionErrorType = 'concurrency' | 'timeout' | 'aborted' | 'not_found' | 'permission' | 'other';

/**
 * Individual transaction retry attempt metric
 */
interface TransactionRetryMetric {
    attempt: number;
    duration: number;
    errorType: TransactionErrorType;
    errorMessage: string;
    retryDelay: number;
}
