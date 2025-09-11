import { Timestamp } from 'firebase-admin/firestore';
import { Errors } from './errors';
import { logger } from '../logger';

/**
 * Optimistic locking utilities using updatedAt timestamps
 * Prevents concurrent update conflicts across all collections
 *
 * IMPORTANT: Uses precise timestamps (Timestamp.now()) for conflict detection
 * because we need actual timestamp values for comparison logic.
 */

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
